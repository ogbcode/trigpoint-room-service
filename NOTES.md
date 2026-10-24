# Deployment field notes

## 1. Creating the teammate failed with an error that names no field

- **What happened:** `POST /v1/teammates` returned `400 {"error":{"code":"BAD_REQUEST","message":"Malformed or unrecognized request body"}}` (request `93f26bbd-102f-41bb-81ad-4dd24f9bb29e`). The MCP server had registered with the same key a second earlier, so auth and scopes were fine.
- **How I found the cause:** Every field I sent is in the OpenAPI schema for this call. Autonomy and escalation can only be set at creation, so I could not risk creating a half-configured teammate. Instead I sent the same body with the email of an existing teammate: a body Chord accepts answers `409 ALREADY_EXISTS` and creates nothing, a body it rejects answers `400`. Removing one field at a time pointed to `capabilities`, then to `surface_evidence` alone. The Teammates guide says that field is set on update, not create. For this field the guide matches the server and the OpenAPI does not.
- **Fix:** Dropped `surface_evidence` from the create body. It was `false`, the default, anyway.
- **What I'd change in Chord:** Name the rejected field in validation errors, and generate the OpenAPI create schema from the type the server accepts.

## 2. The tools can't tell who is messaging

- **What happened:** Before placing an order, a tool needs to know which guest is writing, and nothing tells it. I logged every request Chord sent the tool server during a live chat turn: ordinary HTTP and Cloudflare headers (user-agent `Java-http-client/23.0.2`) and a `tools/call` body of only `name` and `arguments`. No sender, thread or chat id, and no `_meta`.
- **How I found the cause:** The model does know the sender. Asked in a test chat, it read back the exact sender id and display name I had sent. The MCP server docs list only fixed headers, set once per server.
- **Workaround:** The tools ask for the room number and the surname on the booking and check both against the guests staying. Having the model pass the sender id would let a guest try to make it pass someone else's.
- **What I'd change in Chord:** Send the verified sender, such as the WhatsApp number, and the thread id with every tool call, as headers or in `_meta`, so a tool can identify the guest without trusting the model.

## 3. The teammate apologised for its own correct answers

- **What happened:** In later turns the teammate wrote "I need to retract part of my last message" and "To fix my earlier mistake, I should have checked the system before listing items and prices". The earlier messages were correct and had come from tool calls.
- **How I found the cause:** The turn history (`GET /v1/threads/{id}/turns`) keeps the text of each message and the names of the tools used, not their results, and every turn called `get_menu` and `quote_order` again. I concluded that tool results are not replayed into later turns, so the model sees its own prices and names with nothing behind them and treats them as unsupported.
- **Fix:** A paragraph at the top of the skill says its earlier messages came from tool results it can no longer see, that they are correct, and to call the tool again when it needs the details. Order lookups also return the guest's first name, so the name is always backed by a tool result. The apologies stopped on the next run.
- **What I'd change in Chord:** Replay a short summary of each turn's tool results, or document that only text is replayed, so builders design skills for it from the start.
