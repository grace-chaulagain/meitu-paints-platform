import { useState } from "react";
import { Link } from "react-router-dom";
import { useLazyGetDealerOrderStatementReportQuery } from "../redux/api/meituApi.js";
import NavBar from "../components/NavBar.jsx";
import { downloadUtilityOrderReportPdf } from "../utils/downloadUtilityOrderReportPdf.js";

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

function GlassCard({ children, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        borderRadius: 26,
        border: "1px solid rgba(15,23,42,.08)",
        background: "rgba(255,255,255,.86)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow:
          "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.82)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, action = null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 700,
              color: "rgba(15,23,42,.58)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function ActionButton({ children, onClick, subtle = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.08)",
        background: subtle
          ? "#fff"
          : "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)",
        color: subtle ? "#0f172a" : "#fff",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ReportField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.44)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  padding: "0 13px",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
  outline: "none",
};

const tableCellStyle = {
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 750,
  color: "rgba(15,23,42,.76)",
  whiteSpace: "nowrap",
};

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
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) return "";

  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function OrdersPreview({ report }) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const currency = report?.totals?.currency || "NPR";

  return (
    <GlassCard style={{ padding: 18 }}>
      <SectionHeader
        title="Report Preview"
        subtitle={`${Number(items.length || 0).toLocaleString()} matching orders`}
      />

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {[
          ["Orders", items.length],
          ["Total Value", money(report?.totals?.total, currency)],
          [
            "Average",
            money(
              items.length
                ? Number(report?.totals?.total || 0) / items.length
                : 0,
              currency,
            ),
          ],
        ].map(([label, value], index) => (
          <div
            key={label}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,.06)",
              background:
                index === 1 ? "rgba(180,35,24,.05)" : "rgba(248,250,252,.95)",
              padding: "13px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(15,23,42,.44)",
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 20,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                color: index === 1 ? "#b42318" : "#0f172a",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,.08)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(248,250,252,.98)" }}>
                {["Date", "Order ID", "Status", "Payment", "Amount"].map(
                  (heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: heading === "Amount" ? "right" : "left",
                        padding: "12px 14px",
                        fontSize: 11,
                        fontWeight: 950,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "rgba(15,23,42,.46)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 80).map((order) => (
                <tr
                  key={order._id || order.orderNumber}
                  style={{ borderTop: "1px solid rgba(15,23,42,.06)" }}
                >
                  <td style={tableCellStyle}>{formatDate(order.createdAt)}</td>
                  <td style={tableCellStyle}>
                    <strong>{order.orderNumber || "-"}</strong>
                  </td>
                  <td style={tableCellStyle}>{order.status || "-"}</td>
                  <td style={tableCellStyle}>
                    {order?.payment?.method || "-"}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: "right" }}>
                    <strong>
                      {money(order?.totals?.total, order?.totals?.currency)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </GlassCard>
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
      setError(
        err?.data?.error ||
          err?.data?.message ||
          err?.message ||
          "Failed to preview the report.",
      );
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
    <>
      <NavBar />

      <div
        style={{
          minHeight: "100vh",
          paddingTop: 96,
          paddingBottom: 52,
          background:
            "radial-gradient(1200px 700px at 20% 10%, rgba(255,204,0,.10), transparent 55%), radial-gradient(900px 600px at 80% 20%, rgba(255,80,0,.08), transparent 55%), radial-gradient(900px 700px at 50% 100%, rgba(196,0,0,.06), transparent 60%), linear-gradient(180deg, rgba(250,250,252,1) 0%, rgba(245,245,248,1) 100%)",
        }}
      >
        <div className="container" style={{ maxWidth: 1280 }}>
          <div style={{ display: "grid", gap: 20 }}>
            <GlassCard style={{ padding: 18 }}>
              <SectionHeader
                title="Utility Reports"
                subtitle="Generate order statements from your own order history."
                action={
                  <Link
                    to="/dealer/orders"
                    style={{
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 14,
                      border: "1px solid rgba(15,23,42,.08)",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 950,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Back to Orders
                  </Link>
                }
              />
            </GlassCard>

            <GlassCard style={{ padding: 18 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
                  gap: 12,
                }}
              >
                <ReportField label="Time Frame">
                  <select
                    value={form.dateMode}
                    onChange={(event) =>
                      updateForm("dateMode", event.target.value)
                    }
                    style={inputStyle}
                  >
                    {DATE_MODES.map((mode) => (
                      <option key={mode.key} value={mode.key}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </ReportField>

                {form.dateMode === "CUSTOM" ? (
                  <>
                    <ReportField label="From">
                      <input
                        type="date"
                        value={form.from}
                        onChange={(event) =>
                          updateForm("from", event.target.value)
                        }
                        style={inputStyle}
                      />
                    </ReportField>

                    <ReportField label="To">
                      <input
                        type="date"
                        value={form.to}
                        onChange={(event) =>
                          updateForm("to", event.target.value)
                        }
                        style={inputStyle}
                      />
                    </ReportField>
                  </>
                ) : null}

                <ReportField label="Status">
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    style={inputStyle}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </ReportField>

                <ReportField label="Min Amount">
                  <input
                    type="number"
                    min="0"
                    value={form.minTotal}
                    onChange={(event) =>
                      updateForm("minTotal", event.target.value)
                    }
                    placeholder="No minimum"
                    style={inputStyle}
                  />
                </ReportField>

                <ReportField label="Max Amount">
                  <input
                    type="number"
                    min="0"
                    value={form.maxTotal}
                    onChange={(event) =>
                      updateForm("maxTotal", event.target.value)
                    }
                    placeholder="No maximum"
                    style={inputStyle}
                  />
                </ReportField>
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <ActionButton subtle onClick={previewReport} disabled={loading}>
                  {loading ? "Previewing..." : "Preview Orders"}
                </ActionButton>
                <ActionButton onClick={exportReport} disabled={loading || !report}>
                  Export PDF
                </ActionButton>
              </div>

              {error ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: "13px 15px",
                    borderRadius: 14,
                    border: "1px solid rgba(180,35,24,.14)",
                    background: "rgba(180,35,24,.08)",
                    color: "#b42318",
                    fontSize: 13,
                    fontWeight: 850,
                  }}
                >
                  {error}
                </div>
              ) : null}
            </GlassCard>

            {report ? <OrdersPreview report={report} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
