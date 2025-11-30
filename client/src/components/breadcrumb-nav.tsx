import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronLeft } from "lucide-react";

const pageTitles: Record<string, { title: string; parent?: string; parentTitle?: string }> = {
  "/": { title: "لوحة التحكم" },
  "/products": { title: "المنتجات" },
  "/master-accounts": { title: "الحسابات الرئيسية" },
  "/subscriptions": { title: "الاشتراكات" },
  "/finances": { title: "الإيرادات والمصاريف" },
  "/invoices": { title: "الفواتير" },
  "/reports": { title: "التقارير" },
  "/assistant": { title: "المساعد الذكي" },
  "/notifications": { title: "الإشعارات" },
};

export function BreadcrumbNav() {
  const [location] = useLocation();

  const breadcrumbs = generateBreadcrumbs(location);

  return (
    <div className="px-8 py-3 border-b bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-2">
              {index > 0 && <BreadcrumbSeparator><ChevronLeft className="h-4 w-4" /></BreadcrumbSeparator>}
              {crumb.isActive ? (
                <BreadcrumbItem>
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={crumb.path}>{crumb.label}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              )}
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

function generateBreadcrumbs(location: string) {
  const breadcrumbs: { path: string; label: string; isActive: boolean }[] = [
    { path: "/", label: "الرئيسية", isActive: location === "/" },
  ];

  if (location !== "/") {
    const pageInfo = pageTitles[location];
    if (pageInfo) {
      breadcrumbs.push({
        path: location,
        label: pageInfo.title,
        isActive: true,
      });
    }
  }

  return breadcrumbs;
}
