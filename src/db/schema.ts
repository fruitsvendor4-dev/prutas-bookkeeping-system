import {
  date,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("vendors_email_unique").on(table.email)],
);

// Purchases, sales and adjustments share one idempotent ledger. Inventory is
// derived from these entries, so syncing a retry cannot add stock twice.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    date: date("date").notNull(),
    fruit: text("fruit"),
    supplier: text("supplier"),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    unitPrice: doublePrecision("unit_price"),
    amount: doublePrecision("amount").notNull().default(0),
    category: text("category"),
    description: text("description"),
    paymentMethod: text("payment_method"),
    capitalAction: text("capital_action"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transactions_vendor_date_idx").on(table.vendorId, table.date),
    index("transactions_vendor_type_idx").on(table.vendorId, table.type),
    index("transactions_vendor_fruit_idx").on(table.vendorId, table.fruit),
  ],
);
