import { supabase } from "./supabase";
import {
  type Product, type InsertProduct,
  type MasterAccount, type InsertMasterAccount,
  type Subscription, type InsertSubscription,
  type Revenue, type InsertRevenue,
  type Expense, type InsertExpense,
  type Invoice, type InsertInvoice,
  type Notification, type InsertNotification,
} from "@shared/schema";

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

export class SupabaseStorage implements IStorage {
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
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getMasterAccounts(productId?: string): Promise<MasterAccount[]> {
    let query = supabase
      .from('master_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getMasterAccount(id: string): Promise<MasterAccount | undefined> {
    const { data, error } = await supabase
      .from('master_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async createMasterAccount(account: InsertMasterAccount): Promise<MasterAccount> {
    const { data, error } = await supabase
      .from('master_accounts')
      .insert(account)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateMasterAccount(id: string, account: Partial<InsertMasterAccount>): Promise<MasterAccount | undefined> {
    const { data, error } = await supabase
      .from('master_accounts')
      .update(account)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async deleteMasterAccount(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('master_accounts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getSubscriptions(filters?: { productId?: string; masterAccountId?: string; status?: string }): Promise<Subscription[]> {
    let query = supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters?.masterAccountId) {
      query = query.eq('master_account_id', filters.masterAccountId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const subs = data || [];
    const updatedSubs = subs.map(sub => this.updateSubscriptionStatus(sub as any));

    if (filters?.status && filters.status !== "all") {
      return updatedSubs.filter(sub => sub.status === filters.status);
    }

    return updatedSubs;
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      return this.updateSubscriptionStatus(data as any);
    }
    return undefined;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscription)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { error: updateError } = await supabase.rpc('increment_master_account_usage', {
      account_id: subscription.masterAccountId
    });

    if (updateError) console.error('Error updating master account usage:', updateError);

    return this.updateSubscriptionStatus(data as any);
  }

  async updateSubscription(id: string, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const oldSub = await this.getSubscription(id);

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        ...subscription,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (subscription.masterAccountId && oldSub && subscription.masterAccountId !== oldSub.masterAccountId) {
      await supabase.rpc('decrement_master_account_usage', {
        account_id: oldSub.masterAccountId
      });

      await supabase.rpc('increment_master_account_usage', {
        account_id: subscription.masterAccountId
      });
    }

    if (data) {
      return this.updateSubscriptionStatus(data as any);
    }
    return undefined;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    const subscription = await this.getSubscription(id);
    if (!subscription) return false;

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await supabase.rpc('decrement_master_account_usage', {
      account_id: subscription.masterAccountId
    });

    return true;
  }

  async deleteExpiredSubscriptions(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data: expiredSubs, error: selectError } = await supabase
      .from('subscriptions')
      .select('*')
      .lte('end_date', cutoffDate.toISOString());

    if (selectError) throw new Error(selectError.message);

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        await this.deleteSubscription(sub.id);
      }
      return expiredSubs.length;
    }

    return 0;
  }

  async getRevenues(filters?: { productId?: string; startDate?: Date; endDate?: Date }): Promise<Revenue[]> {
    let query = supabase
      .from('revenues')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async createRevenue(revenue: InsertRevenue): Promise<Revenue> {
    const { data, error } = await supabase
      .from('revenues')
      .insert(revenue)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteRevenue(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('revenues')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getExpenses(filters?: { productId?: string; startDate?: Date; endDate?: Date; isPaid?: boolean }): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString());
    }
    if (filters?.isPaid !== undefined) {
      query = query.eq('is_paid', filters.isPaid);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const { data, error } = await supabase
      .from('expenses')
      .update(expense)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getInvoices(filters?: { status?: string }): Promise<Invoice[]> {
    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const { data, error } = await supabase
      .from('invoices')
      .update(invoice)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getNotifications(isRead?: boolean): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (isRead !== undefined) {
      query = query.eq('is_read', isRead);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateNotification(id: string, notification: Partial<InsertNotification>): Promise<Notification | undefined> {
    const { data, error } = await supabase
      .from('notifications')
      .update(notification)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data || undefined;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) throw new Error(error.message);
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async search(query: string): Promise<{ products: Product[]; subscriptions: Subscription[]; invoices: Invoice[] }> {
    const searchPattern = `%${query}%`;

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);

    const { data: subscriptionsData } = await supabase
      .from('subscriptions')
      .select('*')
      .or(`customer_name.ilike.${searchPattern},customer_email.ilike.${searchPattern},customer_whatsapp.ilike.${searchPattern}`);

    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*')
      .or(`invoice_number.ilike.${searchPattern},customer_name.ilike.${searchPattern},customer_email.ilike.${searchPattern}`);

    return {
      products: productsData || [],
      subscriptions: subscriptionsData || [],
      invoices: invoicesData || [],
    };
  }
}

export const storage = new SupabaseStorage();
