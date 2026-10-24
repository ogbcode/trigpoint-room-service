import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  MAX_ITEM_ID_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_ORDER_LINES,
  MAX_ORDER_REF_LENGTH,
  MAX_ROOM_NUMBER_LENGTH,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  ORDER_PREFIX,
  PaymentMethod,
  SYSTEM_ERROR,
  Tool,
} from './constants.js';
import { logger } from './logger.js';
import { OrderError, getOrder, listMenu, newPaymentLink, placeOrder, quoteOrder } from './orders.js';

const guest = {
  room_number: z.coerce
    .string()
    .trim()
    .min(1)
    .max(MAX_ROOM_NUMBER_LENGTH)
    .describe('Room number the guest gave, e.g. "204"'),
  surname: z.string().trim().min(1).max(MAX_NAME_LENGTH).describe('Surname on the booking'),
};

const items = z
  .array(
    z.object({
      item_id: z.string().trim().toUpperCase().min(1).max(MAX_ITEM_ID_LENGTH).describe('item_id from get_menu'),
      quantity: z.coerce.number().int().min(1).max(MAX_ITEM_QUANTITY),
      note: z
        .string()
        .trim()
        .max(MAX_NOTE_LENGTH)
        .nullish()
        .describe('How to prepare or serve this item, including any allergy, e.g. "no ice"'),
    }),
  )
  .min(1)
  .max(MAX_ORDER_LINES);

const orderRef = z
  .string()
  .trim()
  .toUpperCase()
  .max(MAX_ORDER_REF_LENGTH)
  .nullish()
  .describe(`Order reference such as "${ORDER_PREFIX}-1004". Leave it out to use the guest's latest order.`);

const toGuest = (args: { room_number: string; surname: string }) => ({
  roomNumber: args.room_number,
  surname: args.surname,
});

const toItems = (list: z.infer<typeof items>) =>
  list.map((item) => ({ itemId: item.item_id, quantity: item.quantity, note: item.note ?? null }));

async function respond(tool: Tool, run: () => unknown) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await run()) }] };
  } catch (error) {
    if (!(error instanceof OrderError)) logger.error({ err: error, tool }, 'Tool failed');
    const text = error instanceof OrderError ? error.message : SYSTEM_ERROR;
    return { content: [{ type: 'text' as const, text }], isError: true };
  }
}

export function createMcpServer() {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

  server.registerTool(
    Tool.GET_MENU,
    {
      description:
        'The room service menu with item_ids, live prices and what is available right now. Call it to match what the guest wants to menu items.',
      annotations: { readOnlyHint: true },
    },
    () => respond(Tool.GET_MENU, listMenu),
  );

  server.registerTool(
    Tool.QUOTE_ORDER,
    {
      description:
        'Prices an order without placing it. Checks the room and surname against guests staying in the hotel and that every item is available, then returns each line and the total to read back to the guest. Call it before asking the guest to confirm.',
      inputSchema: { ...guest, items },
      annotations: { readOnlyHint: true },
    },
    (args) => respond(Tool.QUOTE_ORDER, () => quoteOrder({ ...toGuest(args), items: toItems(args.items) })),
  );

  server.registerTool(
    Tool.PLACE_ORDER,
    {
      description:
        'Places the order once the guest has confirmed the items, the total and how they will pay, and splits it into a kitchen docket and a bar ticket. ' +
        'PAY_NOW returns a Paystack payment link, and the dockets go out once payment is confirmed. ' +
        'ROOM_CHARGE sends the dockets at once and the front desk confirms the charge. ' +
        'Calling it again for the same order returns the order already placed.',
      inputSchema: {
        ...guest,
        items,
        payment: z.enum(PaymentMethod).describe('PAY_NOW for a Paystack payment link, ROOM_CHARGE for the room bill'),
        repeat: z
          .boolean()
          .nullish()
          .describe('True only when the guest wants another order of the same items while the first is still open'),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) =>
      respond(Tool.PLACE_ORDER, () =>
        placeOrder({ ...toGuest(args), items: toItems(args.items), payment: args.payment, repeat: args.repeat === true }),
      ),
  );

  server.registerTool(
    Tool.GET_ORDER,
    {
      description:
        'Where an order is: payment, kitchen docket and bar ticket. Call it when the guest says they have paid or asks about their order. It checks the payment with Paystack and sends a paid order to the kitchen and bar.',
      inputSchema: { ...guest, order_ref: orderRef },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) => respond(Tool.GET_ORDER, () => getOrder({ ...toGuest(args), orderRef: args.order_ref ?? null })),
  );

  server.registerTool(
    Tool.NEW_PAYMENT_LINK,
    {
      description:
        'A payment link for an order whose payment did not go through, or whose room charge the front desk declined. Returns the current link if it can still be used.',
      inputSchema: { ...guest, order_ref: orderRef },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    (args) =>
      respond(Tool.NEW_PAYMENT_LINK, () => newPaymentLink({ ...toGuest(args), orderRef: args.order_ref ?? null })),
  );

  return server;
}
