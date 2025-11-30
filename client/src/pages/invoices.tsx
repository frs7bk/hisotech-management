import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, CheckCircle, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInvoiceSchema, type Invoice, type InsertInvoice } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";

const invoiceFormSchema = insertInvoiceSchema
  .omit({ subscriptionId: true })
  .extend({
    invoiceNumber: z.string().min(1, "رقم الفاتورة مطلوب"),
    customerName: z.string().min(1, "اسم العميل مطلوب"),
    customerEmail: z.string().email("البريد الإلكتروني غير صحيح"),
    amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "المبلغ يجب أن يكون أكبر من 0"),
    dueDate: z.date().min(new Date(), "تاريخ الاستحقاق يجب أن يكون في المستقبل"),
  });

export default function Invoices() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const form = useForm({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      customerName: "",
      customerEmail: "",
      amount: "",
      status: "unpaid",
      dueDate: new Date(),
      currency: "SAR",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const dueDate = data.dueDate instanceof Date ? data.dueDate.toISOString() : new Date(data.dueDate).toISOString();
      return await apiRequest("POST", "/api/invoices", {
        invoiceNumber: data.invoiceNumber.trim(),
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
        amount: String(parseFloat(data.amount)),
        currency: data.currency || "SAR",
        status: data.status || "unpaid",
        dueDate: dueDate,
        notes: data.notes?.trim() || "",
        paidDate: null,
        subscriptionId: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "تم إنشاء الفاتورة بنجاح" });
    },
    onError: (error: any) => {
      console.error("Invoice creation error:", error);
      toast({ 
        title: "خطأ في الإنشاء", 
        description: error.message || "حدث خطأ أثناء إنشاء الفاتورة",
        variant: "destructive"
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/invoices/${id}`, {
        status: "paid",
        paidDate: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "تم تحديث حالة الفاتورة" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">مدفوعة</Badge>;
      case "unpaid":
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">غير مدفوعة</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">متأخرة</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">الفواتير</h1>
          <p className="text-muted-foreground mt-2">إدارة وتتبع الفواتير</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-invoice" title="إنشاء فاتورة جديدة">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">إنشاء فاتورة جديدة</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-3">
                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">رقم الفاتورة</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="INV-001" data-testid="input-invoice-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">اسم العميل</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="أحمد محمد" data-testid="input-customer-name" />
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
                        <FormLabel className="text-sm">البريد الإلكتروني</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="customer@example.com" inputMode="email" data-testid="input-customer-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">المبلغ (ر.س)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} placeholder="0.00" inputMode="decimal" data-testid="input-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">تاريخ الاستحقاق</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">الحالة</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unpaid">غير مدفوعة</SelectItem>
                            <SelectItem value="paid">مدفوعة</SelectItem>
                            <SelectItem value="overdue">متأخرة</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">ملاحظات (اختياري)</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} placeholder="ملاحظات إضافية..." className="resize-none min-h-16" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-invoice">
                    {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const exportData = (invoices || []).map(inv => ({
                invoiceNumber: inv.invoiceNumber,
                customerName: inv.customerName,
                customerEmail: inv.customerEmail,
                amount: inv.amount,
                status: inv.status,
                dueDate: new Date(inv.dueDate).toLocaleDateString("ar-SA"),
              }));
              exportToCSV(exportData, "الفواتير");
            }}
            data-testid="button-export-invoices"
            title="تصدير الفواتير (CSV)"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">تصدير</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      ) : invoices && invoices.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div>{invoice.customerName}</div>
                        <div className="text-sm text-muted-foreground">{invoice.customerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.amount} ر.س</TableCell>
                    <TableCell>{format(new Date(invoice.dueDate), "yyyy-MM-dd", { locale: ar })}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-left">
                      {invoice.status !== "paid" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsPaidMutation.mutate(invoice.id)}
                          data-testid={`button-mark-paid-${invoice.id}`}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          تعليم كمدفوعة
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Plus className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد فواتير</h3>
            <p className="text-sm text-muted-foreground">ابدأ بإنشاء أول فاتورة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
