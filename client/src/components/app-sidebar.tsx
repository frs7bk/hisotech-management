import {
  LayoutDashboard,
  Package,
  Server,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  MessageSquare,
  Bell,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "لوحة التحكم",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "المنتجات",
    url: "/products",
    icon: Package,
  },
  {
    title: "الحسابات الرئيسية",
    url: "/master-accounts",
    icon: Server,
  },
  {
    title: "الاشتراكات",
    url: "/subscriptions",
    icon: Users,
  },
  {
    title: "الإيرادات والمصاريف",
    url: "/finances",
    icon: DollarSign,
  },
  {
    title: "الفواتير",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "التقارير",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "المساعد الذكي",
    url: "/assistant",
    icon: MessageSquare,
  },
  {
    title: "الإشعارات",
    url: "/notifications",
    icon: Bell,
  },
  {
    title: "الإعدادات",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar side="right">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-6">
            نظام الاشتراكات
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={isActive ? "bg-sidebar-accent" : ""}
                      data-testid={`link-${item.url.slice(1) || "dashboard"}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
