// تصدير البيانات بصيغ مختلفة
export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  if (!data || data.length === 0) {
    return;
  }

  // الحصول على جميع المفاتيح من الكائن الأول
  const keys = headers || Object.keys(data[0]);
  
  // رأس الجدول
  const csv = [
    keys.join(","),
    ...data.map(item =>
      keys.map(key => {
        const value = item[key];
        if (value === null || value === undefined) return "";
        // تحويل التواريخ إلى صيغة مقروءة
        if (value instanceof Date) {
          return value.toLocaleDateString("ar-SA");
        }
        // وضع علامات اقتباس حول النصوص التي تحتوي على فواصل
        const stringValue = String(value);
        return stringValue.includes(",") ? `"${stringValue}"` : stringValue;
      }).join(",")
    )
  ].join("\n");

  downloadFile(csv, `${filename}.csv`, "text/csv");
};

export const exportToJSON = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    return;
  }

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, "application/json");
};

export const exportToPDF = async (
  data: any[],
  filename: string,
  columns: { key: string; label: string }[]
) => {
  // هذا يتطلب مكتبة pdfkit أو jspdf
  // سنستخدم CSV للآن كبديل سريع
  const csv = [
    columns.map(c => c.label).join(","),
    ...data.map(item =>
      columns.map(c => item[c.key] || "").join(",")
    )
  ].join("\n");

  downloadFile(csv, `${filename}.csv`, "text/csv");
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getSubscriptionExportHeaders = () => [
  { key: "customerName", label: "اسم العميل" },
  { key: "customerEmail", label: "البريد الإلكتروني" },
  { key: "productId", label: "المنتج" },
  { key: "price", label: "السعر" },
  { key: "status", label: "الحالة" },
  { key: "startDate", label: "تاريخ البدء" },
  { key: "endDate", label: "تاريخ الانتهاء" },
];

export const getInvoiceExportHeaders = () => [
  { key: "invoiceNumber", label: "رقم الفاتورة" },
  { key: "customerName", label: "اسم العميل" },
  { key: "customerEmail", label: "البريد الإلكتروني" },
  { key: "amount", label: "المبلغ" },
  { key: "status", label: "الحالة" },
  { key: "dueDate", label: "تاريخ الاستحقاق" },
];

export const getRevenueExportHeaders = () => [
  { key: "description", label: "الوصف" },
  { key: "amount", label: "المبلغ" },
  { key: "type", label: "النوع" },
  { key: "date", label: "التاريخ" },
  { key: "currency", label: "العملة" },
];

export const getExpenseExportHeaders = () => [
  { key: "description", label: "الوصف" },
  { key: "amount", label: "المبلغ" },
  { key: "category", label: "الفئة" },
  { key: "date", label: "التاريخ" },
  { key: "isPaid", label: "هل تم الدفع" },
];
