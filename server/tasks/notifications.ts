import { storage } from "../storage";
import { log } from "../app";

export async function checkSubscriptionsAndCreateNotifications() {
  try {
    const subscriptions = await storage.getSubscriptions();
    const existingNotifications = await storage.getNotifications();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const subscription of subscriptions) {
      const endDate = new Date(subscription.endDate);
      const subDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      // إذا كان الاشتراك منتهي والحالة تزال "active" → تحديث الحالة
      if (subDate < today && subscription.status === "active") {
        await storage.updateSubscription(subscription.id, { status: "expired" });
      }

      // إذا كان الاشتراك ينتهي غداً
      if (subDate.getTime() === tomorrow.getTime() && subscription.status === "active") {
        // التحقق من عدم وجود إشعار "قريب الانتهاء" لهذا الاشتراك
        const hasExpiringNotification = existingNotifications.some(
          n => n.relatedId === subscription.id && n.type === "subscription_expiring"
        );

        if (!hasExpiringNotification) {
          await storage.createNotification({
            type: "subscription_expiring",
            title: `⏱️ اشتراك سينتهي غداً`,
            message: `الاشتراك للعميل ${subscription.customerName} سينتهي غداً (${subDate.toLocaleDateString('ar')})`,
            relatedId: subscription.id,
            isRead: false,
          });
        }
      }

      // إذا كان الاشتراك انتهى (الحالة تغيرت إلى expired)
      if (subDate <= today && subscription.status === "expired") {
        // التحقق من عدم وجود إشعار "انتهى الاشتراك" لهذا الاشتراك
        const hasExpiredNotification = existingNotifications.some(
          n => n.relatedId === subscription.id && n.type === "subscription_expiring"
        );

        if (!hasExpiredNotification) {
          await storage.createNotification({
            type: "subscription_expiring",
            title: `❌ انتهى الاشتراك: ${subscription.customerName}`,
            message: `انتهى الاشتراك للعميل ${subscription.customerName} (${subscription.customerEmail}) بتاريخ ${subDate.toLocaleDateString('ar')}`,
            relatedId: subscription.id,
            isRead: false,
          });
        }
      }
    }

    log("✅ تم التحقق من الاشتراكات وإنشاء الإشعارات", "notifications-task");
  } catch (error: any) {
    log(`❌ خطأ في مهمة الإشعارات: ${error.message}`, "notifications-task");
  }
}

export function startNotificationTask() {
  // تشغيل المهمة فوراً عند البدء
  checkSubscriptionsAndCreateNotifications();

  // ثم تشغيلها كل 24 ساعة (86,400,000 ملي ثانية)
  const dailyInterval = 24 * 60 * 60 * 1000;
  
  setInterval(() => {
    checkSubscriptionsAndCreateNotifications();
  }, dailyInterval);

  log("🔔 تم بدء مهمة الإشعارات الدورية (كل 24 ساعة)", "notifications-task");
}
