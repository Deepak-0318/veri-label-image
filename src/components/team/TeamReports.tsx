import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Download, FileDown, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUserReports } from "@/hooks/useUserReports";
import type { TeamMember } from "@/hooks/useTeam";
import { generateCombinedPdf, generateSingleUserPdf } from "@/lib/userReportPdf";

type Preset = "this_month" | "last_month" | "last_7" | "last_30" | "last_90" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

function rangeFromPreset(preset: Preset, custom?: { from?: Date; to?: Date }): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "last_7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last_30":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "last_90":
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "custom":
      return {
        start: custom?.from ? startOfDay(custom.from) : startOfMonth(now),
        end: custom?.to ? endOfDay(custom.to) : endOfDay(now),
      };
    case "this_month":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

interface Props {
  members: TeamMember[];
  organizationName: string;
}

export function TeamReports({ members, organizationName }: Props) {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { start, end } = useMemo(
    () => rangeFromPreset(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );

  // Only annotation-performing roles by default; include all members so admins/managers see their own contributions if any
  const eligibleMembers = useMemo(
    () => members.filter((m) => m.roles.length > 0),
    [members],
  );
  const userIds = useMemo(() => eligibleMembers.map((m) => m.id), [eligibleMembers]);

  const { data: reports, isLoading } = useUserReports({ userIds, start, end });

  const rows = useMemo(() => {
    if (!reports) return [];
    return eligibleMembers
      .map((m) => ({ member: m, report: reports[m.id] }))
      .filter((r) => r.report);
  }, [reports, eligibleMembers]);

  const handleDownloadAll = () => {
    if (!reports) return;
    const list = rows.map((r) => r.report!);
    if (list.length === 0) return;
    generateCombinedPdf(list, organizationName);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Period</label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === "custom" && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-44 justify-start font-normal", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customFrom ? format(customFrom, "PP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-44 justify-start font-normal", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customTo ? format(customTo, "PP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {format(start, "MMM d, yyyy")} → {format(end, "MMM d, yyyy")}
          </p>
          <Button onClick={handleDownloadAll} disabled={isLoading || rows.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Download Org PDF
          </Button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-border bg-card">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No data for selected period</h2>
          <p className="text-muted-foreground">Try a different date range.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Annotations</TableHead>
                <TableHead className="text-right">Tasks done</TableHead>
                <TableHead className="text-right">Sub-tasks</TableHead>
                <TableHead className="text-right">QC reviewed</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Active days</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ member, report }) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0">
                        {member.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {member.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>
                      ) : (
                        member.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs capitalize">{r}</Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{report!.totalAnnotations}</TableCell>
                  <TableCell className="text-right">{report!.tasksCompleted}</TableCell>
                  <TableCell className="text-right">{report!.subTasksCompleted}</TableCell>
                  <TableCell className="text-right">{report!.qcReviewed}</TableCell>
                  <TableCell className="text-right">
                    {report!.qcReviewed > 0 ? `${report!.qcAccuracy.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{report!.dailyActivity.length}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Download PDF"
                      onClick={() => generateSingleUserPdf(report!, organizationName)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}