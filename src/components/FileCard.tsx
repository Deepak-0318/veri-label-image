import { cn } from "@/lib/utils";
import { FileText, Image, Music, Video, File, MoreVertical, Tag, Trash2, Download, Pencil, FolderPlus, FolderOpen, Link } from "lucide-react";
import { toast } from "sonner";
import { TagBadge } from "./TagBadge";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { FileRecord } from "@/hooks/useFiles";
import { apiFetch } from "@/services/api";

type TagColor = "blue" | "green" | "yellow" | "purple" | "pink" | "orange" | "cyan" | "red";

interface FileTag {
  id: string;
  label: string;
  color: TagColor;
}

interface FileCardProps {
  file: FileRecord;
  tags?: FileTag[];
  datasetNames?: string[];
  projectId?: string;
  onAddTag?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  onAddToDataset?: () => void;
  isSelected?: boolean;
  className?: string;
}

function getFileIcon(type: string) {
  if (type.startsWith("image")) return { icon: Image, bg: "bg-blue-500/10", color: "text-blue-500", accent: "from-blue-500/5 to-blue-400/10" };
  if (type.startsWith("audio")) return { icon: Music, bg: "bg-pink-500/10", color: "text-pink-500", accent: "from-pink-500/5 to-pink-400/10" };
  if (type.startsWith("video")) return { icon: Video, bg: "bg-purple-500/10", color: "text-purple-500", accent: "from-purple-500/5 to-purple-400/10" };
  if (type.startsWith("text") || type.includes("document") || type.includes("pdf") || type.includes("spreadsheet") || type.includes("csv") || type.includes("excel"))
    return { icon: FileText, bg: "bg-amber-500/10", color: "text-amber-500", accent: "from-amber-500/5 to-amber-400/10" };
  return { icon: File, bg: "bg-muted", color: "text-muted-foreground", accent: "from-muted/50 to-muted" };
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function FileCard({ file, tags = [], datasetNames = [], projectId, onAddTag, onDelete, onSelect, onAddToDataset, isSelected, className }: FileCardProps) {
  const { icon: Icon, bg: iconBg, color: iconColor, accent: iconAccent } = getFileIcon(file.type);
  const navigate = useNavigate();

  const handleAnnotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(projectId ? `/annotate/${projectId}/${file.id}` : `/annotate/${file.id}`);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const toastId = toast.loading(`Downloading "${file.name}"...`);
    try {
      if (file.storage_mode === "reference" && file.external_url) {
        window.open(file.external_url, "_blank");
        toast.dismiss(toastId);
        toast.info("Opened external file in a new tab");
      } else if (file.thumbnail_url) {
        const response = await apiFetch(file.thumbnail_url);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`"${file.name}" downloaded`, { id: toastId });
      } else {
        toast.error("No download URL available", { id: toastId });
      }
    } catch {
      toast.error(`Failed to download "${file.name}"`, { id: toastId });
      if (file.thumbnail_url) window.open(file.thumbnail_url, "_blank");
    }
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 cursor-pointer",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
    >
      {/* Thumbnail / Icon area */}
      <div className="relative aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden">
        {file.thumbnail_url && file.type.startsWith("image") ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${iconAccent} flex flex-col items-center justify-center gap-2`}>
            <div className={`h-14 w-14 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`h-7 w-7 ${iconColor}`} />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {file.type.split("/").pop()?.split(".").pop() || file.type.split("/")[0]}
            </span>
          </div>
        )}
        
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
              <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        
        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">

          <DropdownMenuItem
            onClick={handleAnnotate}
            className="cursor-pointer"
          >
          <Pencil className="h-4 w-4 mr-2" />
          Open Annotation
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onAddToDataset} className="cursor-pointer">
          <FolderPlus className="h-4 w-4 mr-2" />
          Add to Dataset
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onAddTag} className="cursor-pointer">
          <Tag className="h-4 w-4 mr-2" />
          Add Tag
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
          <Download className="h-4 w-4 mr-2" />
          Download
          </DropdownMenuItem>

        <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive">
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
        </DropdownMenuItem>

        </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-medium text-sm truncate" title={file.name}>
            {file.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {file.storage_mode === "reference" && (
              <span className="inline-flex items-center gap-0.5 text-primary" title="External reference — not copied to storage">
                <Link className="h-3 w-3" />
              </span>
            )}
            {formatFileSize(file.size)} • {formatDate(file.created_at)}
          </p>
        </div>

        {/* Dataset badges */}
        {datasetNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {datasetNames.slice(0, 2).map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground"
              >
                <FolderOpen className="h-2.5 w-2.5" />
                {name}
              </span>
            ))}
            {datasetNames.length > 2 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{datasetNames.length - 2} more
              </span>
            )}
          </div>
        )}
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag.id} label={tag.label} color={tag.color} />
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                +{tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
