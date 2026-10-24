# Trigpoint Room Service

**Role:** Forward-deployed Engineering

Trigpoint Hotel is my father's hotel in Nigeria. When a guest orders food and drinks, the kitchen won't cook without a docket from the restaurant, and the restaurant has to get a separate bill from the bar for the drinks, which adds manual work and auditing overhead to every order. This agent takes the order from the guest on WhatsApp and records it once, split into a kitchen docket and a bar ticket with their own amounts, paid by Paystack link or charged to the room for the front desk to confirm. Left out on purpose: telling the guest when the food is ready, stock counts, walk-in diners, and the live connection to the hotel's own system, which the order service here is built to match.

## How it works

- A Chord teammate runs the skill in `skill/room-service` and talks to guests on WhatsApp.
- This service is its tool: an MCP server that Chord calls over HTTPS, with five tools: `get_menu`, `quote_order`, `place_order`, `get_order` and `new_payment_link`.
- Orders, tickets and room charges are kept in Postgres.
- Paystack test mode takes payments. The webhook, the page Paystack sends the guest back to, and `get_order` all confirm a payment the same way: ask Paystack, check the amount, then send the tickets once.
- `/board` is the staff page: kitchen and bar tickets, room charges waiting for the front desk, and the latest orders.

## Run it locally

You need Node 22 and Postgres.

1. Chord only calls public HTTPS addresses, so start a tunnel to port 3000, for example `cloudflared tunnel --url http://localhost:3000`.
2. Run `cp .env.example .env` and fill it in. `SERVER_URL` is the tunnel's https:// address, and `PAYSTACK_SECRET_KEY` must be a test key starting `sk_test_`.
3. Run `npm install`, then `npm run dev`. On first start the server creates the tables and loads the made-up hotel data.

## Connect it

1. **Chord.** With `CHORD_API_KEY` and `CHORD_WORKSPACE_ID` set, run `npm run chord:setup`. It registers the tool server at `SERVER_URL/mcp`, creates the teammate, publishes the skill and activates the teammate. Run it again after changing the skill or the address.
2. **Paystack.** In test mode, set the webhook URL to `SERVER_URL/paystack/webhook`.
3. **WhatsApp simulator.** Sign in at chat.tsglabs.dev with the Chord account and create a chat link for "Trigpoint Room Service".

## Deploy

The Dockerfile builds the service and carries the migrations. On Railway, add a Postgres database and a service from this repo. On the service, set `SERVER_URL` (its https:// address), `DATABASE_URL` (from the database), `CHORD_TOOLS_TOKEN`, `BOARD_PASSWORD` and `PAYSTACK_SECRET_KEY`. Keep `CHORD_API_KEY` and `CHORD_WORKSPACE_ID` on your own machine, and repeat the Connect steps with `SERVER_URL` set to the Railway address.

## Try it

Guests are staying in rooms 101, 204, 305 and 410. Room 512 has checked out, and goat meat pepper soup is sold out.

> Hi, I'm in room 101. Can I get jollof rice with chicken and two bottles of water?

On the Paystack test checkout, choose success or decline. Or charge it to the room, then accept or reject the charge under Front desk on `SERVER_URL/board`. The board asks for `BOARD_PASSWORD`; any username works.

## How I used AI

I used Claude Code to read the Chord API docs, review the design, write the code and docs, and run test conversations through Chord's chat API. I chose the problem, made the product decisions (both payment paths, front desk approval, what to leave out), and paid the Paystack test links myself.
