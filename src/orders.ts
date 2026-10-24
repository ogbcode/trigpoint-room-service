import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { type Transaction, db } from './db.js';
import { logger } from './logger.js';
import { initializeTransaction, verifyTransaction } from './paystack.js';
import { chargeCodes, folioLines, payments, salesOrderItems, salesOrders, stays, workOrders } from './schema.js';
import {
  ALREADY_PLACED,
  BOARD_HISTORY_LIMIT,
  CLOSED_STATUS_TEXT,
  CURRENCY,
  DEPARTMENT_NAME,
  DOCKET_NUMBER_DIGITS,
  DOCKET_PREFIX,
  DOCKETS_NOT_SENT,
  Department,
  GUEST_CHECKED_OUT,
  GUEST_NOT_FOUND,
  HOTEL_LOCALE,
  INITIAL_ORDER_STATUS,
  IN_PROGRESS_STATUSES,
  ITEM_TYPE,
  KOBO_PER_NAIRA,
  NOT_AWAITING_ROOM_CHARGE,
  NO_ORDERS,
  NO_PAYMENT_LINK,
  ORDER_NOT_FOUND,
  ORDER_PREFIX,
  ORDER_REF_PATTERN,
  ORDER_SETTLED,
  ORDER_STATUS_TEXT,
  OrderStatus,
  PAYMENT_CHECK_FAILED,
  PAYMENT_NOT_FOUND,
  PAYMENT_PAGE_TEXT,
  PAYMENT_REFERENCE_SUFFIX_BYTES,
  PAYMENT_STATUS_REPLACES,
  PAYMENT_STATUS_TEXT,
  PaymentMethod,
  PaymentStatus,
  ROOM_CHARGE_IN_REVIEW,
  ROOM_CHARGE_OUTCOME,
  RoomChargeDecision,
  SETTLED_PAYMENT_STATUSES,
  StayStatus,
  UNSETTLED_PAYMENT_STATUSES,
  itemNotOnMenu,
  itemSoldOut,
  paymentLinkFailed,
  paymentMethodLocked,
  paymentPageMessage,
} from './constants.js';

export class OrderError extends Error {}

type Executor = typeof db | Transaction;
type Stay = typeof stays.$inferSelect;
type Order = typeof salesOrders.$inferSelect;
type OrderItem = typeof salesOrderItems.$inferSelect;
type Payment = typeof payments.$inferSelect;

interface GuestInput {
  roomNumber: string;
}

interface ItemInput {
  itemId: string;
  quantity: number;
  note: string | null;
}

interface QuoteInput extends GuestInput {
  items: ItemInput[];
}

interface OrderInput extends QuoteInput {
  payment: PaymentMethod;
  repeat: boolean;
}

interface OrderLookup extends GuestInput {
  orderRef: string | null;
}

interface PricedLine {
  chargeCodeId: string;
  name: string;
  department: Department;
  quantity: number;
  unitPriceKobo: number;
  note: string | null;
}

export interface BoardDocket {
  ref: string;
  department: Department;
  totalKobo: number;
  createdAt: Date;
  orderRef: string;
  roomNumber: string;
  items: OrderItem[];
}

export interface BoardOrder {
  ref: string;
  roomNumber: string;
  guest: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  totalKobo: number;
  kitchenKobo: number;
  barKobo: number;
  paymentStatus: PaymentStatus | null;
  refundNeeded: boolean;
  createdAt: Date;
}

export interface BoardData {
  dockets: BoardDocket[];
  roomCharges: BoardOrder[];
  orders: BoardOrder[];
}

const naira = new Intl.NumberFormat(HOTEL_LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatNaira = (kobo: number) => naira.format(kobo / KOBO_PER_NAIRA);

const orderRef = (orderId: number) => `${ORDER_PREFIX}-${orderId}`;

const docketRef = (department: Department, docketId: number) =>
  `${DOCKET_PREFIX[department]}-${String(docketId).padStart(DOCKET_NUMBER_DIGITS, '0')}`;

function orderIdFromRef(ref: string) {
  const match = ORDER_REF_PATTERN.exec(ref.toUpperCase());
  return match ? Number(match[1]) : null;
}

const lineTotal = (line: PricedLine) => line.quantity * line.unitPriceKobo;

const sumLines = (lines: PricedLine[]) => lines.reduce((sum, line) => sum + lineTotal(line), 0);

const departmentTotal = (lines: PricedLine[], department: Department) =>
  sumLines(lines.filter((line) => line.department === department));

function assertNever(value: never): never {
  throw new Error(`Unhandled value ${String(value)}`);
}

const currentPayment = (newestFirst: Payment[]) =>
  newestFirst.find((payment) => SETTLED_PAYMENT_STATUSES.includes(payment.status)) ?? newestFirst[0];

function summarize(lines: PricedLine[]) {
  return {
    items: lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      amount: formatNaira(lineTotal(line)),
      ...(line.note ? { note: line.note } : {}),
    })),
    kitchen_total: formatNaira(departmentTotal(lines, Department.KITCHEN)),
    bar_total: formatNaira(departmentTotal(lines, Department.BAR)),
    total: formatNaira(sumLines(lines)),
  };
}

async function findInHouseStay(executor: Executor, guest: GuestInput, lock = false) {
  const query = executor
    .select()
    .from(stays)
    .where(and(eq(stays.roomNumber, guest.roomNumber), eq(stays.status, StayStatus.IN_HOUSE)));
  const [stay] = lock ? await query.for('update') : await query;
  if (!stay) throw new OrderError(GUEST_NOT_FOUND);
  return stay;
}

async function priceLines(items: ItemInput[]): Promise<PricedLine[]> {
  const menu = await db
    .select()
    .from(chargeCodes)
    .where(
      inArray(
        chargeCodes.id,
        items.map((item) => item.itemId),
      ),
    );
  return items.map(({ itemId, quantity, note }) => {
    const item = menu.find((candidate) => candidate.id === itemId);
    if (!item) throw new OrderError(itemNotOnMenu(itemId));
    if (!item.available) throw new OrderError(itemSoldOut(item.name));
    return {
      chargeCodeId: item.id,
      name: item.name,
      department: item.department,
      quantity,
      unitPriceKobo: item.priceKobo,
      note,
    };
  });
}

async function findGuestOrder(lookup: OrderLookup) {
  const stay = await findInHouseStay(db, lookup);
  const orderId = lookup.orderRef ? orderIdFromRef(lookup.orderRef) : null;
  if (lookup.orderRef && !orderId) throw new OrderError(ORDER_NOT_FOUND);

  const [order] = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.stayId, stay.id), orderId ? eq(salesOrders.id, orderId) : undefined))
    .orderBy(desc(salesOrders.id))
    .limit(1);
  if (!order) throw new OrderError(lookup.orderRef ? ORDER_NOT_FOUND : NO_ORDERS);
  return { stay, order };
}

async function findCheckedOrder(lookup: OrderLookup) {
  const { stay, order } = await findGuestOrder(lookup);
  if (order.status !== OrderStatus.AWAITING_PAYMENT) return { stay, order };
  if (!(await refreshPayment(order.id))) throw new OrderError(PAYMENT_CHECK_FAILED);
  const [refreshed] = await db.select().from(salesOrders).where(eq(salesOrders.id, order.id));
  return { stay, order: refreshed };
}

async function latestPayment(orderId: number) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.id))
    .limit(1);
  return payment;
}

async function createOrder(
  tx: Transaction,
  stayId: number,
  lines: PricedLine[],
  itemsKey: string,
  payment: PaymentMethod,
) {
  const status = INITIAL_ORDER_STATUS[payment];
  const [order] = await tx
    .insert(salesOrders)
    .values({ stayId, paymentMethod: payment, status, itemsKey, totalKobo: sumLines(lines) })
    .returning();
  await tx.insert(salesOrderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
  if (status === OrderStatus.AWAITING_ROOM_CHARGE) await sendDockets(tx, order.id);
  return order;
}

async function sendDockets(tx: Transaction, orderId: number) {
  const items = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, orderId));
  const departments = [...new Set(items.map((item) => item.department))];
  await tx
    .insert(workOrders)
    .values(departments.map((department) => ({ orderId, department, totalKobo: departmentTotal(items, department) })))
    .onConflictDoNothing();
}

async function ensurePaymentLink(order: Order, email: string) {
  const latest = await latestPayment(order.id);
  if (latest?.status === PaymentStatus.PENDING) return;
  if (latest && latest.status !== PaymentStatus.FAILED) throw new OrderError(PAYMENT_STATUS_TEXT[latest.status]);

  const reference = `${orderRef(order.id)}-${randomBytes(PAYMENT_REFERENCE_SUFFIX_BYTES).toString('hex')}`;
  try {
    const { authorization_url } = await initializeTransaction({ email, amountKobo: order.totalKobo, reference });
    await db
      .insert(payments)
      .values({
        reference,
        orderId: order.id,
        amountKobo: order.totalKobo,
        status: PaymentStatus.PENDING,
        authorizationUrl: authorization_url,
      })
      .onConflictDoNothing();
  } catch (error) {
    logger.error({ err: error, reference }, 'Could not create payment link');
    throw new OrderError(paymentLinkFailed(orderRef(order.id)));
  }
}

async function checkPayment(reference: string) {
  try {
    return await settlePayment(reference);
  } catch (error) {
    logger.warn({ err: error, reference }, 'Could not check payment with Paystack');
    return null;
  }
}

async function refreshPayment(orderId: number) {
  const unsettled = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), inArray(payments.status, UNSETTLED_PAYMENT_STATUSES)));
  const results = await Promise.all(unsettled.map((payment) => checkPayment(payment.reference)));
  return results.every((result) => result !== null);
}

async function describeOrder(orderId: number) {
  const [[{ sales_orders: order, stays: stay }], items, dockets, orderPayments] = await Promise.all([
    db.select().from(salesOrders).innerJoin(stays, eq(stays.id, salesOrders.stayId)).where(eq(salesOrders.id, orderId)),
    db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, orderId)).orderBy(salesOrderItems.id),
    db.select().from(workOrders).where(eq(workOrders.orderId, orderId)).orderBy(workOrders.id),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.id)),
  ]);
  const payment = currentPayment(orderPayments);
  const linkIsLive = order.status === OrderStatus.AWAITING_PAYMENT && payment?.status === PaymentStatus.PENDING;

  return {
    order_ref: orderRef(order.id),
    guest: stay.firstName,
    room: stay.roomNumber,
    status:
      order.status === OrderStatus.CLOSED ? CLOSED_STATUS_TEXT[order.paymentMethod] : ORDER_STATUS_TEXT[order.status],
    ...summarize(items),
    kitchen_and_bar: dockets.length
      ? dockets.map(
          (docket) =>
            `${DEPARTMENT_NAME[docket.department]} ${docketRef(docket.department, docket.id)}, ${formatNaira(docket.totalKobo)}`,
        )
      : DOCKETS_NOT_SENT,
    ...(order.paymentMethod === PaymentMethod.PAY_NOW
      ? { payment: payment ? PAYMENT_STATUS_TEXT[payment.status] : NO_PAYMENT_LINK }
      : {}),
    ...(linkIsLive ? { payment_link: payment.authorizationUrl } : {}),
  };
}

export async function listMenu() {
  const menu = await db.select().from(chargeCodes).orderBy(chargeCodes.department, chargeCodes.name);
  return menu.map((item) => ({
    item_id: item.id,
    name: item.name,
    type: ITEM_TYPE[item.department],
    price: formatNaira(item.priceKobo),
    available: item.available,
  }));
}

export async function quoteOrder(input: QuoteInput) {
  const stay = await findInHouseStay(db, input);
  const lines = await priceLines(input.items);
  return { guest: stay.firstName, room: stay.roomNumber, ...summarize(lines) };
}

export async function placeOrder(input: OrderInput) {
  const lines = await priceLines(input.items);
  const itemsKey = lines
    .map((line) => `${line.chargeCodeId}x${line.quantity}`)
    .sort()
    .join(',');

  const { stay, order, alreadyPlaced } = await db.transaction(async (tx) => {
    const stay = await findInHouseStay(tx, input, true);
    const [existing] = await tx
      .select()
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.stayId, stay.id),
          eq(salesOrders.itemsKey, itemsKey),
          inArray(salesOrders.status, IN_PROGRESS_STATUSES),
        ),
      )
      .orderBy(desc(salesOrders.id))
      .limit(1);
    if (existing && existing.paymentMethod !== input.payment) {
      throw new OrderError(paymentMethodLocked(orderRef(existing.id), existing.paymentMethod));
    }
    if (existing && !input.repeat) return { stay, order: existing, alreadyPlaced: true };
    return { stay, order: await createOrder(tx, stay.id, lines, itemsKey, input.payment), alreadyPlaced: false };
  });

  if (order.status === OrderStatus.AWAITING_PAYMENT) await ensurePaymentLink(order, stay.email);
  return { ...(await describeOrder(order.id)), ...(alreadyPlaced ? { already_placed: ALREADY_PLACED } : {}) };
}

export async function getOrder(lookup: OrderLookup) {
  const { order } = await findCheckedOrder(lookup);
  return describeOrder(order.id);
}

export async function newPaymentLink(lookup: OrderLookup) {
  const { stay, order } = await findCheckedOrder(lookup);
  switch (order.status) {
    case OrderStatus.CLOSED:
      throw new OrderError(ORDER_SETTLED);
    case OrderStatus.AWAITING_ROOM_CHARGE:
      throw new OrderError(ROOM_CHARGE_IN_REVIEW);
    case OrderStatus.AWAITING_PAYMENT:
      break;
    case OrderStatus.OPEN:
      await db
        .update(salesOrders)
        .set({ status: OrderStatus.AWAITING_PAYMENT, paymentMethod: PaymentMethod.PAY_NOW })
        .where(and(eq(salesOrders.id, order.id), eq(salesOrders.status, OrderStatus.OPEN)));
      break;
    default:
      assertNever(order.status);
  }

  await ensurePaymentLink(order, stay.email);
  return describeOrder(order.id);
}

export async function settlePayment(reference: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.reference, reference));
  if (!payment) return undefined;

  const result = await verifyTransaction(reference);
  const paidInFull = result.amountKobo === payment.amountKobo && result.currency === CURRENCY;
  const status = result.status === PaymentStatus.SUCCESS && !paidInFull ? PaymentStatus.AMOUNT_MISMATCH : result.status;
  if (status === PaymentStatus.AMOUNT_MISMATCH) {
    logger.error({ reference, result }, 'Paystack amount does not match the order');
  }

  const settled = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(payments)
      .set({ status, ...(status === PaymentStatus.SUCCESS ? { paidAt: new Date() } : {}) })
      .where(and(eq(payments.reference, reference), inArray(payments.status, PAYMENT_STATUS_REPLACES[status])))
      .returning();
    if (!updated) {
      const [current] = await tx.select().from(payments).where(eq(payments.reference, reference));
      return current.status;
    }
    if (status === PaymentStatus.SUCCESS) {
      const [closed] = await tx
        .update(salesOrders)
        .set({ status: OrderStatus.CLOSED, closedAt: new Date() })
        .where(and(eq(salesOrders.id, payment.orderId), eq(salesOrders.status, OrderStatus.AWAITING_PAYMENT)))
        .returning();
      if (closed) await sendDockets(tx, closed.id);
    }
    return status;
  });

  return { orderRef: orderRef(payment.orderId), status: settled };
}

export async function paymentPageText(reference: string | undefined) {
  if (!reference) return PAYMENT_NOT_FOUND;
  const result = await checkPayment(reference);
  if (result === null) return PAYMENT_PAGE_TEXT[PaymentStatus.PENDING];
  return result ? paymentPageMessage(result.orderRef, result.status) : PAYMENT_NOT_FOUND;
}

export async function decideRoomCharge(ref: string, decision: RoomChargeDecision) {
  const orderId = orderIdFromRef(ref);
  if (!orderId) throw new OrderError(NOT_AWAITING_ROOM_CHARGE);

  await db.transaction(async (tx) => {
    const accepted = decision === RoomChargeDecision.ACCEPT;
    const [order] = await tx
      .update(salesOrders)
      .set({ status: ROOM_CHARGE_OUTCOME[decision], closedAt: accepted ? new Date() : null })
      .where(and(eq(salesOrders.id, orderId), eq(salesOrders.status, OrderStatus.AWAITING_ROOM_CHARGE)))
      .returning();
    if (!order) throw new OrderError(NOT_AWAITING_ROOM_CHARGE);
    if (!accepted) return;

    const [stay] = await tx.select().from(stays).where(eq(stays.id, order.stayId));
    if (stay.status !== StayStatus.IN_HOUSE) throw new OrderError(GUEST_CHECKED_OUT);
    await tx.insert(folioLines).values({ stayId: order.stayId, orderId: order.id, amountKobo: order.totalKobo });
  });
}

export async function boardData(): Promise<BoardData> {
  const ordersWithStay = () =>
    db
      .select({ order: salesOrders, stay: stays })
      .from(salesOrders)
      .innerJoin(stays, eq(stays.id, salesOrders.stayId));

  const [dockets, roomCharges, latestOrders] = await Promise.all([
    db
      .select({ docket: workOrders, stay: stays })
      .from(workOrders)
      .innerJoin(salesOrders, eq(salesOrders.id, workOrders.orderId))
      .innerJoin(stays, eq(stays.id, salesOrders.stayId))
      .orderBy(desc(workOrders.id))
      .limit(BOARD_HISTORY_LIMIT),
    ordersWithStay().where(eq(salesOrders.status, OrderStatus.AWAITING_ROOM_CHARGE)).orderBy(salesOrders.id),
    ordersWithStay().orderBy(desc(salesOrders.id)).limit(BOARD_HISTORY_LIMIT),
  ]);

  const orderIds = [
    ...new Set([
      ...dockets.map(({ docket }) => docket.orderId),
      ...roomCharges.map(({ order }) => order.id),
      ...latestOrders.map(({ order }) => order.id),
    ]),
  ];
  const [items, orderPayments] = orderIds.length
    ? await Promise.all([
        db.select().from(salesOrderItems).where(inArray(salesOrderItems.orderId, orderIds)).orderBy(salesOrderItems.id),
        db.select().from(payments).where(inArray(payments.orderId, orderIds)).orderBy(desc(payments.id)),
      ])
    : [[], []];

  const toBoardOrder = ({ order, stay }: { order: Order; stay: Stay }): BoardOrder => {
    const lines = items.filter((item) => item.orderId === order.id);
    const attempts = orderPayments.filter((payment) => payment.orderId === order.id);
    return {
      ref: orderRef(order.id),
      roomNumber: stay.roomNumber,
      guest: `${stay.firstName} ${stay.surname}`,
      paymentMethod: order.paymentMethod,
      status: order.status,
      totalKobo: order.totalKobo,
      kitchenKobo: departmentTotal(lines, Department.KITCHEN),
      barKobo: departmentTotal(lines, Department.BAR),
      paymentStatus: currentPayment(attempts)?.status ?? null,
      refundNeeded: attempts.filter((payment) => payment.status === PaymentStatus.SUCCESS).length > 1,
      createdAt: order.createdAt,
    };
  };

  return {
    dockets: dockets.map(({ docket, stay }) => ({
      ref: docketRef(docket.department, docket.id),
      department: docket.department,
      totalKobo: docket.totalKobo,
      createdAt: docket.createdAt,
      orderRef: orderRef(docket.orderId),
      roomNumber: stay.roomNumber,
      items: items.filter((item) => item.orderId === docket.orderId && item.department === docket.department),
    })),
    roomCharges: roomCharges.map(toBoardOrder),
    orders: latestOrders.map(toBoardOrder),
  };
}
