import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { hasBasicPassword, hasBearerToken } from './auth.js';
import { renderBoard, renderPaymentPage } from './board.js';
import { config } from './config.js';
import {
  BOARD_AUTH_REALM,
  HttpMethod,
  NOT_AWAITING_ROOM_CHARGE,
  PAYSTACK_SIGNATURE_HEADER,
  RoomChargeDecision,
  Route,
} from './constants.js';
import { migrateAndSeed } from './db.js';
import { logger } from './logger.js';
import { createMcpServer } from './mcp.js';
import { OrderError, boardData, decideRoomCharge, paymentPageText, settlePayment } from './orders.js';
import { isValidSignature } from './paystack.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

interface ToolRequest {
  params?: { name?: string; arguments?: Record<string, unknown> };
}

const app = Fastify({ loggerInstance: logger });
const parseJson = app.getDefaultJsonParser('error', 'error');
const decisions = new Set<string>(Object.values(RoomChargeDecision));
const serverOrigin = new URL(config.serverUrl).origin;

app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
  request.rawBody = body as string;
  parseJson(request, body as string, done);
});
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, _body, done) =>
  done(null, {}),
);

async function requireBoardLogin(request: FastifyRequest, reply: FastifyReply) {
  if (hasBasicPassword(request.headers.authorization, config.boardPassword)) return;
  return reply.code(401).header('WWW-Authenticate', `Basic realm="${BOARD_AUTH_REALM}"`).send('Unauthorized');
}

const isFromBoard = (request: FastifyRequest) =>
  request.headers['sec-fetch-site'] === 'same-origin' || request.headers.origin === serverOrigin;

app.get(Route.HEALTH, async () => ({ ok: true }));

app.post(Route.MCP, async (request, reply) => {
  if (!hasBearerToken(request.headers.authorization, config.chordToolsToken)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const { params } = request.body as ToolRequest;
  request.log.debug({ tool: params?.name, fields: Object.keys(params?.arguments ?? {}) }, 'Tool request');

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  reply.raw.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  reply.hijack();
  await transport.handleRequest(request.raw, reply.raw, request.body);
});

app.route({
  method: [HttpMethod.GET, HttpMethod.DELETE],
  url: Route.MCP,
  handler: async (_request, reply) => reply.code(405).send({ error: 'Method not allowed' }),
});

app.post(Route.PAYSTACK_WEBHOOK, async (request, reply) => {
  const signature = request.headers[PAYSTACK_SIGNATURE_HEADER];
  if (typeof signature !== 'string' || !isValidSignature(request.rawBody ?? '', signature)) {
    return reply.code(401).send();
  }
  const reference = (request.body as { data?: { reference?: string } }).data?.reference;
  if (reference) await settlePayment(reference);
  return reply.code(200).send();
});

app.get(Route.PAYSTACK_CALLBACK, async (request, reply) => {
  const { reference, trxref } = request.query as { reference?: string; trxref?: string };
  return reply.type('text/html').send(renderPaymentPage(await paymentPageText(reference ?? trxref)));
});

app.get(Route.BOARD, { preHandler: requireBoardLogin }, async (_request, reply) =>
  reply.type('text/html').send(renderBoard(await boardData())),
);

app.post(Route.BOARD_DECISION, { preHandler: requireBoardLogin }, async (request, reply) => {
  const { orderRef, decision } = request.params as { orderRef: string; decision: string };
  if (!isFromBoard(request)) return reply.code(403).send('Forbidden');
  if (!decisions.has(decision)) return reply.code(404).send('Not found');
  try {
    await decideRoomCharge(orderRef, decision as RoomChargeDecision);
  } catch (error) {
    if (!(error instanceof OrderError)) throw error;
    if (error.message !== NOT_AWAITING_ROOM_CHARGE) return reply.code(400).send(error.message);
  }
  return reply.redirect(Route.BOARD, 303);
});

await migrateAndSeed();
await app.listen({ port: config.port, host: '0.0.0.0' });
