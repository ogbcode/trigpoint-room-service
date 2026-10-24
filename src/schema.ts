import { eq } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  Department,
  FIRST_ORDER_NUMBER,
  MAX_EMAIL_LENGTH,
  MAX_ITEM_ID_LENGTH,
  MAX_ITEM_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PAYMENT_REFERENCE_LENGTH,
  MAX_ROOM_NUMBER_LENGTH,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StayStatus,
} from './constants.js';

export const departmentEnum = pgEnum('department', Department);
export const stayStatusEnum = pgEnum('stay_status', StayStatus);
export const paymentMethodEnum = pgEnum('payment_method', PaymentMethod);
export const orderStatusEnum = pgEnum('order_status', OrderStatus);
export const paymentStatusEnum = pgEnum('payment_status', PaymentStatus);

export const stays = pgTable('stays', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  roomNumber: varchar('room_number', { length: MAX_ROOM_NUMBER_LENGTH }).notNull(),
  firstName: varchar('first_name', { length: MAX_NAME_LENGTH }).notNull(),
  surname: varchar('surname', { length: MAX_NAME_LENGTH }).notNull(),
  email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull(),
  status: stayStatusEnum('status').notNull(),
});

export const chargeCodes = pgTable('charge_codes', {
  id: varchar('id', { length: MAX_ITEM_ID_LENGTH }).primaryKey(),
  name: varchar('name', { length: MAX_ITEM_NAME_LENGTH }).notNull(),
  department: departmentEnum('department').notNull(),
  priceKobo: integer('price_kobo').notNull(),
  available: boolean('available').notNull(),
});

export const salesOrders = pgTable(
  'sales_orders',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity({ startWith: FIRST_ORDER_NUMBER }),
    stayId: integer('stay_id')
      .notNull()
      .references(() => stays.id),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: orderStatusEnum('status').notNull(),
    itemsKey: text('items_key').notNull(),
    totalKobo: integer('total_kobo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [index('sales_orders_stay_idx').on(table.stayId), index('sales_orders_status_idx').on(table.status)],
);

export const salesOrderItems = pgTable(
  'sales_order_items',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => salesOrders.id),
    chargeCodeId: varchar('charge_code_id', { length: MAX_ITEM_ID_LENGTH })
      .notNull()
      .references(() => chargeCodes.id),
    name: varchar('name', { length: MAX_ITEM_NAME_LENGTH }).notNull(),
    department: departmentEnum('department').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceKobo: integer('unit_price_kobo').notNull(),
    note: varchar('note', { length: MAX_NOTE_LENGTH }),
  },
  (table) => [index('sales_order_items_order_idx').on(table.orderId)],
);

export const workOrders = pgTable(
  'work_orders',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => salesOrders.id),
    department: departmentEnum('department').notNull(),
    totalKobo: integer('total_kobo').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('work_orders_order_department_unique').on(table.orderId, table.department)],
);

export const payments = pgTable(
  'payments',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    reference: varchar('reference', { length: MAX_PAYMENT_REFERENCE_LENGTH }).notNull().unique(),
    orderId: integer('order_id')
      .notNull()
      .references(() => salesOrders.id),
    amountKobo: integer('amount_kobo').notNull(),
    status: paymentStatusEnum('status').notNull(),
    authorizationUrl: text('authorization_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    index('payments_order_idx').on(table.orderId),
    uniqueIndex('payments_one_live_link')
      .on(table.orderId)
      .where(eq(table.status, PaymentStatus.PENDING).inlineParams()),
  ],
);

export const folioLines = pgTable('folio_lines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  stayId: integer('stay_id')
    .notNull()
    .references(() => stays.id),
  orderId: integer('order_id')
    .notNull()
    .unique()
    .references(() => salesOrders.id),
  amountKobo: integer('amount_kobo').notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
});
