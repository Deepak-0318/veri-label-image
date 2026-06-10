import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { UserReportData } from "@/hooks/useUserReports";

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, 14, 25);
  doc.setTextColor(0);
}

function renderUserSection(doc: jsPDF, r: UserReportData, startY: number): number {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(r.fullName, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${r.email} · ${r.roles.join(", ") || "no role"}`, 14, y + 5);
  doc.setTextColor(0);
  y += 11;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 60] },
    head: [["Metric", "Value"]],
    body: [
      ["Total annotations", String(r.totalAnnotations)],
      ["Tasks completed", String(r.tasksCompleted)],
      ["Sub-tasks completed", String(r.subTasksCompleted)],
      ["QA tasks completed (QC role)", String(r.qaTasksCompleted)],
      ["QC reviewed annotations", String(r.qcReviewed)],
      ["QC approved", String(r.qcApproved)],
      ["QC rework", String(r.qcRework)],
      ["QC accuracy", `${r.qcAccuracy.toFixed(1)}%`],
      ["Active days", String(r.dailyActivity.length)],
    ],
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  if (r.annotationsByProject.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Annotations by project", 14, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 60] },
      head: [["Project", "Count"]],
      body: r.annotationsByProject
        .sort((a, b) => b.count - a.count)
        .map((p) => [p.projectName, String(p.count)]),
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (r.dailyActivity.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Daily activity (annotations)", 14, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [40, 40, 60] },
      head: [["Date", "Annotations"]],
      body: r.dailyActivity.map((d) => [d.date, String(d.count)]),
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  return y;
}

export function generateSingleUserPdf(r: UserReportData, orgName: string) {
  const doc = new jsPDF();
  const periodLabel = `${format(new Date(r.periodStart), "MMM d, yyyy")} → ${format(
    new Date(r.periodEnd),
    "MMM d, yyyy",
  )}`;
  header(doc, "User Performance Report", `${orgName} · ${periodLabel}`);
  renderUserSection(doc, r, 35);
  doc.save(`report-${r.fullName.replace(/\s+/g, "_")}-${format(new Date(r.periodStart), "yyyyMMdd")}.pdf`);
}

export function generateCombinedPdf(reports: UserReportData[], orgName: string) {
  const doc = new jsPDF();
  if (reports.length === 0) return;
  const periodLabel = `${format(new Date(reports[0].periodStart), "MMM d, yyyy")} → ${format(
    new Date(reports[0].periodEnd),
    "MMM d, yyyy",
  )}`;
  header(doc, "Team Performance Report", `${orgName} · ${periodLabel}`);

  // Summary table
  autoTable(doc, {
    startY: 32,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 60] },
    head: [["Member", "Roles", "Annotations", "Tasks", "Sub-tasks", "QC Acc."]],
    body: reports.map((r) => [
      r.fullName,
      r.roles.join(", ") || "—",
      String(r.totalAnnotations),
      String(r.tasksCompleted),
      String(r.subTasksCompleted),
      r.qcReviewed > 0 ? `${r.qcAccuracy.toFixed(1)}%` : "—",
    ]),
  });

  for (const r of reports) {
    doc.addPage();
    header(doc, r.fullName, `${orgName} · ${periodLabel}`);
    renderUserSection(doc, r, 35);
  }

  doc.save(`team-report-${format(new Date(reports[0].periodStart), "yyyyMMdd")}.pdf`);
}