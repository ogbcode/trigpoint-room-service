import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  CHORD_BASE_URL,
  CHORD_MCP_SERVER,
  CHORD_TEAMMATE,
  CHORD_TEAMMATE_ACTIVATION,
  HttpMethod,
  Route,
  SKILL_DIR,
  SKILL_ENTRYPOINT,
  SKILL_NAME,
  SKILL_PUBLISH_SUMMARY,
  Tool,
} from './constants.js';
import { required } from './env.js';
import { logger } from './logger.js';

interface McpServer {
  id: string;
  name: string;
}

interface Teammate {
  id: string;
  email: string;
}

interface Skill {
  id: string;
  name: string;
  version: number;
  included: boolean;
}

const apiKey = required('CHORD_API_KEY');
const workspaceId = required('CHORD_WORKSPACE_ID');
const serverUrl = required('SERVER_URL').replace(/\/$/, '');
const toolsToken = required('CHORD_TOOLS_TOKEN');

async function chord<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${CHORD_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

async function skillFiles() {
  const entries = await readdir(SKILL_DIR, { recursive: true, withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return { path: relative(SKILL_DIR, path), content: await readFile(path, 'utf8') };
      }),
  );
}

async function syncMcpServer() {
  const base = `/v1/workspaces/${workspaceId}/mcp-servers`;
  const settings = {
    url: `${serverUrl}${Route.MCP}`,
    auth_token: toolsToken,
    enabled: true,
    enabled_tools: Object.values(Tool),
  };
  const servers = await chord<McpServer[]>(HttpMethod.GET, base);
  const existing = servers.find((server) => server.name === CHORD_MCP_SERVER.name);
  const server = existing
    ? await chord<McpServer>(HttpMethod.PUT, `${base}/${existing.id}`, settings)
    : await chord<McpServer>(HttpMethod.POST, base, { ...CHORD_MCP_SERVER, ...settings });
  const health = await chord<unknown>(HttpMethod.POST, `${base}/${server.id}/health`);
  return { server, health };
}

async function syncTeammate(serverId: string) {
  const teammates = await chord<Teammate[]>(HttpMethod.GET, `/v1/teammates?workspace_id=${workspaceId}`);
  const existing = teammates.find((teammate) => teammate.email === CHORD_TEAMMATE.email);
  if (existing) {
    return chord<Teammate>(HttpMethod.PUT, `/v1/teammates/${existing.id}`, { set_mcp_server_ids: [serverId] });
  }
  return chord<Teammate>(HttpMethod.POST, '/v1/teammates', {
    ...CHORD_TEAMMATE,
    workspace_id: workspaceId,
    mcp_server_ids: [serverId],
    start_paused: true,
  });
}

async function publishSkill(teammateId: string) {
  const base = `/v1/teammates/${teammateId}/skills`;
  const state = await chord<{ enabled: boolean; skills: Skill[] }>(HttpMethod.GET, base);
  if (!state.enabled) await chord<unknown>(HttpMethod.POST, `${base}/migrate`);

  const content = { name: SKILL_NAME, entrypoint: SKILL_ENTRYPOINT, files: await skillFiles() };
  const existing = state.skills.find((skill) => skill.name === SKILL_NAME);
  const draft = existing
    ? await chord<Skill>(HttpMethod.PUT, `${base}/${existing.id}/draft`, {
        ...content,
        expected_version: existing.version,
        idempotency_key: randomUUID(),
      })
    : await chord<Skill>(HttpMethod.POST, base, { ...content, idempotency_key: randomUUID() });
  const published = await chord<Skill>(HttpMethod.POST, `${base}/${draft.id}/publish`, {
    expected_version: draft.version,
    summary: SKILL_PUBLISH_SUMMARY,
    idempotency_key: randomUUID(),
  });
  if (!published.included) {
    await chord<unknown>(HttpMethod.PATCH, `${base}/${published.id}`, {
      expected_version: published.version,
      included: true,
      idempotency_key: randomUUID(),
    });
  }
}

const { server, health } = await syncMcpServer();
const teammate = await syncTeammate(server.id);
await publishSkill(teammate.id);
await chord<unknown>(HttpMethod.POST, `/v1/teammates/${teammate.id}/lifecycle`, CHORD_TEAMMATE_ACTIVATION);
logger.info({ mcpServerId: server.id, health, teammateId: teammate.id }, 'Chord teammate is ready');
