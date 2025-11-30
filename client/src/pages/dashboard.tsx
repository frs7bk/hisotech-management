import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Server, Users, DollarSign, TrendingUp, TrendingDown, AlertCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getNotifiedSubscriptions, addToNotifiedSubscriptions } from "@/lib/notification-tracker";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Product, MasterAccount, Subscription, Revenue, Expense } from "@shared/schema";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [newExpiringIds, setNewExpiringIds] = useState<Set<string>>(new Set());
  const [dismissedAlert, setDismissedAlert] = useState(false);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: masterAccounts, isLoading: accountsLoading } = useQuery<MasterAccount[]>({
    queryKey: ["/api/master-accounts"],
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery<Revenue[]>({
    queryKey: ["/api/revenues"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // تحديث التنبيهات الجديدة
  useEffect(() => {
    if (subscriptions) {
      const notifiedIds = getNotifiedSubscriptions();
      const expiringAndExpired = subscriptions.filter(
        s => (s.status === "expiring_soon" || s.status === "expired") && !notifiedIds.has(s.id)
      );
      setNewExpiringIds(new Set(expiringAndExpired.map(s => s.id)));
    }
  }, [subscriptions]);

  const activeProducts = products?.filter(p => p.status === "active").length || 0;
  const totalSubscriptions = subscriptions?.length || 0;
  const activeSubscriptions = subscriptions?.filter(s => s.status === "active").length || 0;
  const expiredSubscriptions = subscriptions?.filter(s => s.status === "expired").length || 0;
  
  // حساب الاشتراكات الجديدة فقط
  const newExpiringSoon = subscriptions?.filter(
    s => s.status === "expiring_soon" && newExpiringIds.has(s.id)
  ).length || 0;
  const newExpiredCount = subscriptions?.filter(
    s => s.status === "expired" && newExpiringIds.has(s.id)
  ).length || 0;

  const totalRevenue = revenues?.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  const isLoading = productsLoading || accountsLoading || subscriptionsLoading || revenuesLoading || expensesLoading;

  const stats = [
    {
      title: "المنتجات النشطة",
      value: activeProducts,
      total: products?.length || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "الحسابات الرئيسية",
      value: masterAccounts?.length || 0,
      total: null,
      icon: Server,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "الاشتراكات النشطة",
      value: activeSubscriptions,
      total: totalSubscriptions,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "صافي الأرباح",
      value: `${netProfit.toFixed(2)} ر.س`,
      total: null,
      icon: DollarSign,
      color: netProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: netProfit >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
    <div className="flex-1 p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على نشاطاتك ومبيعاتك</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat: any) => (
          <Card 
            key={stat.title} 
            className="hover-elevate transition-all cursor-pointer"
            onClick={() => {
              if (stat.title === "المنتجات النشطة") navigate("/products");
              else if (stat.title === "الحسابات الرئيسية") navigate("/master-accounts");
              else if (stat.title === "الاشتراكات النشطة") navigate("/subscriptions");
              else if (stat.title === "صافي الأرباح") navigate("/finances");
            }}
            data-testid={`card-stat-${stat.title}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold" data-testid={`stat-${stat.title}`}>
                    {stat.value}
                  </div>
                  {stat.total !== null && (
                    <p className="text-xs text-muted-foreground">
                      من أصل {stat.total}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Section */}
      {!isLoading && (newExpiringSoon > 0 || newExpiredCount > 0) && !dismissedAlert && (
        <Card className="border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-900/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
              <AlertCircle className="h-5 w-5" />
              تنبيهات الاشتراكات الجديدة
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => {
                setDismissedAlert(true);
                addToNotifiedSubscriptions(Array.from(newExpiringIds));
              }}
              className="text-orange-900 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/30"
              data-testid="button-dismiss-alert"
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {newExpiringSoon > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
                <span className="text-sm">{newExpiringSoon} اشتراك جديد سينتهي قريباً</span>
                <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-900">
                  سينتهي قريباً
                </Badge>
              </div>
            )}
            {newExpiredCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
                <span className="text-sm">{newExpiredCount} اشتراك جديد منتهي</span>
                <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900">
                  منتهي
                </Badge>
              </div>
            )}
            <button 
              onClick={() => {
                // تمرير معرفات الاشتراكات المحددة فقط
                sessionStorage.setItem("highlightSubscriptionIds", JSON.stringify(Array.from(newExpiringIds)));
                navigate("/subscriptions");
              }}
              className="w-full text-sm text-orange-700 dark:text-orange-300 hover:underline font-medium mt-2"
              data-testid="link-view-subscriptions"
            >
              عرض الاشتراكات المحددة →
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              الإيرادات
            </CardTitle>
            <CardDescription>إجمالي الإيرادات</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div className="text-3xl font-bold text-green-600" data-testid="stat-total-revenue">
                {totalRevenue.toFixed(2)} ر.س
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              المصاريف
            </CardTitle>
            <CardDescription>إجمالي المصاريف</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div className="text-3xl font-bold text-red-600" data-testid="stat-total-expenses">
                {totalExpenses.toFixed(2)} ر.س
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>توزيع الاشتراكات</CardTitle>
            <CardDescription>حسب الحالة</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : subscriptions && subscriptions.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "نشط", value: activeSubscriptions, color: "#10b981" },
                      { name: "سينتهي قريباً", value: subscriptions.filter(s => s.status === "expiring_soon").length, color: "#f59e0b" },
                      { name: "منتهي", value: expiredSubscriptions, color: "#ef4444" },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: "نشط", value: activeSubscriptions, color: "#10b981" },
                      { name: "سينتهي قريباً", value: subscriptions.filter(s => s.status === "expiring_soon").length, color: "#f59e0b" },
                      { name: "منتهي", value: expiredSubscriptions, color: "#ef4444" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} اشتراك`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إحصائيات الحسابات الرئيسية</CardTitle>
            <CardDescription>توزيع الاستخدام</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : masterAccounts && masterAccounts.length > 0 ? (
              <div className="space-y-3">
                {masterAccounts.slice(0, 5).map((account) => {
                  const percentage = (account.currentUsage / account.maxCapacity) * 100;
                  return (
                    <div key={account.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{account.accountName}</span>
                        <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            percentage >= 95 ? "bg-red-600" : percentage >= 80 ? "bg-orange-600" : "bg-green-600"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                لا توجد حسابات
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
