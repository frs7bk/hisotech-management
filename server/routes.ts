import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertMasterAccountSchema, insertSubscriptionSchema, insertRevenueSchema, insertExpenseSchema, insertInvoiceSchema, insertNotificationSchema, type InsertSubscription, type InsertRevenue, type InsertExpense } from "@shared/schema";
import OpenAI from "openai";
import { startNotificationTask } from "./tasks/notifications";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // بدء مهمة الإشعارات الدورية
  startNotificationTask();
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/master-accounts", async (req: Request, res: Response) => {
    try {
      const productId = req.query.productId as string | undefined;
      const accounts = await storage.getMasterAccounts(productId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/master-accounts", async (req: Request, res: Response) => {
    try {
      const data = insertMasterAccountSchema.parse(req.body);
      const account = await storage.createMasterAccount(data);
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/master-accounts/:id", async (req: Request, res: Response) => {
    try {
      const processedData = {
        ...req.body,
        maxCapacity: req.body.maxCapacity ? parseInt(String(req.body.maxCapacity)) : req.body.maxCapacity,
        currentUsage: req.body.currentUsage ? parseInt(String(req.body.currentUsage)) : req.body.currentUsage,
      };
      const account = await storage.updateMasterAccount(req.params.id, processedData);
      if (!account) {
        return res.status(404).json({ error: "الحساب غير موجود" });
      }
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/master-accounts/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteMasterAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "الحساب غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/master-accounts/bulk-delete", async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "يجب توفير قائمة معرفات" });
      }
      for (const id of ids) {
        await storage.deleteMasterAccount(id);
      }
      res.json({ success: true, deletedCount: ids.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/subscriptions", async (req: Request, res: Response) => {
    try {
      const filters = {
        productId: req.query.productId as string | undefined,
        masterAccountId: req.query.masterAccountId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const subscriptions = await storage.getSubscriptions(filters);
      res.json(subscriptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscriptions", async (req: Request, res: Response) => {
    try {
      // تحويل البيانات بشكل آمن
      const body = req.body;
      const processedData = {
        ...body,
        startDate: typeof body.startDate === 'string' ? new Date(body.startDate) : body.startDate,
        endDate: typeof body.endDate === 'string' ? new Date(body.endDate) : body.endDate,
        price: String(body.price),
      };
      
      const data = insertSubscriptionSchema.parse(processedData);
      
      // لا نحتاج لتحويل إضافي - data جاهز للـ database
      const subscriptionData: InsertSubscription = data as any;
      
      const subscription = await storage.createSubscription(subscriptionData);

      await storage.createRevenue({
        productId: data.productId,
        subscriptionId: subscription.id,
        amount: data.price,
        currency: data.currency,
        description: `اشتراك جديد - ${data.customerName}`,
        type: "subscription",
        date: new Date(),
      });

      const account = await storage.getMasterAccount(data.masterAccountId);
      if (account) {
        const percentage = (account.currentUsage / account.maxCapacity) * 100;
        if (percentage >= 80) {
          await storage.createNotification({
            type: "account_capacity",
            title: "تحذير: اقتراب امتلاء الحساب",
            message: `الحساب ${account.accountName} وصل إلى ${percentage.toFixed(0)}% من سعته`,
            relatedId: account.id,
            isRead: false,
          });
        }
      }

      res.json(subscription);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/subscriptions/:id", async (req: Request, res: Response) => {
    try {
      const processedData = {
        ...req.body,
        price: req.body.price ? parseFloat(String(req.body.price)) : req.body.price,
        startDate: req.body.startDate instanceof Date ? req.body.startDate : (req.body.startDate ? new Date(req.body.startDate) : req.body.startDate),
        endDate: req.body.endDate instanceof Date ? req.body.endDate : (req.body.endDate ? new Date(req.body.endDate) : req.body.endDate),
      };
      const subscription = await storage.updateSubscription(req.params.id, processedData);
      if (!subscription) {
        return res.status(404).json({ error: "الاشتراك غير موجود" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/subscriptions/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteSubscription(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "الاشتراك غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscriptions/cleanup/expired", async (req: Request, res: Response) => {
    try {
      const { daysOld } = req.body;
      if (typeof daysOld !== "number" || daysOld < 0) {
        return res.status(400).json({ error: "daysOld يجب أن يكون رقم موجب" });
      }
      const deletedCount = await storage.deleteExpiredSubscriptions(daysOld);
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscriptions/bulk-delete", async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "يجب توفير قائمة معرفات" });
      }
      for (const id of ids) {
        await storage.deleteSubscription(id);
      }
      res.json({ success: true, deletedCount: ids.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscriptions/bulk-update-status", async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "يجب توفير قائمة معرفات" });
      }
      if (!["active", "expiring_soon", "expired"].includes(status)) {
        return res.status(400).json({ error: "حالة غير صحيحة" });
      }
      for (const id of ids) {
        await storage.updateSubscription(id, { status });
      }
      res.json({ success: true, updatedCount: ids.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/revenues", async (req: Request, res: Response) => {
    try {
      const filters = {
        productId: req.query.productId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const revenues = await storage.getRevenues(filters);
      res.json(revenues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/revenues", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const processedData = {
        ...body,
        amount: String(body.amount),
        date: typeof body.date === 'string' ? new Date(body.date) : body.date,
      };
      
      const data = insertRevenueSchema.parse(processedData);
      
      const revenueData: InsertRevenue = data as any;
      
      const revenue = await storage.createRevenue(revenueData);
      res.json(revenue);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/revenues/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteRevenue(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "الإيراد غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/expenses", async (req: Request, res: Response) => {
    try {
      const filters = {
        productId: req.query.productId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        isPaid: req.query.isPaid === "true" ? true : req.query.isPaid === "false" ? false : undefined,
      };
      const expenses = await storage.getExpenses(filters);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const processedData = {
        ...body,
        amount: String(body.amount),
        date: typeof body.date === 'string' ? new Date(body.date) : body.date,
        dueDate: body.dueDate ? (typeof body.dueDate === 'string' ? new Date(body.dueDate) : body.dueDate) : undefined,
      };
      
      const data = insertExpenseSchema.parse(processedData);
      
      const expenseData: InsertExpense = data as any;
      
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/expenses/:id", async (req: Request, res: Response) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      if (!expense) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/expenses/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices", async (req: Request, res: Response) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
      };
      const invoices = await storage.getInvoices(filters);
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/invoices", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const processedData = {
        invoiceNumber: String(body.invoiceNumber).trim(),
        customerName: String(body.customerName).trim(),
        customerEmail: String(body.customerEmail).trim(),
        amount: String(parseFloat(String(body.amount))),
        currency: body.currency || "SAR",
        status: body.status || "unpaid",
        dueDate: typeof body.dueDate === 'string' ? new Date(body.dueDate) : body.dueDate,
        notes: body.notes ? String(body.notes).trim() : undefined,
        paidDate: body.paidDate ? (typeof body.paidDate === 'string' ? new Date(body.paidDate) : body.paidDate) : undefined,
        subscriptionId: body.subscriptionId || undefined,
      };
      const data = insertInvoiceSchema.parse(processedData);
      const invoice = await storage.createInvoice(data);
      res.json(invoice);
    } catch (error: any) {
      console.error("Invoice creation error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/invoices/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const isRead = req.query.isRead === "true" ? true : req.query.isRead === "false" ? false : undefined;
      const notifications = await storage.getNotifications(isRead);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      const notification = await storage.updateNotification(req.params.id, req.body);
      if (!notification) {
        return res.status(404).json({ error: "الإشعار غير موجود" });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteNotification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "الإشعار غير موجود" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req: Request, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/read-all", async (req: Request, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "استعلام البحث مطلوب" });
      }
      const results = await storage.search(query);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "الرسالة مطلوبة" });
      }

      if (!openai) {
        return res.json({ 
          response: "عذراً، المساعد الذكي غير متاح حالياً. يرجى إضافة مفتاح OpenAI API لتفعيل هذه الميزة. يمكنك إدارة المفاتيح من إعدادات النظام." 
        });
      }

      const products = await storage.getProducts();
      const subscriptions = await storage.getSubscriptions();
      const masterAccounts = await storage.getMasterAccounts();
      const revenues = await storage.getRevenues();
      const expenses = await storage.getExpenses();

      const context = `
أنت مساعد ذكي لنظام إدارة الاشتراكات. لديك صلاحيات كاملة للوصول إلى البيانات التالية:

المنتجات: ${JSON.stringify(products, null, 2)}
الاشتراكات: ${JSON.stringify(subscriptions, null, 2)}
الحسابات الرئيسية: ${JSON.stringify(masterAccounts, null, 2)}
الإيرادات: ${JSON.stringify(revenues, null, 2)}
المصاريف: ${JSON.stringify(expenses, null, 2)}

يمكنك:
- الإجابة على الأسئلة حول البيانات
- تحليل الأداء المالي
- تقديم توصيات
- البحث عن معلومات محددة
- حساب الإحصائيات

تعامل مع السؤال بشكل طبيعي باللغة العربية وقدم إجابات مفيدة ودقيقة.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: context },
          { role: "user", content: message }
        ],
      });

      const assistantResponse = response.choices[0].message.content;
      res.json({ response: assistantResponse });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
