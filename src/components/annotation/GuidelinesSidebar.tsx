import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { GuidelinesContent } from "./GuidelinesContent";
import { cn } from "@/lib/utils";

import { useGuidelinesShortcut } from "@/hooks/useGuidelinesShortcut";

interface GuidelinesSidebarProps {
  guidelines: string | null;
  projectName?: string;
  className?: string;
}

export function GuidelinesSidebar({ guidelines, projectName, className }: GuidelinesSidebarProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("verilabel_guidelines_sidebar_open") !== "false";
    } catch {
      return true;
    }
  });

  const handleOpenToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem("verilabel_guidelines_sidebar_open", String(next));
    } catch {}
  }, [open]);

  useGuidelinesShortcut(handleOpenToggle);

  return (
    <div
      className={cn(
        "flex h-full border-l border-border bg-card/40 transition-all duration-300",
        open ? "w-[340px]" : "w-12",
        className
      )}
    >
      {/* Mini collapsed strip */}
      {!open ? (
        <div className="w-full flex flex-col items-center pt-4 space-y-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenToggle}
            className="h-8 w-8 hover:bg-secondary"
            title="Open Guidelines"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex-1 flex items-center">
            <span className="rotate-90 origin-center text-xs tracking-wider text-muted-foreground uppercase whitespace-nowrap">
              Guidelines
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenToggle}
            className="h-8 w-8 hover:bg-secondary mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        /* Full guidelines panel */
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Guidelines
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenToggle}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {projectName && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 shrink-0">
              {projectName}
            </p>
          )}
          <div className="flex-1 overflow-hidden">
            <GuidelinesContent guidelines={guidelines} />
          </div>
        </div>
      )}
    </div>
  );
}
