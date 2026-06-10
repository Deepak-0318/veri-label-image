import { PipelineResult } from "@/types/pipelineResult";
import { Badge } from "@/components/ui/badge";

interface Props {
  result: PipelineResult | null;
}

export default function PipelineResultsPanel({
  result,
}: Props) {
  if (!result) return null;

  return (
    <div className="border rounded-lg p-4 mt-4 bg-card">
      <h3 className="font-semibold mb-3">
        Pipeline Results
      </h3>

      {result.results?.map((nodeResult, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 mb-3 bg-card"
        >
          <h4 className="font-semibold text-base">
            {nodeResult.node}
          </h4>

          {nodeResult.annotations &&
            nodeResult.annotations.length > 0 ? (
            <div className="mt-3 space-y-3">
              {nodeResult.annotations.map(
                (annotation, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border p-3 bg-muted/20"
                  >
                    <div className="flex gap-2 items-center">
                      <Badge>
                        {annotation.label}
                      </Badge>

                      <Badge variant="secondary">
                        {(annotation.confidence * 100).toFixed(1)}%
                      </Badge>
                    </div>

                    <div className="mt-2 text-sm">
                      <p>
                        X: {annotation.boundingBox.x}
                      </p>
                      <p>
                        Y: {annotation.boundingBox.y}
                      </p>
                      <p>
                        Width:
                        {" "}
                        {annotation.boundingBox.width}
                      </p>
                      <p>
                        Height:
                        {" "}
                        {annotation.boundingBox.height}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Execution completed successfully.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}