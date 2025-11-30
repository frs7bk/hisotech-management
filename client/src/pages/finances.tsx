import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRevenueSchema, insertExpenseSchema, type Revenue, type Expense, type Product } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";

const revenueFormSchema = insertRevenueSchema.extend({
  amount: z.string().min(1, "المبلغ مطلوب"),
  description: z.string().min(1, "الوصف مطلوب"),
  type: z.string().min(1, "النوع مطلوب"),
});

const expenseFormSchema = insertExpenseSchema.extend({
  amount: z.string().min(1, "المبلغ مطلوب"),
  category: z.string().min(1, "الفئة مطلوبة"),
  description: z.string().min(1, "الوصف مطلوب"),
}).refine((data) => {
  if (data.category === "other" && !data.description) {
    return false;
  }
  return true;
}, {
  message: "الوصف مطلوب عند اختيار 'أخرى'",
  path: ["description"],
});

export default function Finances() {
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: revenues, isLoading: revenuesLoading } = useQuery<Revenue[]>({
    queryKey: ["/api/revenues"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const revenueForm = useForm({
    resolver: zodResolver(revenueFormSchema),
    defaultValues: {
      amount: "",
      description: "",
      type: "subscription",
      date: new Date(),
      currency: "SAR",
      productId: "",
      subscriptionId: "",
    },
  });

  const expenseForm = useForm({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: "",
      category: "operational",
      description: "",
      frequency: "one_time",
      isPaid: false,
      date: new Date(),
      currency: "SAR",
      productId: "",
    },
    mode: "onBlur",
  });

  const selectedExpenseCategory = expenseForm.watch("category");

  const createRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/revenues", { ...data, amount: data.amount, date: new Date(data.date) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenues"] });
      setIsRevenueDialogOpen(false);
      revenueForm.reset();
      toast({ title: "تم إضافة الإيراد بنجاح" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expenses", { ...data, amount: data.amount, date: new Date(data.date) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setIsExpenseDialogOpen(false);
      expenseForm.reset();
      toast({ title: "تم إضافة المصروف بنجاح" });
    },
  });

  const totalRevenue = revenues?.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="flex-1 p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">الإيرادات والمصاريف</h1>
        <p className="text-muted-foreground mt-2">إدارة النظام المالي الكامل</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600" data-testid="stat-total-revenue">
                {totalRevenue.toFixed(2)} ر.س
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">إجمالي المصاريف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <div className="text-2xl font-bold text-red-600" data-testid="stat-total-expenses">
                {totalExpenses.toFixed(2)} ر.س
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">صافي الأرباح</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="stat-net-profit">
              {netProfit.toFixed(2)} ر.س
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenues" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="revenues">الإيرادات</TabsTrigger>
          <TabsTrigger value="expenses">المصاريف</TabsTrigger>
        </TabsList>

        <TabsContent value="revenues" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-revenue">
                  <Plus className="h-4 w-4" />
                  إضافة إيراد
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة إيراد جديد</DialogTitle>
                </DialogHeader>
                <Form {...revenueForm}>
                  <form onSubmit={revenueForm.handleSubmit((data) => createRevenueMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={revenueForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الوصف</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-revenue-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={revenueForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المبلغ (ر.س)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} data-testid="input-revenue-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={revenueForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>النوع</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="subscription">اشتراك</SelectItem>
                              <SelectItem value="renewal">تجديد</SelectItem>
                              <SelectItem value="other">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={revenueForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>التاريخ</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createRevenueMutation.isPending} data-testid="button-submit-revenue">
                        إضافة
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenuesLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ) : revenues && revenues.length > 0 ? (
                    revenues.map((revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell>{format(new Date(revenue.date), "yyyy-MM-dd", { locale: ar })}</TableCell>
                        <TableCell>{revenue.description}</TableCell>
                        <TableCell><Badge>{revenue.type}</Badge></TableCell>
                        <TableCell className="text-left font-semibold text-green-600">{revenue.amount} ر.س</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        لا توجد إيرادات
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-expense">
                  <Plus className="h-4 w-4" />
                  إضافة مصروف
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة مصروف جديد</DialogTitle>
                </DialogHeader>
                <Form {...expenseForm}>
                  <form onSubmit={expenseForm.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={expenseForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الفئة</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="operational">تشغيلية</SelectItem>
                              <SelectItem value="marketing">تسويقية</SelectItem>
                              <SelectItem value="administrative">إدارية</SelectItem>
                              <SelectItem value="salaries">رواتب</SelectItem>
                              <SelectItem value="other">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {selectedExpenseCategory === "other" ? "الوصف التفصيلي (ما تم شراؤه/استلامه) *" : "الوصف"}
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              value={field.value || ""}
                              placeholder={selectedExpenseCategory === "other" ? "مثال: أجهزة كمبيوتر، خوادم، برامج..." : "أدخل وصف المصروف"}
                              data-testid="input-expense-description" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المبلغ (ر.س)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} inputMode="decimal" data-testid="input-expense-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>التاريخ</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-submit-expense">
                        إضافة
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ) : expenses && expenses.length > 0 ? (
                    expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.date), "yyyy-MM-dd", { locale: ar })}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                        <TableCell className="text-left font-semibold text-red-600">{expense.amount} ر.س</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        لا توجد مصاريف
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
