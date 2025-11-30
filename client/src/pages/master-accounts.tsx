import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, AlertTriangle, Search, X, CheckSquare, Square, Trash2, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMasterAccountSchema, type MasterAccount, type InsertMasterAccount, type Product } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";

const accountFormSchema = insertMasterAccountSchema.extend({
  accountName: z.string().min(1, "اسم الحساب مطلوب"),
  productId: z.string().min(1, "المنتج مطلوب"),
  maxCapacity: z.string().min(1, "السعة القصوى مطلوبة"),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

export default function MasterAccounts() {
  // استعادة الفلاتر المحفوظة من localStorage
  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem("masterAccountsFilters");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const savedFilters = getSavedFilters();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MasterAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState(savedFilters?.search || "");
  const [statusFilter, setStatusFilter] = useState<string>(savedFilters?.status || "all");
  const [productFilter, setProductFilter] = useState<string>(savedFilters?.product || "all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery<MasterAccount[]>({
    queryKey: ["/api/master-accounts"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      accountName: "",
      productId: "",
      maxCapacity: "",
      currentUsage: 0,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMasterAccount) => {
      return await apiRequest("POST", "/api/master-accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء الحساب بنجاح" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertMasterAccount> }) => {
      return await apiRequest("PATCH", `/api/master-accounts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setIsDialogOpen(false);
      setEditingAccount(null);
      form.reset();
      toast({ title: "تم تحديث الحساب بنجاح ✅" });
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({ title: "خطأ في التحديث", description: error.message, variant: "destructive" });
    },
  });

  // حفظ الفلاتر في localStorage عند التغيير
  useEffect(() => {
    const filters = {
      search: searchQuery,
      status: statusFilter,
      product: productFilter,
    };
    localStorage.setItem("masterAccountsFilters", JSON.stringify(filters));
  }, [searchQuery, statusFilter, productFilter]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/master-accounts/bulk-delete", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setSelectedIds(new Set());
      toast({ title: `تم حذف ${selectedIds.size} حساب` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: AccountFormValues) => {
    const payload = {
      ...data,
      maxCapacity: parseInt(data.maxCapacity),
    };
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (account: MasterAccount) => {
    setEditingAccount(account);
    form.reset({
      accountName: account.accountName,
      productId: account.productId,
      maxCapacity: account.maxCapacity.toString(),
      currentUsage: account.currentUsage,
      isActive: account.isActive,
    });
    setIsDialogOpen(true);
  };

  const getAccountStatus = (account: MasterAccount) => {
    const percentage = (account.currentUsage / account.maxCapacity) * 100;
    if (percentage >= 100) return { status: "ممتلئ بالكامل", color: "text-red-700", bgColor: "bg-red-100 dark:bg-red-900/30", severity: "full" };
    if (percentage >= 95) return { status: "ممتلئ تقريباً", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", severity: "near-full" };
    if (percentage >= 80) return { status: "قريب من الامتلاء", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", severity: "warning" };
    return { status: "طبيعي", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", severity: "normal" };
  };

  const getProductName = (productId: string) => {
    return products?.find(p => p.id === productId)?.name || "غير معروف";
  };

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((account) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        account.accountName.toLowerCase().includes(query) ||
        getProductName(account.productId).toLowerCase().includes(query);
      const accountStatus = getAccountStatus(account);
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "normal" && accountStatus.severity === "normal") ||
        (statusFilter === "warning" && accountStatus.severity === "warning") ||
        (statusFilter === "full" && (accountStatus.severity === "near-full" || accountStatus.severity === "full"));
      const matchesProduct = productFilter === "all" || account.productId === productFilter;
      return matchesSearch && matchesStatus && matchesProduct;
    });
  }, [accounts, searchQuery, statusFilter, productFilter, products]);

  const toggleSelectId = (id: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) {
      newIds.delete(id);
    } else {
      newIds.add(id);
    }
    setSelectedIds(newIds);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAccounts.map(a => a.id)));
    }
  };

  return (
    <div className="flex-1 p-8 space-y-8">
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedIds.size} حساب محدد</span>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من حذف هذه الحسابات؟")) {
                      bulkDeleteMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  data-testid="button-bulk-delete-accounts"
                >
                  <Trash2 className="h-4 w-4 ml-1" />
                  حذف متعدد
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                >
                  إلغاء التحديد
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">الحسابات الرئيسية</h1>
          <p className="text-muted-foreground mt-2">إدارة الحسابات الرئيسية والسعة ({filteredAccounts.length})</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dataToExport = filteredAccounts.map(acc => ({
                accountName: acc.accountName,
                productName: getProductName(acc.productId),
                currentUsage: acc.currentUsage,
                maxCapacity: acc.maxCapacity,
                usagePercentage: ((acc.currentUsage / acc.maxCapacity) * 100).toFixed(2) + "%",
                status: getAccountStatus(acc).status,
                isActive: acc.isActive ? "نشط" : "معطل",
              }));
              exportToCSV(dataToExport, `الحسابات_${format(new Date(), "dd-MM-yyyy")}`);
              toast({ title: "تم التصدير", description: `تم تصدير ${filteredAccounts.length} حساب` });
            }}
            data-testid="button-export-accounts"
            title="تصدير البيانات المفلترة"
          >
            <Download className="h-4 w-4 ml-1" />
            <span className="hidden sm:inline">تصدير Excel</span>
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingAccount(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="h-4 w-4" />
              إضافة حساب رئيسي
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "تعديل الحساب" : "إضافة حساب رئيسي"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم الحساب</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-account-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المنتج</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product">
                            <SelectValue placeholder="اختر منتج" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السعة القصوى</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-max-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-account">
                    {editingAccount ? "حفظ التعديلات" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Section */}
      <div className="space-y-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن حساب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-accounts"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الحالة: الكل</SelectItem>
                <SelectItem value="normal">طبيعي</SelectItem>
                <SelectItem value="warning">قريب من الامتلاء</SelectItem>
                <SelectItem value="full">ممتلئ أو قريب جداً</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-44" data-testid="select-product-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">المنتج: الكل</SelectItem>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setProductFilter("all");
              setSearchQuery("");
            }}
            data-testid="button-reset-filters"
          >
            إعادة تعيين الفلاتر
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAccounts && filteredAccounts.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 items-center">
              <button 
                onClick={toggleSelectAll}
                className="p-2 hover:bg-muted rounded-lg flex items-center justify-center transition-colors"
                data-testid="button-select-all-accounts"
                title={selectedIds.size === filteredAccounts.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
              >
                {selectedIds.size === filteredAccounts.length && filteredAccounts.length > 0 ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} من ${filteredAccounts.length}` : `تحديد الكل (${filteredAccounts.length})`}
              </span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((account) => {
              const percentage = (account.currentUsage / account.maxCapacity) * 100;
              const statusInfo = getAccountStatus(account);
              const isSelected = selectedIds.has(account.id);
              return (
                <div key={account.id} className="relative group" data-testid={`card-account-${account.id}`}>
                  <Card className={`hover-elevate transition-all ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => toggleSelectId(account.id)}
                          className={`p-2 rounded-lg border transition-all flex-shrink-0 ${
                            isSelected 
                              ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600' 
                              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                          data-testid={`checkbox-account-${account.id}`}
                          title={isSelected ? "إلغاء التحديد" : "تحديد"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">{account.accountName}</CardTitle>
                          <p className="text-sm text-muted-foreground">{getProductName(account.productId)}</p>
                        </div>
                        <Badge className={statusInfo.bgColor}>
                          <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.status}</span>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">الاستخدام</span>
                          <span className="font-semibold text-sm">{account.currentUsage} / {account.maxCapacity}</span>
                        </div>
                        <Progress value={Math.min(percentage, 100)} className="h-2.5" />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">النسبة المئوية</span>
                          <span className={`text-sm font-semibold ${
                            percentage >= 100 ? 'text-red-600' :
                            percentage >= 95 ? 'text-red-500' :
                            percentage >= 80 ? 'text-orange-500' :
                            'text-green-600'
                          }`}>
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      {percentage >= 80 && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg border ${
                          percentage >= 95 
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        }`}>
                          <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            percentage >= 95 ? 'text-red-600' : 'text-orange-600'
                          }`} />
                          <p className={`text-xs ${
                            percentage >= 95 ? 'text-red-600' : 'text-orange-600'
                          }`}>
                            {percentage >= 100 ? "الحساب ممتلئ بالكامل - تحرير مساحة مطلوب!" :
                             percentage >= 95 ? "الحساب ممتلئ تقريباً - عليك بالسرعة!" :
                             "الحساب قريب من الامتلاء - راقبه"}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(account)} className="flex-1" data-testid={`button-edit-${account.id}`}>
                          <Edit className="h-3.5 w-3.5 ml-1" />
                          تعديل
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد حسابات رئيسية</h3>
            <p className="text-sm text-muted-foreground">ابدأ بإضافة أول حساب رئيسي</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
