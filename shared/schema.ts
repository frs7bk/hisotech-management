import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const productStatusEnum = pgEnum("product_status", ["active", "inactive"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expiring_soon", "expired"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["paid", "unpaid", "overdue"]);
export const expenseFrequencyEnum = pgEnum("expense_frequency", ["one_time", "monthly", "yearly"]);
export const notificationTypeEnum = pgEnum("notification_type", ["subscription_expiring", "account_capacity", "expense_due", "invoice_unpaid"]);

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  standardPrice: decimal("standard_price", { precision: 10, scale: 2 }).notNull(),
  planType: text("plan_type").notNull(),
  status: productStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const masterAccounts = pgTable("master_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  accountName: text("account_name").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  currentUsage: integer("current_usage").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  masterAccountId: varchar("master_account_id").notNull().references(() => masterAccounts.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerWhatsapp: text("customer_whatsapp"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  couponCode: text("coupon_code"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const revenues = pgTable("revenues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  description: text("description").notNull(),
  type: text("type").notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  category: text("category").notNull(),
  description: text("description").notNull(),
  frequency: expenseFrequencyEnum("frequency").notNull().default("one_time"),
  dueDate: timestamp("due_date"),
  isPaid: boolean("is_paid").notNull().default(false),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: invoiceStatusEnum("status").notNull().default("unpaid"),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertMasterAccountSchema = createInsertSchema(masterAccounts).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRevenueSchema = createInsertSchema(revenues).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertMasterAccount = z.infer<typeof insertMasterAccountSchema>;
export type MasterAccount = typeof masterAccounts.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertRevenue = z.infer<typeof insertRevenueSchema>;
export type Revenue = typeof revenues.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
