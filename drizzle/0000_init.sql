CREATE TYPE "public"."department" AS ENUM('KITCHEN', 'BAR');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('AWAITING_PAYMENT', 'AWAITING_ROOM_CHARGE', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('PAY_NOW', 'ROOM_CHARGE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'AMOUNT_MISMATCH');--> statement-breakpoint
CREATE TYPE "public"."stay_status" AS ENUM('IN_HOUSE', 'CHECKED_OUT');--> statement-breakpoint
CREATE TABLE "charge_codes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"department" "department" NOT NULL,
	"price_kobo" integer NOT NULL,
	"available" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folio_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "folio_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stay_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"amount_kobo" integer NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folio_lines_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reference" varchar(60) NOT NULL,
	"order_id" integer NOT NULL,
	"amount_kobo" integer NOT NULL,
	"status" "payment_status" NOT NULL,
	"authorization_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"charge_code_id" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"department" "department" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_kobo" integer NOT NULL,
	"note" varchar(120)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"stay_id" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "order_status" NOT NULL,
	"items_key" text NOT NULL,
	"total_kobo" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stays" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stays_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"room_number" varchar(10) NOT NULL,
	"first_name" varchar(60) NOT NULL,
	"surname" varchar(60) NOT NULL,
	"email" varchar(120) NOT NULL,
	"status" "stay_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"department" "department" NOT NULL,
	"total_kobo" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_order_department_unique" UNIQUE("order_id","department")
);
--> statement-breakpoint
ALTER TABLE "folio_lines" ADD CONSTRAINT "folio_lines_stay_id_stays_id_fk" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_lines" ADD CONSTRAINT "folio_lines_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_charge_code_id_charge_codes_id_fk" FOREIGN KEY ("charge_code_id") REFERENCES "public"."charge_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_stay_id_stays_id_fk" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_live_link" ON "payments" USING btree ("order_id") WHERE "payments"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "sales_order_items_order_idx" ON "sales_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_orders_stay_idx" ON "sales_orders" USING btree ("stay_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales_orders" USING btree ("status");