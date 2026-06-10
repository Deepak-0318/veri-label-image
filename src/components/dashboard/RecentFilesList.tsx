import { FileText, Image, Music, Video, FileSpreadsheet, File } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RecentFilesListProps {
  files: { id: string; name: string; type: string; created_at: string; project_id?: string | null }[];
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("audio/")) return Music;
  if (type.startsWith("video/")) return Video;
  if (type.includes("pdf")) return FileText;
  if (type.includes("sheet") || type.includes("csv")) return FileSpreadsheet;
  return File;
}

function getIconColor(type: string) {
  if (type.startsWith("image/")) return "text-tag-blue bg-tag-blue/10";
  if (type.startsWith("audio/")) return "text-tag-orange bg-tag-orange/10";
  if (type.startsWith("video/")) return "text-tag-purple bg-tag-purple/10";
  if (type.includes("pdf")) return "text-tag-red bg-tag-red/10";
  return "text-tag-green bg-tag-green/10";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function RecentFilesList({ files }: RecentFilesListProps) {
  const recent = files.slice(0, 6);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Files</CardTitle>
        <CardDescription>Latest uploads in your workspace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No files yet</p>
        )}
        {recent.map((file) => {
          const Icon = getFileIcon(file.type);
          const colorCls = getIconColor(file.type);
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left"
            >
              <div className={cn("rounded-md p-2", colorCls)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(file.created_at)}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
