import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { Annotation, AnnotationTool, TagColor } from "@/types/annotation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import * as pdfjsLib from "pdfjs-dist";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfAnnotationViewProps {
  pdfUrl: string;
  annotations: Annotation[];
  activeTool: AnnotationTool;
  selectedAnnotation: string | null;
  activeLabel: string;
  activeColor: TagColor;
  zoom: number;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
}

export function PdfAnnotationView({
  pdfUrl,
  annotations,
  activeTool,
  selectedAnnotation,
  activeLabel,
  activeColor,
  zoom,
  onAnnotationCreate,
  onAnnotationSelect,
  onAnnotationUpdate,
}: PdfAnnotationViewProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [pageText, setPageText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const pageInputRef = useRef<HTMLInputElement>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error("Failed to fetch PDF");
        const arrayBuffer = await response.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF");
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;
    setLoading(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 2; // High-res rendering
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport }).promise;
      setPageImageUrl(canvas.toDataURL("image/png"));

      // Extract text
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      setPageText(text);
    } catch (err: any) {
      setError(err.message || "Failed to render page");
    } finally {
      setLoading(false);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(val)) goToPage(val);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <FileText className="h-16 w-16 opacity-40" />
        <p className="text-lg font-medium">Failed to load PDF</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-2 py-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Page</span>
          <Input
            ref={pageInputRef}
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            key={currentPage}
            onKeyDown={handlePageInput}
            className="w-16 h-8 text-center"
          />
          <span className="text-muted-foreground">of {totalPages}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF Page as Image for Annotation */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Rendering page {currentPage}...</span>
        </div>
      ) : pageImageUrl ? (
        <AnnotationCanvas
          imageSrc={pageImageUrl}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          zoom={zoom}
          onAnnotationCreate={onAnnotationCreate}
          onAnnotationSelect={onAnnotationSelect}
          onAnnotationUpdate={onAnnotationUpdate}
        />
      ) : null}

      {/* Extracted Text (collapsible) */}
      {pageText && (
        <Collapsible open={textOpen} onOpenChange={setTextOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              <FileText className="h-4 w-4 mr-2" />
              {textOpen ? "Hide" : "Show"} extracted text
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-48 overflow-auto rounded-lg bg-secondary/30 p-4 text-sm text-foreground whitespace-pre-wrap">
              {pageText}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
