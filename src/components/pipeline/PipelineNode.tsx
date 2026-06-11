import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Brain, Code, GitBranch, Zap, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PipelineNodeData {
  blockType: "ai" | "function" | "logical" | "custom" | "io";
  label: string;
  config: {
    model?: string;
    confidence?: number;
    maxDetections?: number;

    [key: string]: any;
  };
  selected?: boolean;
}

const ICONS: Record<string, React.ElementType> = {
  ai: Brain,
  function: Code,
  logical: GitBranch,
  custom: Zap,
  io: ArrowRightLeft,
};

const STYLES: Record<string, string> = {
  ai: "border-[hsl(var(--tag-purple))] bg-[hsl(var(--tag-purple)/0.12)]",
  function: "border-[hsl(var(--tag-blue))] bg-[hsl(var(--tag-blue)/0.12)]",
  logical: "border-[hsl(var(--tag-yellow))] bg-[hsl(var(--tag-yellow)/0.12)]",
  custom: "border-[hsl(var(--tag-green))] bg-[hsl(var(--tag-green)/0.12)]",
  io: "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)]",
};

const ICON_STYLES: Record<string, string> = {
  ai: "text-[hsl(var(--tag-purple))]",
  function: "text-[hsl(var(--tag-blue))]",
  logical: "text-[hsl(var(--tag-yellow))]",
  custom: "text-[hsl(var(--tag-green))]",
  io: "text-primary",
};

function PipelineNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as PipelineNodeData;
  const Icon = ICONS[nodeData.blockType] || Zap;
  const blockType = nodeData.blockType;

  return (
    <div
      className={cn(
        "rounded-xl border-2 px-4 py-3 min-w-[220px] max-w-[260px] shadow-lg transition-all",
        STYLES[blockType],
        selected && "ring-2 ring-primary shadow-xl scale-[1.03]"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-background/40">
          <Icon className={cn("h-5 w-5", ICON_STYLES[blockType])} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{nodeData.label}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{blockType} block</p>
        </div>
      </div>

      {blockType === "ai" && (
        <div className="mt-2 text-[10px] space-y-0.5 text-muted-foreground">
          {nodeData.config.model && (
            <p><span className="font-semibold text-foreground">Model:</span> {nodeData.config.model}</p>
          )}
          {nodeData.config.confidence !== undefined && (
            <p><span className="font-semibold text-foreground">Confidence:</span> {nodeData.config.confidence}</p>
          )}
          {nodeData.config.maxDetections !== undefined && (
            <p><span className="font-semibold text-foreground">Max Detections:</span> {nodeData.config.maxDetections}</p>
          )}
        </div>
      )}

      {blockType === "function" && nodeData.config.function && (
        <div className="mt-2.5">
          <Badge variant="secondary" className="text-[10px] h-5">{nodeData.config.function}</Badge>
        </div>
      )}

      {blockType === "logical" && nodeData.config.condition && (
        <p className="mt-2 text-[10px] font-mono text-muted-foreground truncate">
          {nodeData.config.condition}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      {/* Logical block has a second output for the false branch */}
      {blockType === "logical" && (
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-3 !h-3 !bg-destructive !border-2 !border-background"
        />
      )}
    </div>
  );
}

export default memo(PipelineNode);
