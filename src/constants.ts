export enum Department {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
}

export enum StayStatus {
  IN_HOUSE = 'IN_HOUSE',
  CHECKED_OUT = 'CHECKED_OUT',
}

export enum PaymentMethod {
  PAY_NOW = 'PAY_NOW',
  ROOM_CHARGE = 'ROOM_CHARGE',
}

export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_ROOM_CHARGE = 'AWAITING_ROOM_CHARGE',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
}

export enum PaystackStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
  REVERSED = 'reversed',
  ONGOING = 'ongoing',
  PENDING = 'pending',
  PROCESSING = 'processing',
  QUEUED = 'queued',
}

export enum RoomChargeDecision {
  ACCEPT = 'accept',
  REJECT = 'reject',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export enum Route {
  HEALTH = '/health',
  MCP = '/mcp',
  PAYSTACK_WEBHOOK = '/paystack/webhook',
  PAYSTACK_CALLBACK = '/paystack/callback',
  BOARD = '/board',
  BOARD_DECISION = '/board/orders/:orderRef/:decision',
}

export enum Tool {
  GET_MENU = 'get_menu',
  QUOTE_ORDER = 'quote_order',
  PLACE_ORDER = 'place_order',
  GET_ORDER = 'get_order',
  NEW_PAYMENT_LINK = 'new_payment_link',
}

export const HOTEL_NAME = 'Trigpoint Hotel';
export const BOT_NAME = 'Trigpoint Room Service';
export const HOTEL_TIMEZONE = 'Africa/Lagos';
export const HOTEL_LOCALE = 'en-NG';
export const CURRENCY = 'NGN';
export const KOBO_PER_NAIRA = 100;
export const ORDER_PREFIX = 'TPH';
export const ORDER_REF_PATTERN = new RegExp(`^${ORDER_PREFIX}-(\\d+)$`);
export const FIRST_ORDER_NUMBER = 1001;
export const DOCKET_NUMBER_DIGITS = 4;
export const MIGRATIONS_FOLDER = './drizzle';
export const DOCKET_PREFIX: Record<Department, string> = {
  [Department.KITCHEN]: 'KIT',
  [Department.BAR]: 'BAR',
};
export const DEPARTMENT_NAME: Record<Department, string> = {
  [Department.KITCHEN]: 'Kitchen',
  [Department.BAR]: 'Bar',
};
export const ITEM_TYPE: Record<Department, string> = {
  [Department.KITCHEN]: 'food',
  [Department.BAR]: 'drink',
};

export const INITIAL_ORDER_STATUS: Record<PaymentMethod, OrderStatus> = {
  [PaymentMethod.PAY_NOW]: OrderStatus.AWAITING_PAYMENT,
  [PaymentMethod.ROOM_CHARGE]: OrderStatus.AWAITING_ROOM_CHARGE,
};
export const IN_PROGRESS_STATUSES = [OrderStatus.AWAITING_PAYMENT, OrderStatus.AWAITING_ROOM_CHARGE, OrderStatus.OPEN];
export const ROOM_CHARGE_OUTCOME: Record<RoomChargeDecision, OrderStatus> = {
  [RoomChargeDecision.ACCEPT]: OrderStatus.CLOSED,
  [RoomChargeDecision.REJECT]: OrderStatus.OPEN,
};

export const PAYSTACK_STATUS: Record<PaystackStatus, PaymentStatus> = {
  [PaystackStatus.SUCCESS]: PaymentStatus.SUCCESS,
  [PaystackStatus.FAILED]: PaymentStatus.FAILED,
  [PaystackStatus.ABANDONED]: PaymentStatus.PENDING,
  [PaystackStatus.REVERSED]: PaymentStatus.REVERSED,
  [PaystackStatus.ONGOING]: PaymentStatus.PENDING,
  [PaystackStatus.PENDING]: PaymentStatus.PENDING,
  [PaystackStatus.PROCESSING]: PaymentStatus.PENDING,
  [PaystackStatus.QUEUED]: PaymentStatus.PENDING,
};
export const PAYMENT_STATUS_REPLACES: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PENDING],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.SUCCESS]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.REVERSED]: [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.SUCCESS],
  [PaymentStatus.AMOUNT_MISMATCH]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
};
export const SETTLED_PAYMENT_STATUSES = [PaymentStatus.SUCCESS, PaymentStatus.REVERSED, PaymentStatus.AMOUNT_MISMATCH];
export const UNSETTLED_PAYMENT_STATUSES = [PaymentStatus.PENDING, PaymentStatus.FAILED];

export const MAX_ROOM_NUMBER_LENGTH = 10;
export const MAX_NAME_LENGTH = 60;
export const MAX_EMAIL_LENGTH = 120;
export const MAX_ITEM_ID_LENGTH = 40;
export const MAX_ITEM_NAME_LENGTH = 80;
export const MAX_ORDER_REF_LENGTH = 20;
export const MAX_PAYMENT_REFERENCE_LENGTH = 60;
export const MAX_NOTE_LENGTH = 120;
export const MAX_ITEM_QUANTITY = 20;
export const MAX_ORDER_LINES = 20;
export const BOARD_HISTORY_LIMIT = 30;
export const BOARD_REFRESH_MS = 5000;
export const BOARD_AUTH_REALM = `${HOTEL_NAME} board`;
export const DEFAULT_PORT = 3000;
export const DEFAULT_LOG_LEVEL = 'info';

export const PAYSTACK_BASE_URL = 'https://api.paystack.co';
export const PAYSTACK_TIMEOUT_MS = 15000;
export const PAYSTACK_TEST_KEY_PREFIX = 'sk_test_';
export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature';
export const PAYMENT_REFERENCE_SUFFIX_BYTES = 3;

export const MCP_SERVER_NAME = BOT_NAME;
export const MCP_SERVER_VERSION = '1.0.0';
export const CHORD_BASE_URL = 'https://api.chordhq.xyz';
export const SKILL_DIR = 'skill/room-service';
export const SKILL_ENTRYPOINT = 'SKILL.md';
export const SKILL_NAME = BOT_NAME;
export const SKILL_PUBLISH_SUMMARY = 'Published from the repo';
export const CHORD_MCP_SERVER = {
  name: MCP_SERVER_NAME,
  auth_type: 'bearer',
  transport: 'streamable_http',
};
export const CHORD_TEAMMATE_ACTIVATION = { action: 'activate' };
export const CHORD_TEAMMATE = {
  email: 'room-service@trigpoint.chord',
  first_name: 'Trigpoint',
  last_name: 'Room Service',
  display_name: BOT_NAME,
  role: 'customer_support',
  autonomy: 'autonomous',
  capabilities: {
    suggest_responses: true,
    draft_comms: true,
    execute_routine: true,
    escalate_ambiguous: false,
    own_end_to_end: true,
  },
  escalation_policy: 'auto_respond',
  confidence_threshold: 0.3,
};

export const ORDER_STATUS_TEXT: Record<Exclude<OrderStatus, OrderStatus.CLOSED>, string> = {
  [OrderStatus.AWAITING_PAYMENT]: 'Waiting for payment by link.',
  [OrderStatus.AWAITING_ROOM_CHARGE]: 'On the room bill. Waiting for the front desk to confirm it.',
  [OrderStatus.OPEN]: `The front desk declined the room charge. The kitchen and bar already have the order, so it needs paying by link. Call ${Tool.NEW_PAYMENT_LINK} and send the guest the link.`,
};
export const CLOSED_STATUS_TEXT: Record<PaymentMethod, string> = {
  [PaymentMethod.PAY_NOW]: 'Paid by link.',
  [PaymentMethod.ROOM_CHARGE]: 'The front desk confirmed the charge. It is on the room bill, paid at checkout.',
};
export const PAYMENT_STATUS_TEXT: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]:
    'Paystack has not confirmed a payment yet. If the guest says they have paid, ask them to give it a minute and ask again. Otherwise they can use the payment link.',
  [PaymentStatus.SUCCESS]: 'Paid.',
  [PaymentStatus.FAILED]: `The payment did not go through. Call ${Tool.NEW_PAYMENT_LINK} for a fresh link.`,
  [PaymentStatus.REVERSED]: 'The payment was reversed. Ask the guest to dial 0 for the front desk.',
  [PaymentStatus.AMOUNT_MISMATCH]: 'There is a problem with this payment. Ask the guest to dial 0 for the front desk.',
};
export const PAYMENT_PAGE_TEXT: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]:
    'We have not received the payment yet. If you paid, give it a minute, then ask for your order status on WhatsApp.',
  [PaymentStatus.SUCCESS]: 'Payment received. Your order is with the kitchen and bar. You can go back to WhatsApp.',
  [PaymentStatus.FAILED]: 'The payment did not go through. Go back to WhatsApp and ask for a new link.',
  [PaymentStatus.REVERSED]: 'This payment was reversed. Please dial 0 for the front desk.',
  [PaymentStatus.AMOUNT_MISMATCH]: 'There is a problem with this payment. Please dial 0 for the front desk.',
};
export const PAYMENT_METHOD_TEXT: Record<PaymentMethod, string> = {
  [PaymentMethod.PAY_NOW]: 'pay by link',
  [PaymentMethod.ROOM_CHARGE]: 'go on the room bill',
};
export const DOCKETS_NOT_SENT = 'Not sent yet. The kitchen and bar get the order as soon as payment is confirmed.';
export const NO_PAYMENT_LINK = `No payment link yet. Call ${Tool.NEW_PAYMENT_LINK} to create one.`;
export const ALREADY_PLACED = `This order was already placed, so nothing new was created. If the guest wants another order of the same items, call ${Tool.PLACE_ORDER} again with repeat set to true.`;

export const BOARD_PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PaymentMethod.PAY_NOW]: 'Paystack',
  [PaymentMethod.ROOM_CHARGE]: 'Room charge',
};
export const BOARD_ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.AWAITING_PAYMENT]: 'Awaiting payment',
  [OrderStatus.AWAITING_ROOM_CHARGE]: 'Awaiting front desk',
  [OrderStatus.OPEN]: 'Room charge declined',
  [OrderStatus.CLOSED]: 'Settled',
};
export const BOARD_PAYMENT_LABEL: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Not paid',
  [PaymentStatus.SUCCESS]: 'Paid',
  [PaymentStatus.FAILED]: 'Failed',
  [PaymentStatus.REVERSED]: 'Reversed',
  [PaymentStatus.AMOUNT_MISMATCH]: 'Amount mismatch',
};
export const BOARD_REFUND_NEEDED = 'paid twice, refund needed';

export const GUEST_NOT_FOUND =
  'No guest is staying in that room. Ask the guest to check their room number. If they give the same room again, ask them to dial 0 for the front desk.';
export const ORDER_NOT_FOUND = `This guest has no order with that reference. Call ${Tool.GET_ORDER} without order_ref to see their latest order.`;
export const NO_ORDERS = 'This guest has no room service orders yet.';
export const ORDER_SETTLED = `This order is already settled. Call ${Tool.GET_ORDER} to tell the guest where it is.`;
export const ROOM_CHARGE_IN_REVIEW =
  'This order is on the room bill and waiting for the front desk, so no payment link is needed.';
export const PAYMENT_CHECK_FAILED =
  'Could not reach Paystack to check the payment. Ask the guest to try again in a minute.';
export const NOT_AWAITING_ROOM_CHARGE = 'This order is not waiting for a room charge decision.';
export const GUEST_CHECKED_OUT = 'The guest has checked out, so the charge cannot go on the room bill. Reject it instead.';
export const PAYMENT_NOT_FOUND = 'We could not find this payment.';
export const SYSTEM_ERROR =
  'Something went wrong on the hotel system. Apologise, and ask the guest to dial 0 for the front desk if it is urgent.';
export const itemNotOnMenu = (itemId: string) =>
  `No menu item has the item_id "${itemId}". Call ${Tool.GET_MENU} and use the item_id exactly as listed. Do not tell the guest about this.`;
export const itemSoldOut = (name: string) => `${name} is sold out right now. Ask the guest to choose something else.`;
export const paymentLinkFailed = (orderRef: string) =>
  `Order ${orderRef} is saved, but the payment link could not be created. Give the guest the order reference and ask them to message again in a minute for the link. If it fails again, ask them to dial 0 for the front desk.`;
export const paymentPageMessage = (orderRef: string, status: PaymentStatus) =>
  `Order ${orderRef}. ${PAYMENT_PAGE_TEXT[status]}`;
export const paymentMethodLocked = (orderRef: string, method: PaymentMethod) =>
  `Order ${orderRef} with these items is already placed to ${PAYMENT_METHOD_TEXT[method]}, and that cannot be switched on WhatsApp. Call ${Tool.GET_ORDER} to tell the guest where it is, or they can dial 0 for the front desk.`;
