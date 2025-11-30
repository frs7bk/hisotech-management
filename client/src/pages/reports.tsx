import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Package, Download } from "lucide-react";
import { UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exportToCSV } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Revenue, Expense, Subscription, Product } from "@shared/schema";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";

export default function Reports() {
  const [dateRange, setDateRange] = useState<"week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return format(startOfMonth(now), "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return format(endOfMonth(now), "yyyy-MM-dd");
  });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // حساب التواريخ بناءً على الفلتر المختار
  const getFilteredDates = () => {
    const now = new Date();
    let start, end;

    if (dateRange === "week") {
      start = startOfWeek(now, { weekStartsOn: 6 });
      end = endOfWeek(now, { weekStartsOn: 6 });
    } else if (dateRange === "month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      start = new Date(startDate);
      end = new Date(endDate);
    }

    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  };

  const dates = getFilteredDates();

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery<Revenue[]>({
    queryKey: ["/api/revenues", dates.startDate, dates.endDate, selectedProductId],
    queryFn: async () => {
      let url = `/api/revenues?startDate=${dates.startDate}&endDate=${dates.endDate}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", dates.startDate, dates.endDate, selectedProductId],
    queryFn: async () => {
      let url = `/api/expenses?startDate=${dates.startDate}&endDate=${dates.endDate}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions", selectedProductId],
    queryFn: async () => {
      let url = "/api/subscriptions";
      if (selectedProductId) url += `?productId=${selectedProductId}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const isLoading = revenuesLoading || expensesLoading || subscriptionsLoading;

  const totalRevenue = revenues?.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  const subscriptionsByStatus = [
    { name: "نشط", value: subscriptions?.filter(s => s.status === "active").length || 0, color: "#10b981" },
    { name: "سينتهي قريباً", value: subscriptions?.filter(s => s.status === "expiring_soon").length || 0, color: "#f59e0b" },
    { name: "منتهي", value: subscriptions?.filter(s => s.status === "expired").length || 0, color: "#ef4444" },
  ];

  // بناء بيانات يومية للرسوم البيانية
  const getDailyData = () => {
    if (!revenues || !expenses) return [];

    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    const dailyMap: Record<string, { date: string, revenue: number; expenses: number }> = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, "yyyy-MM-dd");
      dailyMap[dateStr] = { date: format(d, "dd/MM", { locale: ar }), revenue: 0, expenses: 0 };
    }

    revenues.forEach(r => {
      const dateStr = format(new Date(r.date), "yyyy-MM-dd");
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].revenue += parseFloat(r.amount.toString());
      }
    });

    expenses.forEach(e => {
      const dateStr = format(new Date(e.date), "yyyy-MM-dd");
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].expenses += parseFloat(e.amount.toString());
      }
    });

    return Object.values(dailyMap);
  };

  // بناء بيانات حسب الفئة
  const getExpensesByCategory = () => {
    if (!expenses) return [];

    const categoryMap: Record<string, number> = {};
    expenses.forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + parseFloat(e.amount.toString());
    });

    const categoryNames: Record<string, string> = {
      operational: "تشغيلية",
      marketing: "تسويقية",
      administrative: "إدارية",
      salaries: "رواتب",
      other: "أخرى",
    };

    return Object.entries(categoryMap).map(([key, value]) => ({
      name: categoryNames[key] || key,
      value: parseFloat(value.toFixed(2)),
    }));
  };

  const dailyData = getDailyData();
  const expensesByCategory = getExpensesByCategory();

  const colors = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">تحليل شامل للأداء المالي والاشتراكات</p>
      </div>

      {/* فلاتر التاريخ والمنتج */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              الفترة الزمنية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={dateRange === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("week")}
                className="text-xs md:text-sm"
              >
                أسبوع
              </Button>
              <Button 
                variant={dateRange === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("month")}
                className="text-xs md:text-sm"
              >
                شهر
              </Button>
              <Button 
                variant={dateRange === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("custom")}
                className="text-xs md:text-sm"
              >
                مخصص
              </Button>
            </div>

            {dateRange === "custom" && (
              <div className="flex flex-col md:flex-row gap-2">
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs"
                />
                <Input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              {format(new Date(dates.startDate), "dd MMM", { locale: ar })} - {format(new Date(dates.endDate), "dd MMM yyyy", { locale: ar })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              المنتج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProductId || "all"} onValueChange={(val) => setSelectedProductId(val === "all" ? null : val)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="اختر منتج (أو اعرض الكل)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنتجات</SelectItem>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* الإحصائيات الرئيسية */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-xl md:text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} ر.س</div>
                <p className="text-xs text-muted-foreground mt-1">{revenues?.length || 0} عملية</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">إجمالي المصاريف</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <div className="text-xl md:text-2xl font-bold text-red-600">{totalExpenses.toFixed(2)} ر.س</div>
                <p className="text-xs text-muted-foreground mt-1">{expenses?.length || 0} عملية</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">صافي الأرباح</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-xl md:text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit.toFixed(2)} ر.س
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">الإيرادات والمصاريف اليومية</CardTitle>
            <CardDescription className="text-xs">مقارنة يومية خلال الفترة المختارة</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="الإيرادات" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="المصاريف" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">حالة الاشتراكات</CardTitle>
            <CardDescription className="text-xs">توزيع الاشتراكات حسب الحالة</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {subscriptionsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* توزيع المصاريف حسب الفئة */}
      {expensesByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">توزيع المصاريف حسب الفئة</CardTitle>
            <CardDescription className="text-xs">تحليل المصاريف حسب النوع</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${value.toFixed(2)} ر.س`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* اتجاه النمو */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-base">اتجاه النمو</CardTitle>
          <CardDescription className="text-xs">الفرق بين الإيرادات والمصاريف</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => `${value.toFixed(2)} ر.س`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="الإيرادات" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="المصاريف" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
