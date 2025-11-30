// نظام تتبع التنبيهات للاشتراكات المنتهية والقريبة من الانتهاء
const NOTIFIED_SUBSCRIPTIONS_KEY = "notified_subscriptions";
const NOTIFICATION_SETTINGS_KEY = "notificationSettings";

interface NotificationSettings {
  enabled: boolean;
  subscriptionActive: boolean;
  subscriptionExpiringShort: boolean;
  subscriptionExpired: boolean;
  masterAccountFull: boolean;
  masterAccountWarning: boolean;
}

export const getNotificationSettings = (): NotificationSettings => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {
      enabled: true,
      subscriptionActive: true,
      subscriptionExpiringShort: true,
      subscriptionExpired: true,
      masterAccountFull: true,
      masterAccountWarning: true,
    };
  } catch {
    return {
      enabled: true,
      subscriptionActive: true,
      subscriptionExpiringShort: true,
      subscriptionExpired: true,
      masterAccountFull: true,
      masterAccountWarning: true,
    };
  }
};

export const isNotificationEnabled = (type: "subscriptionActive" | "subscriptionExpiringShort" | "subscriptionExpired" | "masterAccountWarning" | "masterAccountFull"): boolean => {
  const settings = getNotificationSettings();
  return settings.enabled && settings[type];
};

export const getNotifiedSubscriptions = (): Set<string> => {
  try {
    const stored = localStorage.getItem(NOTIFIED_SUBSCRIPTIONS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
};

export const saveNotifiedSubscriptions = (ids: Set<string>) => {
  try {
    localStorage.setItem(NOTIFIED_SUBSCRIPTIONS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    console.error("Failed to save notified subscriptions");
  }
};

export const addToNotifiedSubscriptions = (ids: string[]) => {
  const current = getNotifiedSubscriptions();
  ids.forEach(id => current.add(id));
  saveNotifiedSubscriptions(current);
};

export const clearNotifiedSubscriptions = () => {
  localStorage.removeItem(NOTIFIED_SUBSCRIPTIONS_KEY);
};
