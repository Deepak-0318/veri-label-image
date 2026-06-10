import { useCallback, useRef, useState } from "react";
import { Annotation } from "@/types/annotation";

type ActionType = "create" | "update" | "delete";

interface HistoryEntry {
  type: ActionType;
  annotation: Annotation;
  previousAnnotation?: Annotation;
}

export function useAnnotationHistory({
  annotations,
  onCreate,
  onUpdate,
  onDelete,
}: {
  annotations: Annotation[];
  onCreate: (annotation: Annotation) => void;
  onUpdate: (annotation: Annotation) => void;
  onDelete: (id: string) => void;
}) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => t + 1), []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const pushUndo = useCallback((entry: HistoryEntry) => {
    undoStack.current.push(entry);
    redoStack.current = [];
    rerender();
  }, [rerender]);

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    switch (entry.type) {
      case "create": onDelete(entry.annotation.id); break;
      case "delete": onCreate(entry.annotation); break;
      case "update": if (entry.previousAnnotation) onUpdate(entry.previousAnnotation); break;
    }
    redoStack.current.push(entry);
    rerender();
  }, [onCreate, onUpdate, onDelete, rerender]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    switch (entry.type) {
      case "create": onCreate(entry.annotation); break;
      case "delete": onDelete(entry.annotation.id); break;
      case "update": onUpdate(entry.annotation); break;
    }
    undoStack.current.push(entry);
    rerender();
  }, [onCreate, onUpdate, onDelete, rerender]);

  const trackCreate = useCallback((annotation: Annotation) => {
    pushUndo({ type: "create", annotation });
  }, [pushUndo]);

  const trackUpdate = useCallback((annotation: Annotation) => {
    const prev = annotations.find(a => a.id === annotation.id);
    pushUndo({ type: "update", annotation, previousAnnotation: prev });
  }, [annotations, pushUndo]);

  const trackDelete = useCallback((id: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) pushUndo({ type: "delete", annotation });
  }, [annotations, pushUndo]);

  return { undo, redo, canUndo, canRedo, trackCreate, trackUpdate, trackDelete };
}
