import { Folder, MoreVertical, Pencil, Trash2, FolderOutput } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface FolderCardProps {
  name: string;
  fileCount: number;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function FolderCard({ name, fileCount, onOpen, onRename, onDelete, className }: FolderCardProps) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative rounded-xl border border-border bg-card p-4 cursor-pointer transition-all duration-200",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">{name}</h4>
          <p className="text-xs text-muted-foreground">
            {fileCount} file{fileCount !== 1 ? "s" : ""}
          </p>
        </div>
        {(onRename || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              {onRename && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="cursor-pointer text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Folder
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
