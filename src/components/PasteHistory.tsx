import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Clock, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";

interface PasteHistoryItem {
  key: string;
  title?: string;
  createdAt: string;
  expiresAt: string;
}

export const PasteHistory = () => {
  const [history, setHistory] = useState<PasteHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, [open]);

  const loadHistory = () => {
    const stored = localStorage.getItem("pasteHistory");
    if (stored) {
      const items = JSON.parse(stored) as PasteHistoryItem[];
      // Sort by creation date, newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(items);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("🔑 Key copied to clipboard!");
  };

  const handleOpen = (key: string) => {
    navigate(`/view?key=${key}`);
    setOpen(false);
  };

  const handleClearHistory = () => {
    localStorage.removeItem("pasteHistory");
    setHistory([]);
    toast.success("History cleared");
  };

  const isExpired = (expiresAt: string) => {
    return isPast(parseISO(expiresAt));
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Clock className="w-4 h-4" />
          My History
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>My Paste History</DrawerTitle>
          <DrawerDescription>
            Pastes created from this browser
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]">
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No paste history yet. Create your first paste!
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const expired = isExpired(item.expiresAt);
                return (
                  <Card
                    key={item.key}
                    className={`p-4 ${expired ? "opacity-50 border-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-sm truncate">
                            {item.title || "Untitled Paste"}
                          </h3>
                          {expired && (
                            <Badge variant="secondary" className="text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="font-mono">Key: {item.key}</p>
                          <p>Created: {format(parseISO(item.createdAt), "PPp")}</p>
                          <p>Expires: {format(parseISO(item.expiresAt), "PPp")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyKey(item.key)}
                          className="gap-1"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpen(item.key)}
                          disabled={expired}
                          className="gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        <DrawerFooter className="border-t">
          <div className="flex gap-2 w-full">
            {history.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleClearHistory}
                className="gap-2 flex-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear History
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
