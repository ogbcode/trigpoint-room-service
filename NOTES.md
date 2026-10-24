# Deployment field notes

## 1. Creating the teammate failed with an error that names no field

- **What happened:** `POST /v1/teammates` returned `400 {"error":{"code":"BAD_REQUEST","message":"Malformed or unrecognized request body"}}` (request `93f26bbd-102f-41bb-81ad-4dd24f9bb29e`). The MCP server had registered with the same key a second earlier, so auth and scopes were fine.
- **How I found the cause:** Every field I sent is in the OpenAPI schema for this call. Autonomy and escalation can only be set at creation, so I tested with an existing teammate's email instead of creating one: a body Chord accepts answers `409 ALREADY_EXISTS` and creates nothing, a body it rejects answers `400`. Removing one field at a time pointed to `capabilities`, then to `surface_evidence` alone. The Teammates guide says that field is set on update, not create. For this field the guide matches the server and the OpenAPI does not.
- **Fix:** Dropped `surface_evidence` from the create body. It was `false`, the default, anyway.
- **What I'd change in Chord:** Name the rejected field in validation errors, and generate the OpenAPI create schema from the type the server accepts.

## 2. The tools can't tell who is messaging

- **What happened:** Before placing an order, a tool needs to know which guest is writing, and nothing tells it. I logged every request Chord sent the tool server during a live chat turn. The headers were ordinary HTTP (user-agent `Java-http-client/23.0.2`) with no sender, thread or chat id, and the `tools/call` body held only `name` and `arguments`, with no `_meta`.
- **How I found the cause:** The model does know the sender. Asked in a test chat, it read back the exact sender id and display name I had sent. The MCP server docs list only fixed headers, set once per server.
- **Workaround:** For the demo, the tools take the room number the guest gives and check that a guest is staying in that room. Matching the guest's WhatsApp number would mean trusting the model to pass the sender id, and a guest could try to make it pass someone else's.
- **What I'd change in Chord:** Send the verified sender, such as the WhatsApp number, and the thread id with every tool call, as headers or in `_meta`, so a tool can identify the guest without trusting the model. Then let a server post a message into that thread. Today the thread messages route only works after a human takes the chat over, so a guest only hears that their payment landed when they ask.

## 3. The teammate apologised for its own correct answers

- **What happened:** In later turns the teammate wrote "I need to retract part of my last message" and "To fix my earlier mistake, I should have checked the system before listing items and prices". The earlier messages were correct and had come from tool calls.
- **How I found the cause:** The turn history (`GET /v1/threads/{id}/turns`) keeps the text of each message and the names of the tools used, not their results, and every turn called `get_menu` and `quote_order` again. My reading is that tool results are not replayed into later turns, so the model sees its own prices and names with nothing behind them. The fix working supports this but does not prove it.
- **Fix:** A paragraph at the top of the skill says its earlier messages came from tool results it can no longer see, that they are correct, and to call the tool again when it needs the details. Order lookups also return the guest's first name, so the name is always backed by a tool result. The apologies stopped on the next run.
- **What I'd change in Chord:** Replay a short summary of each turn's tool results, or document what is replayed between turns, so builders design skills for it from the start.
