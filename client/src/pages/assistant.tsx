import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في إدارة المنتجات، الاشتراكات، المصاريف، والتقارير. كيف يمكنني مساعدتك اليوم?" }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("POST", "/api/assistant/chat", { message });
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: "user", content: input }]);
    chatMutation.mutate(input);
    setInput("");
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">المساعد الذكي</h1>
        <p className="text-muted-foreground mt-2">اطرح أي سؤال أو اطلب أي مساعدة</p>
      </div>

      <Card className="h-[calc(100vh-16rem)]">
        <CardHeader>
          <CardTitle>محادثة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}
                  data-testid={`message-${message.role}-${index}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري التفكير...</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              disabled={chatMutation.isPending}
              data-testid="input-message"
              className="flex-1"
            />
            <Button type="submit" disabled={chatMutation.isPending} data-testid="button-send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
