import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Bell, Search, Clock, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { SHORTCUTS, isShortcutMatch, getShortcutDisplay } from "@/lib/shortcuts";
import type { Notification } from "@shared/schema";

import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import MasterAccounts from "@/pages/master-accounts";
import Subscriptions from "@/pages/subscriptions";
import Finances from "@/pages/finances";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Assistant from "@/pages/assistant";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/master-accounts" component={MasterAccounts} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/finances" component={Finances} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/reports" component={Reports} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [_location, navigate] = useLocation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
  const unreadNotifications = notifications?.filter(n => !n.isRead) || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "expiring_soon":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "expired":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="بحث سريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
            data-testid="input-search"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              data-testid="button-notifications-popover"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start" side="bottom">
            <Card className="border-0 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
                <CardTitle className="text-sm">الإشعارات</CardTitle>
                {unreadCount > 0 && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => markAllAsReadMutation.mutate()}
                    data-testid="button-mark-all-read"
                  >
                    وضع علامة على الكل
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {unreadNotifications.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2 p-4">
                      {unreadNotifications.map((notification) => (
                        <div 
                          key={notification.id}
                          onClick={() => {
                            // إذا كان الإشعار متعلقاً باشتراك
                            if ((notification.type === "subscription_expiring_soon" || notification.type === "subscription_expired") && notification.relatedId) {
                              sessionStorage.setItem("highlightSubscriptionIds", JSON.stringify([notification.relatedId]));
                              navigate("/subscriptions");
                              setPopoverOpen(false);
                            }
                            markAsReadMutation.mutate(notification.id);
                          }}
                          className="flex gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(notification.createdAt), "HH:mm", { locale: ar })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">لا توجد إشعارات جديدة</p>
                  </div>
                )}
                <div className="border-t p-3">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="w-full text-xs"
                    onClick={() => {
                      navigate("/notifications");
                      setPopoverOpen(false);
                    }}
                    data-testid="button-view-all-notifications"
                  >
                    عرض جميع الإشعارات →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
        <ThemeToggle />
      </div>
    </header>
  );
}

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const categories = ['navigation', 'ui', 'actions'] as const;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            اختصارات لوحة المفاتيح
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryShortcuts = SHORTCUTS.filter(s => s.category === category);
            const categoryNames: Record<string, string> = {
              navigation: 'التنقل',
              ui: 'واجهة المستخدم',
              actions: 'الإجراءات',
            };
            
            return (
              <div key={category}>
                <h3 className="font-semibold text-sm mb-3">{categoryNames[category]}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categoryShortcuts.map((shortcut) => (
                    <div key={shortcut.action} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <span className="text-sm">{shortcut.description}</span>
                      <Badge variant="outline" className="text-xs">
                        {getShortcutDisplay(shortcut)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  const [, navigate] = useLocation();
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // تجاهل الإدخال إذا كان داخل input أو textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        if (!(event.ctrlKey || event.metaKey) || event.key !== 'k') {
          return;
        }
      }

      for (const shortcut of SHORTCUTS) {
        if (isShortcutMatch(event, shortcut)) {
          event.preventDefault();

          switch (shortcut.action) {
            case 'search':
              // Ctrl+K للبحث - يمكن توسيع لاحقاً
              break;
            case 'help':
              setShowShortcutsDialog(true);
              break;
            case 'close':
              // Escape لإغلاق النوافذ المنبثقة
              setShowShortcutsDialog(false);
              break;
            case 'navigate-dashboard':
              navigate('/');
              break;
            case 'navigate-products':
              navigate('/products');
              break;
            case 'navigate-subscriptions':
              navigate('/subscriptions');
              break;
            case 'new':
              // يمكن توسيع لاحقاً بناءً على الصفحة الحالية
              break;
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <TopBar />
                <BreadcrumbNav />
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
          <ShortcutsDialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog} />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
