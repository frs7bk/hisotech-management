import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { 
  products, masterAccounts, subscriptions, revenues, expenses, invoices, notifications,
  type Product, type InsertProduct,
  type MasterAccount, type InsertMasterAccount,
  type Subscription, type InsertSubscription,
  type Revenue, type InsertRevenue,
  type Expense, type InsertExpense,
  type Invoice, type InsertInvoice,
  type Notification, type InsertNotification,
} from "@shared/schema";
import { eq, and, gte, lte, like, or, desc, sql } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getMasterAccounts(productId?: string): Promise<MasterAccount[]>;
  getMasterAccount(id: string): Promise<MasterAccount | undefined>;
  createMasterAccount(account: InsertMasterAccount): Promise<MasterAccount>;
  updateMasterAccount(id: string, account: Partial<InsertMasterAccount>): Promise<MasterAccount | undefined>;
  deleteMasterAccount(id: string): Promise<boolean>;
  
  getSubscriptions(filters?: { productId?: string; masterAccountId?: string; status?: string }): Promise<Subscription[]>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string): Promise<boolean>;
  deleteExpiredSubscriptions(daysOld: number): Promise<number>;
  
  getRevenues(filters?: { productId?: string; startDate?: Date; endDate?: Date }): Promise<Revenue[]>;
  createRevenue(revenue: InsertRevenue): Promise<Revenue>;
  deleteRevenue(id: string): Promise<boolean>;
  
  getExpenses(filters?: { productId?: string; startDate?: Date; endDate?: Date; isPaid?: boolean }): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getInvoices(filters?: { status?: string }): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  getNotifications(isRead?: boolean): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, notification: Partial<InsertNotification>): Promise<Notification | undefined>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;
  
  search(query: string): Promise<{
    products: Product[];
    subscriptions: Subscription[];
    invoices: Invoice[];
  }>;
}

export class DbStorage implements IStorage {
  private calculateSubscriptionStatus(endDate: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    const dayDiff = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff < 0) {
      return "expired";
    } else if (dayDiff <= 1) {
      return "expiring_soon";
    }
    return "active";
  }

  private updateSubscriptionStatus(subscription: Subscription): Subscription {
    const status = this.calculateSubscriptionStatus(subscription.endDate);
    return {
      ...subscription,
      status: status as any,
    };
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return true;
  }

  async getMasterAccounts(productId?: string): Promise<MasterAccount[]> {
    if (productId) {
      return await db.select().from(masterAccounts).where(eq(masterAccounts.productId, productId)).orderBy(desc(masterAccounts.createdAt));
    }
    return await db.select().from(masterAccounts).orderBy(desc(masterAccounts.createdAt));
  }

  async getMasterAccount(id: string): Promise<MasterAccount | undefined> {
    const result = await db.select().from(masterAccounts).where(eq(masterAccounts.id, id));
    return result[0];
  }

  async createMasterAccount(account: InsertMasterAccount): Promise<MasterAccount> {
    const result = await db.insert(masterAccounts).values(account).returning();
    return result[0];
  }

  async updateMasterAccount(id: string, account: Partial<InsertMasterAccount>): Promise<MasterAccount | undefined> {
    const result = await db.update(masterAccounts).set(account).where(eq(masterAccounts.id, id)).returning();
    return result[0];
  }

  async deleteMasterAccount(id: string): Promise<boolean> {
    await db.delete(masterAccounts).where(eq(masterAccounts.id, id));
    return true;
  }

  async getSubscriptions(filters?: { productId?: string; masterAccountId?: string; status?: string }): Promise<Subscription[]> {
    const conditions = [];
    if (filters?.productId) conditions.push(eq(subscriptions.productId, filters.productId));
    if (filters?.masterAccountId) conditions.push(eq(subscriptions.masterAccountId, filters.masterAccountId));
    
    let query = db.select().from(subscriptions);
    if (conditions.length > 0) {
      query = conditions.length === 1 ? query.where(conditions[0]) : query.where(and(...conditions));
    }
    
    const subs = await query.orderBy(desc(subscriptions.createdAt));
    
    // Calculate and update status based on endDate
    const updatedSubs = subs.map(sub => this.updateSubscriptionStatus(sub));
    
    // Filter by status after updating
    if (filters?.status && filters.status !== "all") {
      return updatedSubs.filter(sub => sub.status === filters.status);
    }
    
    return updatedSubs;
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    if (result[0]) {
      return this.updateSubscriptionStatus(result[0]);
    }
    return undefined;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(subscription).returning();
    
    await db.update(masterAccounts)
      .set({ currentUsage: sql`${masterAccounts.currentUsage} + 1` })
      .where(eq(masterAccounts.id, subscription.masterAccountId));
    
    return this.updateSubscriptionStatus(result[0]);
  }

  async updateSubscription(id: string, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const oldSub = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    const oldSubData = oldSub[0];
    
    const result = await db.update(subscriptions).set({
      ...subscription,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, id)).returning();
    
    if (subscription.masterAccountId && oldSubData && subscription.masterAccountId !== oldSubData.masterAccountId) {
      await db.update(masterAccounts)
        .set({ currentUsage: sql`${masterAccounts.currentUsage} - 1` })
        .where(eq(masterAccounts.id, oldSubData.masterAccountId));
      
      await db.update(masterAccounts)
        .set({ currentUsage: sql`${masterAccounts.currentUsage} + 1` })
        .where(eq(masterAccounts.id, subscription.masterAccountId));
    }
    
    if (result[0]) {
      return this.updateSubscriptionStatus(result[0]);
    }
    return undefined;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    const subscription = await this.getSubscription(id);
    if (!subscription) return false;
    
    await db.delete(subscriptions).where(eq(subscriptions.id, id));
    
    await db.update(masterAccounts)
      .set({ currentUsage: sql`${masterAccounts.currentUsage} - 1` })
      .where(eq(masterAccounts.id, subscription.masterAccountId));
    
    return true;
  }

  async deleteExpiredSubscriptions(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const expiredSubs = await db.select().from(subscriptions)
      .where(lte(subscriptions.endDate, cutoffDate));
    
    for (const sub of expiredSubs) {
      await db.update(masterAccounts)
        .set({ currentUsage: sql`${masterAccounts.currentUsage} - 1` })
        .where(eq(masterAccounts.id, sub.masterAccountId));
    }
    
    const result = await db.delete(subscriptions)
      .where(lte(subscriptions.endDate, cutoffDate));
    
    return expiredSubs.length;
  }

  async getRevenues(filters?: { productId?: string; startDate?: Date; endDate?: Date }): Promise<Revenue[]> {
    let query = db.select().from(revenues);
    
    if (filters?.productId || filters?.startDate || filters?.endDate) {
      const conditions = [];
      if (filters.productId) conditions.push(eq(revenues.productId, filters.productId));
      if (filters.startDate) conditions.push(gte(revenues.date, filters.startDate));
      if (filters.endDate) conditions.push(lte(revenues.date, filters.endDate));
      
      return await query.where(and(...conditions)).orderBy(desc(revenues.date));
    }
    
    return await query.orderBy(desc(revenues.date));
  }

  async createRevenue(revenue: InsertRevenue): Promise<Revenue> {
    const result = await db.insert(revenues).values(revenue).returning();
    return result[0];
  }

  async deleteRevenue(id: string): Promise<boolean> {
    await db.delete(revenues).where(eq(revenues.id, id));
    return true;
  }

  async getExpenses(filters?: { productId?: string; startDate?: Date; endDate?: Date; isPaid?: boolean }): Promise<Expense[]> {
    let query = db.select().from(expenses);
    
    if (filters?.productId || filters?.startDate || filters?.endDate || filters?.isPaid !== undefined) {
      const conditions = [];
      if (filters.productId) conditions.push(eq(expenses.productId, filters.productId));
      if (filters.startDate) conditions.push(gte(expenses.date, filters.startDate));
      if (filters.endDate) conditions.push(lte(expenses.date, filters.endDate));
      if (filters.isPaid !== undefined) conditions.push(eq(expenses.isPaid, filters.isPaid));
      
      return await query.where(and(...conditions)).orderBy(desc(expenses.date));
    }
    
    return await query.orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(expense).returning();
    return result[0];
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses).set(expense).where(eq(expenses.id, id)).returning();
    return result[0];
  }

  async deleteExpense(id: string): Promise<boolean> {
    await db.delete(expenses).where(eq(expenses.id, id));
    return true;
  }

  async getInvoices(filters?: { status?: string }): Promise<Invoice[]> {
    if (filters?.status) {
      return await db.select().from(invoices).where(eq(invoices.status, filters.status as any)).orderBy(desc(invoices.createdAt));
    }
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values(invoice).returning();
    return result[0];
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const result = await db.update(invoices).set(invoice).where(eq(invoices.id, id)).returning();
    return result[0];
  }

  async deleteInvoice(id: string): Promise<boolean> {
    await db.delete(invoices).where(eq(invoices.id, id));
    return true;
  }

  async getNotifications(isRead?: boolean): Promise<Notification[]> {
    if (isRead !== undefined) {
      return await db.select().from(notifications).where(eq(notifications.isRead, isRead)).orderBy(desc(notifications.createdAt));
    }
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async updateNotification(id: string, notification: Partial<InsertNotification>): Promise<Notification | undefined> {
    const result = await db.update(notifications).set(notification).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    return true;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    await db.delete(notifications).where(eq(notifications.id, id));
    return true;
  }

  async search(query: string): Promise<{ products: Product[]; subscriptions: Subscription[]; invoices: Invoice[] }> {
    const searchPattern = `%${query}%`;
    
    const productsResults = await db.select().from(products)
      .where(or(
        like(products.name, searchPattern),
        like(products.description, searchPattern)
      ));
    
    const subscriptionsResults = await db.select().from(subscriptions)
      .where(or(
        like(subscriptions.customerName, searchPattern),
        like(subscriptions.customerEmail, searchPattern),
        like(subscriptions.customerWhatsapp, searchPattern)
      ));
    
    const invoicesResults = await db.select().from(invoices)
      .where(or(
        like(invoices.invoiceNumber, searchPattern),
        like(invoices.customerName, searchPattern),
        like(invoices.customerEmail, searchPattern)
      ));
    
    return {
      products: productsResults,
      subscriptions: subscriptionsResults,
      invoices: invoicesResults,
    };
  }
}

export const storage = new DbStorage();
