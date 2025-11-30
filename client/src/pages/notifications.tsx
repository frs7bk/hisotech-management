import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Bell, CheckCheck, AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Notifications() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
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
      return await apiRequest("POST", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "تم تعليم جميع الإشعارات كمقروءة" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/notifications/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "تم حذف الإشعار" });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "subscription_expiring":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case "account_capacity":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "expense_due":
        return <Info className="h-5 w-5 text-blue-600" />;
      case "invoice_unpaid":
        return <Info className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="flex-1 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">الإشعارات</h1>
          <p className="text-muted-foreground mt-2">
            {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات غير مقروءة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllAsReadMutation.mutate()} disabled={markAllAsReadMutation.isPending} data-testid="button-mark-all-read">
            <CheckCheck className="h-4 w-4" />
            تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`hover-elevate transition-all cursor-pointer ${!notification.isRead ? "border-primary" : ""}`}
              data-testid={`notification-${notification.id}`}
              onClick={() => {
                // إذا كان الإشعار متعلقاً باشتراك
                if ((notification.type === "subscription_expiring_soon" || notification.type === "subscription_expired") && notification.relatedId) {
                  sessionStorage.setItem("highlightSubscriptionIds", JSON.stringify([notification.relatedId]));
                  navigate("/subscriptions");
                }
                if (!notification.isRead) {
                  markAsReadMutation.mutate(notification.id);
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{notification.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(notification.createdAt), "yyyy-MM-dd HH:mm", { locale: ar })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs">جديد</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(notification.id);
                          }}
                          disabled={deleteNotificationMutation.isPending}
                          data-testid={`button-delete-notification-${notification.id}`}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد إشعارات</h3>
            <p className="text-sm text-muted-foreground">ستظهر الإشعارات هنا عند توفرها</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
