import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Database, Eye } from "lucide-react";

interface NotificationSettings {
  enabled: boolean;
  subscriptionActive: boolean;
  subscriptionExpiringShort: boolean;
  subscriptionExpired: boolean;
  masterAccountFull: boolean;
  masterAccountWarning: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    subscriptionActive: true,
    subscriptionExpiringShort: true,
    subscriptionExpired: true,
    masterAccountFull: true,
    masterAccountWarning: true,
  });

  const [saved, setSaved] = useState(false);

  // استعادة الإعدادات من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("notificationSettings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("notificationSettings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults: NotificationSettings = {
      enabled: true,
      subscriptionActive: true,
      subscriptionExpiringShort: true,
      subscriptionExpired: true,
      masterAccountFull: true,
      masterAccountWarning: true,
    };
    setSettings(defaults);
    localStorage.setItem("notificationSettings", JSON.stringify(defaults));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="flex-1 p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">الإعدادات</h1>
        <p className="text-muted-foreground mt-2">إدارة تفضيلات التنبيهات والنظام</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* إعدادات التنبيهات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              إعدادات التنبيهات
            </CardTitle>
            <CardDescription>تحكم في أنواع الإشعارات التي تريد استلامها</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* تفعيل/تعطيل عام */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">تفعيل جميع الإشعارات</p>
                <p className="text-sm text-muted-foreground">تفعيل أو تعطيل الإشعارات بشكل كامل</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={() => toggleSetting("enabled")}
                data-testid="toggle-notifications-enabled"
              />
            </div>

            {/* تنبيهات الاشتراكات */}
            <div className="space-y-3 pt-2">
              <p className="font-semibold text-sm">تنبيهات الاشتراكات</p>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm">اشتراكات نشطة</p>
                  <p className="text-xs text-muted-foreground">إشعارات الاشتراكات الجديدة</p>
                </div>
                <Switch
                  checked={settings.subscriptionActive}
                  onCheckedChange={() => toggleSetting("subscriptionActive")}
                  disabled={!settings.enabled}
                  data-testid="toggle-active-subscriptions"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm">اشتراكات تنتهي قريباً</p>
                  <p className="text-xs text-muted-foreground">تنبيهات الاشتراكات التي تنتهي خلال يوم</p>
                </div>
                <Switch
                  checked={settings.subscriptionExpiringShort}
                  onCheckedChange={() => toggleSetting("subscriptionExpiringShort")}
                  disabled={!settings.enabled}
                  data-testid="toggle-expiring-soon"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm">اشتراكات منتهية</p>
                  <p className="text-xs text-muted-foreground">تنبيهات الاشتراكات المنتهية</p>
                </div>
                <Switch
                  checked={settings.subscriptionExpired}
                  onCheckedChange={() => toggleSetting("subscriptionExpired")}
                  disabled={!settings.enabled}
                  data-testid="toggle-expired-subscriptions"
                />
              </div>
            </div>

            {/* تنبيهات الحسابات الرئيسية */}
            <div className="space-y-3 pt-4 border-t">
              <p className="font-semibold text-sm">تنبيهات الحسابات الرئيسية</p>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm">حسابات قريبة من الامتلاء</p>
                  <p className="text-xs text-muted-foreground">إنذارات عندما يصل الاستخدام لـ 80%</p>
                </div>
                <Switch
                  checked={settings.masterAccountWarning}
                  onCheckedChange={() => toggleSetting("masterAccountWarning")}
                  disabled={!settings.enabled}
                  data-testid="toggle-account-warning"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm">حسابات ممتلئة</p>
                  <p className="text-xs text-muted-foreground">إشعارات حرجة للحسابات الممتلئة</p>
                </div>
                <Switch
                  checked={settings.masterAccountFull}
                  onCheckedChange={() => toggleSetting("masterAccountFull")}
                  disabled={!settings.enabled}
                  data-testid="toggle-account-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* معلومات التخزين */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              معلومات التخزين
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <p className="text-muted-foreground">يتم حفظ الإعدادات التالية محلياً:</p>
              <ul className="list-disc list-inside space-y-1 mt-3 text-xs">
                <li>إعدادات التنبيهات</li>
                <li>الفلاتر المحفوظة (الاشتراكات والحسابات)</li>
                <li>تفضيلاتك الشخصية</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* الأزرار */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset-defaults"
          >
            إعادة تعيين الافتراضيات
          </Button>
          <Button
            onClick={handleSave}
            data-testid="button-save-settings"
            className="relative"
          >
            {saved && <span className="absolute inset-0 flex items-center justify-center">✓ تم الحفظ</span>}
            <span className={saved ? "opacity-0" : "opacity-100"}>حفظ الإعدادات</span>
          </Button>
        </div>

        {/* حالة الحفظ */}
        {saved && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">✓ تم حفظ الإعدادات بنجاح</p>
          </div>
        )}
      </div>
    </div>
  );
}
