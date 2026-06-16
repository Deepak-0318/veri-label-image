import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { GuidelinesContent } from "./GuidelinesContent";

import { useGuidelinesShortcut } from "@/hooks/useGuidelinesShortcut";

interface GuidelinesDrawerProps {
  guidelines: string | null;
  projectName?: string;
  triggerClassName?: string;
}

export function GuidelinesDrawer({ guidelines, projectName, triggerClassName }: GuidelinesDrawerProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("verilabel_guidelines_open") === "true";
    } catch {
      return false;
    }
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    try {
      localStorage.setItem("verilabel_guidelines_open", String(isOpen));
    } catch {}
  };

  useGuidelinesShortcut(() => {
    handleOpenChange(!open);
  });

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={triggerClassName}
        >
          <BookOpen className="h-4 w-4 mr-1.5" />
          Guidelines
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg flex flex-col h-full bg-background border-border shadow-2xl p-6">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="h-5 w-5 text-primary" />
            Annotation Guidelines
          </SheetTitle>
          {projectName && (
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Project: {projectName}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <GuidelinesContent guidelines={guidelines} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
