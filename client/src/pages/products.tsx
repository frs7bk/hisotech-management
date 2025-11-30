import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Power, Package, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product, type InsertProduct, type MasterAccount, type Subscription } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";

const productFormSchema = insertProductSchema.extend({
  name: z.string().min(1, "الاسم مطلوب"),
  standardPrice: z.string().min(1, "السعر مطلوب"),
  planType: z.string().min(1, "نوع الخطة مطلوب"),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function Products() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProductAccounts, setSelectedProductAccounts] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: masterAccounts } = useQuery<MasterAccount[]>({
    queryKey: ["/api/master-accounts"],
  });

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      standardPrice: "",
      planType: "monthly",
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء المنتج بنجاح" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProduct> }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
      toast({ title: "تم تحديث المنتج بنجاح" });
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      standardPrice: product.standardPrice.toString(),
      planType: product.planType,
      status: product.status,
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = (product: Product) => {
    updateMutation.mutate({
      id: product.id,
      data: { status: product.status === "active" ? "inactive" : "active" },
    });
  };

  const getProductStats = (productId: string) => {
    const accountsCount = masterAccounts?.filter((a: any) => a.productId === productId).length || 0;
    const subsCount = subscriptions?.filter((s: any) => s.productId === productId).length || 0;
    return { accountsCount, subsCount };
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  return (
    <div className="flex-1 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">المنتجات</h1>
          <p className="text-muted-foreground mt-2">إدارة المنتجات والخدمات المتاحة</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="h-4 w-4" />
              إضافة منتج جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المنتج</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} data-testid="input-product-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="standardPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السعر القياسي (ر.س)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-product-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع الخطة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">شهري</SelectItem>
                          <SelectItem value="yearly">سنوي</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الحالة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="inactive">غير نشط</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-product">
                    {editingProduct ? "حفظ التعديلات" : "إضافة"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-products"
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط فقط</SelectItem>
            <SelectItem value="inactive">غير نشط فقط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProducts && filteredProducts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const stats = getProductStats(product.id);
            return (
              <Card key={product.id} className="hover-elevate transition-all flex flex-col" data-testid={`card-product-${product.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-1">{product.name}</CardTitle>
                      <CardDescription className="text-xs">{product.description || "لا يوجد وصف"}</CardDescription>
                    </div>
                    <Badge variant={product.status === "active" ? "default" : "secondary"} className="flex-shrink-0">
                      {product.status === "active" ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">السعر</p>
                      <p className="font-semibold">{product.standardPrice} ر.س</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">الخطة</p>
                      <p className="font-semibold">{product.planType === "monthly" ? "شهري" : "سنوي"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">الحسابات</p>
                      <p className="font-semibold">{stats.accountsCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">الاشتراكات</p>
                      <p className="font-semibold">{stats.subsCount}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(product)} data-testid={`button-edit-${product.id}`}>
                      <Edit className="h-3.5 w-3.5 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant={product.status === "active" ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(product)}
                      data-testid={`button-toggle-${product.id}`}
                    >
                      <Power className="h-3.5 w-3.5 ml-1" />
                      {product.status === "active" ? "تعطيل" : "تفعيل"}
                    </Button>
                    {stats.accountsCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedProductAccounts(product.id)}
                        data-testid={`button-view-accounts-${product.id}`}
                      >
                        <Package className="h-3.5 w-3.5 ml-1" />
                        عرض
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد منتجات</h3>
            <p className="text-sm text-muted-foreground">ابدأ بإضافة أول منتج لك</p>
          </CardContent>
        </Card>
      )}

      {/* Accounts Dialog */}
      <Dialog open={!!selectedProductAccounts} onOpenChange={(open) => !open && setSelectedProductAccounts(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              الحسابات الرئيسية - {products?.find(p => p.id === selectedProductAccounts)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {masterAccounts
              ?.filter(account => account.productId === selectedProductAccounts)
              .map(account => (
                <Card key={account.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{account.accountName}</p>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>السعة: {account.maxCapacity}</span>
                        <span>المستخدم: {account.currentUsage}</span>
                        <span>{Math.round((account.currentUsage / account.maxCapacity) * 100)}%</span>
                      </div>
                    </div>
                    <Badge variant={account.isActive ? "default" : "secondary"}>
                      {account.isActive ? "فعّال" : "معطّل"}
                    </Badge>
                  </div>
                </Card>
              ))}
            {masterAccounts?.filter(account => account.productId === selectedProductAccounts).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد حسابات رئيسية</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
