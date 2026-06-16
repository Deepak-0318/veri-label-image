import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Search, Info, HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GuidelinesContentProps {
  guidelines: string | null;
}

export function GuidelinesContent({ guidelines }: GuidelinesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const cleanedGuidelines = guidelines || "No guidelines provided for this project.";

  // Highlight matches inside paragraph text blocks
  const renderers = useMemo(() => ({
    p: ({ children }: any) => {
      if (!searchQuery.trim()) return <p className="text-sm leading-relaxed mb-4">{children}</p>;
      return <p className="text-sm leading-relaxed mb-4">{highlightText(children, searchQuery)}</p>;
    },
    li: ({ children }: any) => {
      if (!searchQuery.trim()) return <li className="text-sm mb-1.5">{children}</li>;
      return <li className="text-sm mb-1.5">{highlightText(children, searchQuery)}</li>;
    },
    h1: ({ children }: any) => <h1 className="text-xl font-bold mt-6 mb-3 border-b pb-1 text-foreground">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-md font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 rounded border border-border">
        <table className="min-w-full divide-y divide-border text-sm">{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th className="px-3 py-2 bg-muted font-semibold text-left border-r last:border-0 border-border">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2 border-t border-r last:border-0 border-border text-xs">{children}</td>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
        {children}
      </a>
    ),
    img: ({ src, alt }: any) => (
      <img src={src} alt={alt} className="max-w-full h-auto rounded border my-4 mx-auto block shadow-sm" />
    )
  }), [searchQuery]);

  const matchesCount = useMemo(() => {
    if (!searchQuery.trim() || !guidelines) return 0;
    try {
      const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "gi");
      const matches = guidelines.match(regex);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [guidelines, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search guidelines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 bg-secondary/35 border-border"
        />
        {searchQuery.trim() && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
            {matchesCount} match{matchesCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 rounded-lg border border-border bg-card/20 p-4">
        <div className="prose prose-invert max-w-none prose-sm">
          <ReactMarkdown components={renderers}>
            {cleanedGuidelines}
          </ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper function to scan React children tree and inject highlight <mark> tags into string literals
function highlightText(node: any, query: string): any {
  if (typeof node === "string") {
    if (!node.toLowerCase().includes(query.toLowerCase())) return node;
    const parts = node.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/40 text-foreground px-0.5 rounded font-medium">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }

  if (Array.isArray(node)) {
    return node.map((child, i) => <span key={i}>{highlightText(child, query)}</span>);
  }

  if (node && node.props && node.props.children) {
    return {
      ...node,
      props: {
        ...node.props,
        children: highlightText(node.props.children, query)
      }
    };
  }

  return node;
}
