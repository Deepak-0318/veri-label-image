import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useLabels } from "@/hooks/useLabels";
import { Tags, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TagColor } from "@/types/annotation";

const colorMap: Record<TagColor, string> = {
  blue: "bg-tag-blue/20 text-tag-blue border-tag-blue/30",
  green: "bg-tag-green/20 text-tag-green border-tag-green/30",
  yellow: "bg-tag-yellow/20 text-tag-yellow border-tag-yellow/30",
  purple: "bg-tag-purple/20 text-tag-purple border-tag-purple/30",
  pink: "bg-tag-pink/20 text-tag-pink border-tag-pink/30",
  orange: "bg-tag-orange/20 text-tag-orange border-tag-orange/30",
  cyan: "bg-tag-cyan/20 text-tag-cyan border-tag-cyan/30",
  red: "bg-tag-red/20 text-tag-red border-tag-red/30",
};

export default function Labels() {
  const { user, loading: authLoading } = useAuth();
  const { labels, isLoading } = useLabels(user?.id);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const defaultLabels = labels.filter(l => l.id.startsWith("default-"));
  const customLabels = labels.filter(l => !l.id.startsWith("default-"));

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Labels</h1>
            <p className="text-muted-foreground mt-1">
              All labels available in your annotation workspace
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" />
                Default Labels
              </CardTitle>
              <CardDescription>Built-in labels available to all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {defaultLabels.map(label => (
                  <span
                    key={label.id}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                      colorMap[label.color]
                    )}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        `bg-tag-${label.color}`
                      )}
                    />
                    {label.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" />
                Custom Labels
              </CardTitle>
              <CardDescription>Labels you've created for your projects</CardDescription>
            </CardHeader>
            <CardContent>
              {customLabels.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {customLabels.map(label => (
                    <span
                      key={label.id}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        colorMap[label.color]
                      )}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          `bg-tag-${label.color}`
                        )}
                      />
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No custom labels yet. Create labels while annotating files.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
