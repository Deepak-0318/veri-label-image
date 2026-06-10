import { useState, useRef, useCallback, useEffect } from "react";
import { TextHighlightAnnotation, TagColor } from "@/types/annotation";
import { cn } from "@/lib/utils";

interface TextAnnotationViewProps {
  content: string;
  annotations: TextHighlightAnnotation[];
  activeLabel: string;
  activeColor: TagColor;
  selectedAnnotation: string | null;
  onAnnotationCreate: (annotation: TextHighlightAnnotation) => void;
  onAnnotationSelect: (id: string | null) => void;
}

const colorMap: Record<TagColor, { bg: string; border: string }> = {
  blue: { bg: 'bg-blue-500/30', border: 'border-blue-500' },
  green: { bg: 'bg-green-500/30', border: 'border-green-500' },
  yellow: { bg: 'bg-yellow-500/30', border: 'border-yellow-500' },
  purple: { bg: 'bg-purple-500/30', border: 'border-purple-500' },
  pink: { bg: 'bg-pink-500/30', border: 'border-pink-500' },
  orange: { bg: 'bg-orange-500/30', border: 'border-orange-500' },
  cyan: { bg: 'bg-cyan-500/30', border: 'border-cyan-500' },
  red: { bg: 'bg-red-500/30', border: 'border-red-500' },
};

export function TextAnnotationView({
  content,
  annotations,
  activeLabel,
  activeColor,
  selectedAnnotation,
  onAnnotationCreate,
  onAnnotationSelect,
}: TextAnnotationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    // Check if selection is within our container
    if (!container.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Calculate offsets relative to the full content
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(container);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preCaretRange.toString().length;
    const endOffset = startOffset + text.length;

    const newAnnotation: TextHighlightAnnotation = {
      id: crypto.randomUUID(),
      type: 'textHighlight',
      startOffset,
      endOffset,
      text,
      label: activeLabel,
      color: activeColor,
    };

    onAnnotationCreate(newAnnotation);
    selection.removeAllRanges();
  }, [activeLabel, activeColor, onAnnotationCreate]);

  // Build highlighted text with annotations
  const renderContent = () => {
    if (annotations.length === 0) {
      return <span>{content}</span>;
    }

    // Sort annotations by start offset
    const sortedAnnotations = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
    
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedAnnotations.forEach((annotation, index) => {
      // Add text before this annotation
      if (annotation.startOffset > lastEnd) {
        elements.push(
          <span key={`text-${index}`}>
            {content.slice(lastEnd, annotation.startOffset)}
          </span>
        );
      }

      // Add highlighted text
      const isSelected = annotation.id === selectedAnnotation;
      const colors = colorMap[annotation.color];
      
      elements.push(
        <span
          key={annotation.id}
          onClick={(e) => {
            e.stopPropagation();
            onAnnotationSelect(annotation.id);
          }}
          className={cn(
            "cursor-pointer px-0.5 rounded transition-all",
            colors.bg,
            isSelected && `ring-2 ${colors.border}`
          )}
          title={annotation.label}
        >
          {content.slice(annotation.startOffset, annotation.endOffset)}
        </span>
      );

      lastEnd = Math.max(lastEnd, annotation.endOffset);
    });

    // Add remaining text
    if (lastEnd < content.length) {
      elements.push(
        <span key="text-end">{content.slice(lastEnd)}</span>
      );
    }

    return elements;
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      onClick={() => onAnnotationSelect(null)}
      className="p-6 bg-card rounded-xl border border-border text-foreground leading-relaxed whitespace-pre-wrap select-text cursor-text flex-1 overflow-auto"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
    >
      {renderContent()}
    </div>
  );
}
