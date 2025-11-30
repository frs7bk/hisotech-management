import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, RefreshCw, Search, X, Trash, Download, Check, CheckSquare, Square } from "lucide-react";
import { exportToCSV, getSubscriptionExportHeaders } from "@/lib/export";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Subscription, type InsertSubscription, type Product, type MasterAccount } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";

const subscriptionFormSchema = z.object({
  customerName: z.string().min(1, "اسم العميل مطلوب"),
  customerEmail: z.string().email("البريد الإلكتروني غير صحيح"),
  customerWhatsapp: z.string().optional(),
  productId: z.string().min(1, "المنتج مطلوب"),
  masterAccountId: z.string().min(1, "الحساب الرئيسي مطلوب"),
  startDate: z.date({ message: "تاريخ البدء مطلوب" }),
  endDate: z.date({ message: "تاريخ الانتهاء مطلوب" }),
  status: z.string(),
  price: z.string().min(1, "السعر مطلوب"),
  currency: z.string(),
  couponCode: z.string().optional(),
  referrer: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء",
  path: ["endDate"],
});

type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

export default function Subscriptions() {
  // استعادة الفلاتر المحفوظة من localStorage
  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem("subscriptionsFilters");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const savedFilters = getSavedFilters();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState(savedFilters?.search || "");
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>(savedFilters?.status || "all");
  const [productFilter, setProductFilter] = useState<string>(savedFilters?.product || "all");
  const [accountFilter, setAccountFilter] = useState<string>(savedFilters?.account || "all");
  const [startDateFilter, setStartDateFilter] = useState<string>(savedFilters?.startDate || "");
  const [endDateFilter, setEndDateFilter] = useState<string>(savedFilters?.endDate || "");
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("7");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDialog, setBulkStatusDialog] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState("active");
  const { toast } = useToast();

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  // عند تحميل الصفحة، قراءة معرفات الاشتراكات المراد تحديدها
  useEffect(() => {
    const idsFromStorage = sessionStorage.getItem("highlightSubscriptionIds");
    if (idsFromStorage) {
      try {
        const ids = JSON.parse(idsFromStorage);
        setHighlightedIds(new Set(ids));
        
        // حذف الـ highlight بعد 5 ثوان
        const timer = setTimeout(() => {
          setHighlightedIds(new Set());
        }, 5000);
        
        // امسح sessionStorage
        sessionStorage.removeItem("highlightSubscriptionIds");
        
        return () => clearTimeout(timer);
      } catch (e) {
        console.error("Error parsing highlighted IDs:", e);
      }
    }
  }, []);

  // حفظ الفلاتر في localStorage عند التغيير
  useEffect(() => {
    const filters = {
      search: searchQuery,
      status: statusFilter,
      product: productFilter,
      account: accountFilter,
      startDate: startDateFilter,
      endDate: endDateFilter,
    };
    localStorage.setItem("subscriptionsFilters", JSON.stringify(filters));
  }, [searchQuery, statusFilter, productFilter, accountFilter, startDateFilter, endDateFilter]);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: masterAccounts } = useQuery<MasterAccount[]>({
    queryKey: ["/api/master-accounts"],
  });

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerWhatsapp: "",
      productId: "",
      masterAccountId: "",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      status: "active",
      price: "",
      currency: "SAR",
      couponCode: "",
      referrer: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSubscription) => {
      return await apiRequest("POST", "/api/subscriptions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء الاشتراك بنجاح" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSubscription> }) => {
      return await apiRequest("PATCH", `/api/subscriptions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setIsDialogOpen(false);
      setEditingSubscription(null);
      form.reset();
      toast({ title: "تم تحديث الاشتراك بنجاح ✅" });
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({ title: "خطأ في التحديث", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/subscriptions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      toast({ title: "تم حذف الاشتراك بنجاح" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (daysOld: number) => {
      return await apiRequest("POST", "/api/subscriptions/cleanup/expired", { daysOld });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setCleanupDialogOpen(false);
      toast({ title: `تم حذف ${data.deletedCount} اشتراك منتهي` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/subscriptions/bulk-delete", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setSelectedIds(new Set());
      toast({ title: `تم حذف ${selectedIds.size} اشتراك` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      return await apiRequest("POST", "/api/subscriptions/bulk-update-status", { ids, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-accounts"] });
      setSelectedIds(new Set());
      setBulkStatusDialog(false);
      toast({ title: `تم تحديث حالة ${selectedIds.size} اشتراك` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SubscriptionFormValues) => {
    try {
      const payload: any = {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerWhatsapp: data.customerWhatsapp || null,
        productId: data.productId,
        masterAccountId: data.masterAccountId,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        price: data.price,
        currency: data.currency,
        couponCode: data.couponCode || null,
        referrer: data.referrer || null,
      };
      
      if (editingSubscription) {
        updateMutation.mutate({ id: editingSubscription.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch (error) {
      toast({ title: "خطأ في البيانات", description: "تحقق من صحة جميع الحقول" });
    }
  };

  // إعادة تعيين تصفية الحساب عندما يتغير المنتج
  useEffect(() => {
    if (productFilter !== "all") {
      setAccountFilter("all");
    }
  }, [productFilter]);

  // تصفية الحسابات بناءً على المنتج المختار
  const filteredAccounts = useMemo(() => {
    if (!masterAccounts) return [];
    if (productFilter === "all") return masterAccounts;
    return masterAccounts.filter(account => account.productId === productFilter);
  }, [masterAccounts, productFilter]);

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setSelectedProductId(subscription.productId);
    form.reset({
      customerName: subscription.customerName,
      customerEmail: subscription.customerEmail,
      customerWhatsapp: subscription.customerWhatsapp || "",
      productId: subscription.productId,
      masterAccountId: subscription.masterAccountId,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      status: subscription.status,
      price: subscription.price.toString(),
      currency: subscription.currency,
      couponCode: subscription.couponCode || "",
      referrer: subscription.referrer || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">نشط</Badge>;
      case "expiring_soon":
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">سينتهي قريباً</Badge>;
      case "expired":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">منتهي</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProductName = (productId: string) => {
    return products?.find(p => p.id === productId)?.name || "غير معروف";
  };

  const getAccountName = (accountId: string) => {
    return masterAccounts?.find(a => a.id === accountId)?.accountName || "غير معروف";
  };

  const filteredSubscriptions = useMemo(() => {
    if (!subscriptions) return [];
    return subscriptions.filter((subscription) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        subscription.customerName.toLowerCase().includes(query) ||
        subscription.customerEmail.toLowerCase().includes(query) ||
        subscription.customerWhatsapp?.toLowerCase().includes(query) ||
        subscription.couponCode?.toLowerCase().includes(query) ||
        subscription.referrer?.toLowerCase().includes(query) ||
        getAccountName(subscription.masterAccountId).toLowerCase().includes(query) ||
        getProductName(subscription.productId).toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || subscription.status === statusFilter;
      const matchesProduct = productFilter === "all" || subscription.productId === productFilter;
      const matchesAccount = accountFilter === "all" || subscription.masterAccountId === accountFilter;
      
      let matchesDateRange = true;
      if (startDateFilter || endDateFilter) {
        const subStartDate = new Date(subscription.startDate);
        const subEndDate = new Date(subscription.endDate);
        
        if (startDateFilter) {
          const filterStart = new Date(startDateFilter);
          matchesDateRange = matchesDateRange && (subStartDate >= filterStart || subEndDate >= filterStart);
        }
        if (endDateFilter) {
          const filterEnd = new Date(endDateFilter);
          filterEnd.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && (subStartDate <= filterEnd || subEndDate <= filterEnd);
        }
      }
      
      return matchesSearch && matchesStatus && matchesProduct && matchesAccount && matchesDateRange;
    });
  }, [subscriptions, searchQuery, statusFilter, productFilter, accountFilter, startDateFilter, endDateFilter, masterAccounts, products]);

  const availableAccounts = masterAccounts?.filter(a => 
    a.productId === selectedProductId && a.isActive && a.currentUsage < a.maxCapacity
  ) || [];

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
    if (selectedIds.size === filteredSubscriptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubscriptions.map(s => s.id)));
    }
  };

  return (
    <div className="flex-1 p-8 space-y-8">
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedIds.size} اشتراك محدد</span>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setBulkStatusDialog(true)}
                  data-testid="button-bulk-update-status"
                >
                  <Check className="h-4 w-4 ml-1" />
                  تغيير الحالة
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من حذف هذه الاشتراكات؟")) {
                      bulkDeleteMutation.mutate(Array.from(selectedIds));
                    }
                  }}
                  data-testid="button-bulk-delete"
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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">الاشتراكات</h1>
          <p className="text-muted-foreground mt-2">إدارة اشتراكات العملاء ({filteredSubscriptions.length})</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dataToExport = filteredSubscriptions.map(sub => ({
                customerName: sub.customerName,
                customerEmail: sub.customerEmail,
                customerWhatsapp: sub.customerWhatsapp || "-",
                productName: getProductName(sub.productId),
                accountName: getAccountName(sub.masterAccountId),
                price: sub.price,
                currency: sub.currency,
                status: sub.status,
                startDate: format(new Date(sub.startDate), "dd/MM/yyyy", { locale: ar }),
                endDate: format(new Date(sub.endDate), "dd/MM/yyyy", { locale: ar }),
                couponCode: sub.couponCode || "-",
                referrer: sub.referrer || "-",
              }));
              exportToCSV(dataToExport, `اشتراكات_${format(new Date(), "dd-MM-yyyy")}`);
              toast({ title: "تم التصدير", description: `تم تصدير ${filteredSubscriptions.length} اشتراك` });
            }}
            data-testid="button-export-subscriptions"
            title="تصدير البيانات المفلترة"
          >
            <Download className="h-4 w-4 ml-1" />
            <span className="hidden sm:inline">تصدير Excel</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingSubscription(null);
              setSelectedProductId("");
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-subscription" title="إضافة اشتراك جديد">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">إضافة اشتراك جديد</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSubscription ? "تعديل الاشتراك" : "إضافة اشتراك جديد"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم العميل</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-customer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البريد الإلكتروني</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-customer-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerWhatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الواتساب (اختياري)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="+966..." inputMode="tel" data-testid="input-customer-whatsapp" />
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
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedProductId(value);
                          form.setValue("masterAccountId", "");
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product">
                              <SelectValue placeholder="اختر منتج" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.filter(p => p.status === "active").map((product) => (
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
                    name="masterAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الحساب الرئيسي</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProductId}>
                          <FormControl>
                            <SelectTrigger data-testid="select-master-account">
                              <SelectValue placeholder="اختر حساب رئيسي" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.accountName} ({account.currentUsage}/{account.maxCapacity})
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
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>السعر</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">من</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="text-sm" data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">إلى</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="text-sm" data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-subscription">
                    {editingSubscription ? "حفظ التعديلات" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
          </Dialog>

          <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-cleanup" title="حذف الاشتراكات المنتهية">
                <Trash className="h-4 w-4" />
                <span className="hidden sm:inline">حذف المنتهية</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>حذف الاشتراكات المنتهية</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">اختر مدة الحذف:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant={cleanupDays === "7" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCleanupDays("7")}
                      data-testid="button-cleanup-week"
                    >
                      أسبوع
                    </Button>
                    <Button 
                      variant={cleanupDays === "30" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCleanupDays("30")}
                      data-testid="button-cleanup-month"
                    >
                      شهر
                    </Button>
                    <Button 
                      variant={cleanupDays === "90" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCleanupDays("90")}
                      data-testid="button-cleanup-3months"
                    >
                      3 أشهر
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">أو أدخل عدد الأيام:</label>
                  <Input 
                    type="number" 
                    value={cleanupDays}
                    onChange={(e) => setCleanupDays(e.target.value)}
                    placeholder="عدد الأيام"
                    data-testid="input-custom-days"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  سيتم حذف جميع الاشتراكات التي انتهت منذ {cleanupDays} يوم أو أكثر
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setCleanupDialogOpen(false)}
                  data-testid="button-cancel-cleanup"
                >
                  إلغاء
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => cleanupMutation.mutate(parseInt(cleanupDays))}
                  disabled={cleanupMutation.isPending}
                  data-testid="button-confirm-cleanup"
                >
                  حذف
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters Section */}
      <div className="space-y-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن عميل أو بريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-subscriptions"
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
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الحالة: الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="expiring_soon">سينتهي قريباً</SelectItem>
                <SelectItem value="expired">منتهي</SelectItem>
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
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-44" data-testid="select-account-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الحساب: الكل</SelectItem>
                {filteredAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-48">
              <label className="text-sm text-muted-foreground mb-1 block">من التاريخ</label>
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                data-testid="input-start-date-filter"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-sm text-muted-foreground mb-1 block">إلى التاريخ</label>
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                data-testid="input-end-date-filter"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setProductFilter("all");
                setAccountFilter("all");
                setSearchQuery("");
                setStartDateFilter("");
                setEndDateFilter("");
              }}
              data-testid="button-reset-filters"
            >
              إعادة تعيين الفلاتر
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      ) : filteredSubscriptions && filteredSubscriptions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <button 
                        onClick={toggleSelectAll}
                        className="hover:bg-muted p-1 rounded"
                        data-testid="button-select-all"
                      >
                        {selectedIds.size === filteredSubscriptions.length && filteredSubscriptions.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الحساب الرئيسي</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => {
                    const isHighlighted = highlightedIds.has(subscription.id);
                    const getRowColor = (status: string) => {
                      if (isHighlighted) {
                        return "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse hover:bg-yellow-200 dark:hover:bg-yellow-900/50";
                      }
                      switch (status) {
                        case "active":
                          return "bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20";
                        case "expiring_soon":
                          return "bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20";
                        case "expired":
                          return "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20";
                        default:
                          return "";
                      }
                    };

                    return (
                      <TableRow key={subscription.id} data-testid={`row-subscription-${subscription.id}`} className={getRowColor(subscription.status)}>
                        <TableCell className="w-12">
                          <button 
                            onClick={() => toggleSelectId(subscription.id)}
                            className="hover:bg-muted p-1 rounded"
                            data-testid={`checkbox-subscription-${subscription.id}`}
                          >
                            {selectedIds.has(subscription.id) ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{subscription.customerName}</div>
                            <div className="text-sm text-muted-foreground">{subscription.customerEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getProductName(subscription.productId)}</TableCell>
                        <TableCell>{getAccountName(subscription.masterAccountId)}</TableCell>
                        <TableCell>{format(new Date(subscription.endDate), "yyyy-MM-dd", { locale: ar })}</TableCell>
                        <TableCell>{subscription.price} ر.س</TableCell>
                        <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(subscription)} data-testid={`button-edit-${subscription.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(subscription.id)} data-testid={`button-delete-${subscription.id}`}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Plus className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد اشتراكات</h3>
            <p className="text-sm text-muted-foreground">ابدأ بإضافة أول اشتراك</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير حالة الاشتراكات ({selectedIds.size})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={bulkNewStatus} onValueChange={setBulkNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="expiring_soon">سينتهي قريباً</SelectItem>
                <SelectItem value="expired">منتهي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkStatusDialog(false)}
            >
              إلغاء
            </Button>
            <Button 
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkNewStatus })}
              disabled={bulkUpdateStatusMutation.isPending}
            >
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
