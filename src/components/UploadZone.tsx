import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, Image, Music, Video, File, Loader2, FolderUp } from "lucide-react";
import { Button } from "./ui/button";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
  isUploading?: boolean;
}

const acceptedTypes = {
  "text/*": { icon: FileText, label: "Documents" },
  "image/*": { icon: Image, label: "Images" },
  "audio/*": { icon: Music, label: "Audio" },
  "video/*": { icon: Video, label: "Video" },
  "application/*": { icon: File, label: "Files" },
};

export function UploadZone({ onFilesSelected, className, isUploading = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isUploading) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, isUploading]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isUploading) return;
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      // Reset so the same selection can trigger again
      e.target.value = "";
    },
    [onFilesSelected, isUploading]
  );

  const handleDirectoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dirInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-300",
        isUploading ? "cursor-wait opacity-75" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "border-border hover:border-primary/50 hover:bg-card/50",
        className
      )}
    >
      <input
        type="file"
        multiple
        onChange={handleFileInput}
        disabled={isUploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
        accept="text/*,image/*,audio/*,video/*,application/*,.pdf,.doc,.docx,.txt,.csv,.json,.mcap,.pcd,.npz,.m4a"
      />
      {/* Hidden directory input */}
      <input
        ref={dirInputRef}
        type="file"
        multiple
        onChange={handleFileInput}
        disabled={isUploading}
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as any)}
      />
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div
          className={cn(
            "rounded-full p-4 mb-4 transition-all duration-300",
            isDragging
              ? "bg-primary/20 scale-110"
              : isUploading
              ? "bg-primary/10"
              : "bg-secondary group-hover:bg-primary/10"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )}
            />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {isUploading ? "Uploading..." : isDragging ? "Drop files here" : "Upload files"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isUploading ? "Please wait while your files are being uploaded" : "Drag and drop or click to browse"}
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {Object.entries(acceptedTypes).map(([type, { icon: Icon, label }]) => (
            <div
              key={type}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative z-10 gap-1.5"
          onClick={handleDirectoryClick}
          disabled={isUploading}
        >
          <FolderUp className="h-4 w-4" />
          Upload Directory
        </Button>
      </div>
    </div>
  );
}
