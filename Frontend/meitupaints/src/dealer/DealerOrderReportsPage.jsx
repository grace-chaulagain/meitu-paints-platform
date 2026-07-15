import { useState } from "react";
import { useLazyGetDealerOrderStatementReportQuery } from "../redux/api/meituApi.js";
import { downloadUtilityOrderReportPdf } from "../utils/downloadUtilityOrderReportPdf.js";
import {
  Dropdown,
  GhostButton,
  MetricTile,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../components/dashboard/DashboardUI.jsx";

const DATE_MODES = [
  { key: "CUSTOM", label: "Custom range" },
  { key: "ALL_TIME", label: "All time" },
];

const STATUS_OPTIONS = [
  { key: "ALL", label: "All status" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVE", label: "Archive" },
];

function toDateInputValue(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateByDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function dateInputToIso(value, endOfDay = false) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).toISOString();
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildInitialForm() {
  return {
    dateMode: "CUSTOM",
    from: toDateInputValue(shiftDateByDays(-30)),
    to: toDateInputValue(new Date()),
    status: "ALL",
    minTotal: "",
    maxTotal: "",
  };
}

const fieldStyle = {
  width: "100%",
  height: 40,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.12)",
  background: "#fff",
  padding: "0 12px",
  fontSize: 13,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
};

function ReportField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>{label}</span>
      {children}
    </label>
  );
}

function OrdersPreview({ report }) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const currency = report?.totals?.currency || "NPR";
  const average = items.length ? Number(report?.totals?.total || 0) / items.length : 0;

  return (
    <Surface padding={18} className="dash-fade-up">
      <SectionHeader icon="chart" title="Report Preview" subtitle={`${items.length.toLocaleString()} matching orders`} />

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <MetricTile label="Orders" value={items.length} icon="orders" />
        <MetricTile label="Total Value" value={money(report?.totals?.total, currency)} icon="chart" tone="accent" />
        <MetricTile label="Average" value={money(average, currency)} icon="chart" />
      </div>

      <div style={{ marginTop: 16, borderRadius: 12, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Order ID", "Status", "Payment", "Amount"].map((heading) => (
                  <th key={heading} style={{ textAlign: heading === "Amount" ? "right" : "left", padding: "10px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)", whiteSpace: "nowrap" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 80).map((order) => (
                <tr key={order._id || order.orderNumber} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{formatDate(order.createdAt)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 700 }}>{order.orderNumber || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{order.status || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{order?.payment?.method || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{money(order?.totals?.total, order?.totals?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Surface>
  );
}

export default function DealerOrderReportsPage() {
  const [form, setForm] = useState(buildInitialForm);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [fetchReport, reportQuery] = useLazyGetDealerOrderStatementReportQuery();
  const loading = reportQuery.isFetching;

  function updateForm(key, value) {
    setError("");
    setReport(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildParams() {
    const params = {};

    if (form.dateMode === "CUSTOM") {
      const fromIso = dateInputToIso(form.from, false);
      const toIso = dateInputToIso(form.to, true);
      if (!fromIso || !toIso) throw new Error("Choose both report dates.");
      if (new Date(fromIso).getTime() > new Date(toIso).getTime()) {
        throw new Error("Start date must be before end date.");
      }
      params.from = fromIso;
      params.to = toIso;
    }

    if (form.status !== "ALL") params.status = form.status;
    if (form.minTotal !== "") params.minTotal = form.minTotal;
    if (form.maxTotal !== "") params.maxTotal = form.maxTotal;

    return params;
  }

  async function previewReport() {
    try {
      setError("");
      const item = await fetchReport(buildParams(), true).unwrap();
      setReport(item || null);
    } catch (err) {
      setError(err?.data?.error || err?.data?.message || err?.message || "Failed to preview the report.");
    }
  }

  async function exportReport() {
    if (!report) return;
    await downloadUtilityOrderReportPdf({
      report,
      title: "Dealer Order Statement",
      scopeLabel: report?.filters?.dealerName || "Dealer Orders",
      filenameScope: "dealer-order-report",
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={18} className="dash-fade-up">
        <SectionHeader icon="chart" title="Utility Reports" subtitle="Generate order statements from your own order history." />

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
          <ReportField label="Time Frame">
            <Dropdown value={form.dateMode} options={DATE_MODES} onChange={(value) => updateForm("dateMode", value)} />
          </ReportField>

          {form.dateMode === "CUSTOM" ? (
            <>
              <ReportField label="From">
                <input type="date" value={form.from} onChange={(event) => updateForm("from", event.target.value)} style={fieldStyle} />
              </ReportField>
              <ReportField label="To">
                <input type="date" value={form.to} onChange={(event) => updateForm("to", event.target.value)} style={fieldStyle} />
              </ReportField>
            </>
          ) : null}

          <ReportField label="Status">
            <Dropdown value={form.status} options={STATUS_OPTIONS} onChange={(value) => updateForm("status", value)} />
          </ReportField>

          <ReportField label="Min Amount">
            <input type="number" min="0" value={form.minTotal} onChange={(event) => updateForm("minTotal", event.target.value)} placeholder="No minimum" style={fieldStyle} />
          </ReportField>

          <ReportField label="Max Amount">
            <input type="number" min="0" value={form.maxTotal} onChange={(event) => updateForm("maxTotal", event.target.value)} placeholder="No maximum" style={fieldStyle} />
          </ReportField>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <GhostButton onClick={previewReport} disabled={loading}>{loading ? "Previewing…" : "Preview Orders"}</GhostButton>
          <PrimaryButton onClick={exportReport} disabled={loading || !report}>Export PDF</PrimaryButton>
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      {report ? <OrdersPreview report={report} /> : null}
    </div>
  );
}
