import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, X, Tag, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronRightIcon } from "lucide-react";
import { Annotation, RowAnnotation, TagColor } from "@/types/annotation";
import { Label } from "@/hooks/useLabels";
import { toast } from "sonner";

const TAG_COLORS: { value: TagColor; bg: string; text: string }[] = [
  { value: "blue", bg: "bg-blue-500/20", text: "text-blue-400" },
  { value: "green", bg: "bg-green-500/20", text: "text-green-400" },
  { value: "yellow", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  { value: "purple", bg: "bg-purple-500/20", text: "text-purple-400" },
  { value: "pink", bg: "bg-pink-500/20", text: "text-pink-400" },
  { value: "orange", bg: "bg-orange-500/20", text: "text-orange-400" },
  { value: "cyan", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  { value: "red", bg: "bg-red-500/20", text: "text-red-400" },
];

function getColorClasses(color: TagColor) {
  return TAG_COLORS.find(c => c.value === color) || TAG_COLORS[0];
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const result: string[][] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row: string[] = [];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
          currentField += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        row.push(currentField);
        currentField = "";
      } else {
        currentField += char;
      }
    }
    row.push(currentField);
    result.push(row);
    currentField = "";
    inQuotes = false;
  }

  if (result.length === 0) return { headers: [], rows: [] };

  const headers = result[0];
  const rows = result.slice(1);
  return { headers, rows };
}

/** Truncated cell with hover tooltip */
function TruncatedCell({
  content,
  onClick,
}: {
  content: string;
  onClick: () => void;
}) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = cellRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [content]);

  const cell = (
    <TableCell
      ref={cellRef}
      className="text-sm max-w-[200px] truncate cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      {content}
    </TableCell>
  );

  if (!isTruncated) return cell;

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-[320px] whitespace-normal break-words bg-popover text-popover-foreground text-sm p-3"
        avoidCollisions
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

interface SpreadsheetAnnotationViewProps {
  content: string;
  fileName: string;
  annotations: Annotation[];
  labels: Label[];
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationDelete: (id: string) => void;
  onLabelCreate: (label: Label) => void;
}

export function SpreadsheetAnnotationView({
  content,
  fileName,
  annotations,
  labels,
  onAnnotationCreate,
  onAnnotationDelete,
  onLabelCreate,
}: SpreadsheetAnnotationViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const PAGE_SIZE = 100;

  const { headers, rows } = useMemo(() => parseCSV(content), [content]);

  const rowAnnotations = useMemo(() => {
    const map = new Map<number, RowAnnotation[]>();
    annotations
      .filter((a): a is RowAnnotation => a.type === "rowAnnotation")
      .forEach(a => {
        const existing = map.get(a.rowIndex) || [];
        existing.push(a);
        map.set(a.rowIndex, existing);
      });
    return map;
  }, [annotations]);

  const filteredRowIndices = useMemo(() => {
    if (!searchQuery) return rows.map((_, i) => i);
    const q = searchQuery.toLowerCase();
    return rows
      .map((row, i) => ({ row, i }))
      .filter(({ row, i }) => {
        const rowLabels = rowAnnotations.get(i) || [];
        return (
          row.some(cell => cell.toLowerCase().includes(q)) ||
          rowLabels.some(a => a.label.toLowerCase().includes(q))
        );
      })
      .map(({ i }) => i);
  }, [rows, searchQuery, rowAnnotations]);

  const totalPages = Math.ceil(filteredRowIndices.length / PAGE_SIZE);
  const paginatedRowIndices = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredRowIndices.slice(start, start + PAGE_SIZE);
  }, [filteredRowIndices, currentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  // Close expansion panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCell(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleAssignLabel = useCallback(
    (rowIndex: number, labelName: string) => {
      const label = labels.find(l => l.name === labelName);
      if (!label) return;

      const existing = rowAnnotations.get(rowIndex) || [];
      if (existing.some(a => a.label === labelName)) {
        toast.info("Label already assigned to this row");
        return;
      }

      const annotation: RowAnnotation = {
        id: crypto.randomUUID(),
        type: "rowAnnotation",
        rowIndex,
        label: label.name,
        color: label.color,
      };
      onAnnotationCreate(annotation);
    },
    [labels, rowAnnotations, onAnnotationCreate]
  );

  const handleExportCSV = useCallback(() => {
    const annotationHeader = "Annotation";
    const exportHeaders = [...headers, annotationHeader];
    const exportRows = rows.map((row, i) => {
      const rowLabels = (rowAnnotations.get(i) || []).map(a => a.label).join("; ");
      return [...row, rowLabels];
    });

    const csvContent = [
      exportHeaders.join(","),
      ...exportRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = fileName.replace(/\.[^.]+$/, "");
    a.download = `${baseName}_annotated.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported annotated CSV");
  }, [headers, rows, rowAnnotations, fileName]);

  const toggleRowExpand = useCallback((rowIdx: number) => {
    setExpandedRow(prev => (prev === rowIdx ? null : rowIdx));
  }, []);

  if (headers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No data found in this file.</p>
      </div>
    );
  }

  const selectedCellContent = selectedCell
    ? rows[selectedCell.rowIdx]?.[selectedCell.colIdx] ?? ""
    : "";
  const selectedCellHeader = selectedCell
    ? headers[selectedCell.colIdx] ?? `Column ${selectedCell.colIdx + 1}`
    : "";

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rows or labels..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-xs text-muted-foreground ml-auto">
            {rows.length} rows · {annotations.filter(a => a.type === "rowAnnotation").length} annotations
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-lg border border-border min-w-0">
          <table className="w-max min-w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 text-center font-mono text-xs">#</TableHead>
                {headers.map((h, i) => (
                  <TableHead key={i} className="font-medium text-xs uppercase tracking-wider">
                    {h}
                  </TableHead>
                ))}
                <TableHead className="w-64 font-medium text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Annotation
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRowIndices.map(rowIdx => {
                const row = rows[rowIdx];
                const rowLabels = rowAnnotations.get(rowIdx) || [];
                const hasAnnotation = rowLabels.length > 0;
                const isExpanded = expandedRow === rowIdx;

                return (
                  <TableRow
                    key={rowIdx}
                    className={`${hasAnnotation ? "bg-primary/5" : ""} ${isExpanded ? "" : ""}`}
                  >
                    {/* Row number with expand toggle */}
                    <TableCell
                      className="text-center font-mono text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors select-none"
                      onClick={() => toggleRowExpand(rowIdx)}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRightIcon className="h-3 w-3 shrink-0" />
                        )}
                        {rowIdx + 1}
                      </div>
                    </TableCell>

                    {/* Data cells */}
                    {row.map((cell, ci) =>
                      isExpanded ? (
                        <TableCell
                          key={ci}
                          className="text-sm max-w-[200px] whitespace-normal break-words cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setSelectedCell({ rowIdx, colIdx: ci })}
                        >
                          {cell}
                        </TableCell>
                      ) : (
                        <TruncatedCell
                          key={ci}
                          content={cell}
                          onClick={() => setSelectedCell({ rowIdx, colIdx: ci })}
                        />
                      )
                    )}

                    {/* Pad if row has fewer columns */}
                    {row.length < headers.length &&
                      Array.from({ length: headers.length - row.length }).map((_, i) => (
                        <TableCell key={`pad-${i}`} />
                      ))}

                    {/* Annotation column */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rowLabels.map(a => {
                          const cc = getColorClasses(a.color);
                          return (
                            <Badge
                              key={a.id}
                              className={`${cc.bg} ${cc.text} border-0 cursor-pointer group`}
                              onClick={() => onAnnotationDelete(a.id)}
                              title="Click to remove"
                            >
                              {a.label}
                              <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Badge>
                          );
                        })}
                        <Select onValueChange={val => handleAssignLabel(rowIdx, val)}>
                          <SelectTrigger className="h-7 w-7 p-0 border-dashed border-muted-foreground/30 [&>svg]:hidden flex items-center justify-center">
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent>
                            {labels.map(l => {
                              const cc = getColorClasses(l.color);
                              return (
                                <SelectItem key={l.id} value={l.name}>
                                  <span className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${cc.bg}`} />
                                    {l.name}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>

        {/* Bottom Expansion Panel */}
        {selectedCell && (
          <div className="border border-border rounded-lg bg-card/80 overflow-hidden shrink-0">
            <div className="flex items-start gap-4 p-3" style={{ minHeight: 80, maxHeight: 200, overflow: "auto" }}>
              <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0 pt-0.5 min-w-[100px]">
                {selectedCellHeader}
              </span>
              <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {selectedCellContent}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setSelectedCell(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredRowIndices.length)} of {filteredRowIndices.length} rows
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
