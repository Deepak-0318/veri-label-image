/**
 * Infer the MIME-type category from a file's name extension.
 * Useful when the stored `type` is generic (e.g. "application/octet-stream")
 * because the file was imported via an external drive link.
 */

const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v", ".wmv"];
const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma"];
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".tiff"];
const SPREADSHEET_EXTS = [".csv", ".tsv", ".xlsx", ".xls"];

export function inferFileType(fileName: string, storedType: string | undefined | null): string {
  // If the stored type is already specific, return it
  if (storedType && storedType !== "application/octet-stream" && storedType !== "") {
    return storedType;
  }

  const ext = fileName.toLowerCase();

  if (ext.endsWith(".pdf")) return "application/pdf";
  if (ext.endsWith(".mcap")) return "application/mcap";
  if (ext.endsWith(".pcd")) return "application/pcd";
  if (ext.endsWith(".npz")) return "application/npz";
  if (ext.endsWith(".m4a")) return "audio/mp4";
  if (VIDEO_EXTS.some(e => ext.endsWith(e))) return "video/" + ext.split(".").pop();
  if (AUDIO_EXTS.some(e => ext.endsWith(e))) return "audio/" + ext.split(".").pop();
  if (IMAGE_EXTS.some(e => ext.endsWith(e))) return "image/" + ext.split(".").pop();
  if (SPREADSHEET_EXTS.some(e => ext.endsWith(e))) return "application/spreadsheet";
  if (ext.endsWith(".txt") || ext.endsWith(".md") || ext.endsWith(".json") || ext.endsWith(".xml")) return "text/plain";

  return storedType || "application/octet-stream";
}

/** Get the effective URL for a file — uses external_url for reference files, thumbnail_url for copied files */
export function getFileUrl(file: { storage_mode: string; external_url?: string | null; thumbnail_url?: string | null }): string | null {
  if (file.storage_mode === "reference" && file.external_url) return file.external_url;
  return file.thumbnail_url || null;
}
