import { useMemo, useState } from "react";

import { useGetAdminPaymentLedgerQuery, useGetAdminPartyDuesQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, PrimaryButton, Pill, MetricTile } from "../../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import { money, number, formatDate } from "../insightsFormatting.js";
import { CURRENCY, kpiRowStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import SectionViewFrame from "./SectionViewFrame.jsx";
import AddPaymentModal from "./AddPaymentModal.jsx";
import MagnitudeBarChart from "./charts/MagnitudeBarChart.jsx";

const METHOD_FILTERS = [
  { key: "", label: "All methods" },
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online transfer" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank guarantee" },
  { key: "CREDIT", label: "Credit" },
];

const STATUS_FILTERS = [
  { key: "", label: "All statuses" },
  { key: "VERIFIED", label: "Verified" },
  { key: "PENDING_VERIFICATION", label: "Pending verification" },
  { key: "PARTIAL", label: "Partial" },
  { key: "PAID", label: "Paid" },
  { key: "REJECTED", label: "Rejected" },
];

const DUES_FILTERS = [
  { key: "outstanding", label: "Outstanding only" },
  { key: "all", label: "All parties" },
];

// Tones must come from Pill's own set (neutral/accent/positive/critical/
// caution) - anything else silently falls back to neutral grey.
function statusTone(status) {
  if (status === "VERIFIED" || status === "PAID") return "positive";
  if (status === "REJECTED") return "critical";
  if (status === "PENDING_VERIFICATION") return "accent";
  return "neutral";
}

export default function PaymentsSection({ dateFilters, view, onViewChange }) {
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [duesScope, setDuesScope] = useState("outstanding");
  const [addOpen, setAddOpen] = useState(false);

  // The workspace's dealer scope applies here too; the route scope does
  // not, because a payment's party is a dealer or a dispatcher rather
  // than an order routing mode.
  const paymentParams = useMemo(() => {
    const params = { range: dateFilters.range };
    if (dateFilters.from) params.from = dateFilters.from;
    if (dateFilters.to) params.to = dateFilters.to;
    if (dateFilters.dealerId) params.dealerId = dateFilters.dealerId;
    if (method) params.method = method;
    if (status) params.status = status;
    return params;
  }, [dateFilters, method, status]);

  const paymentsQuery = useGetAdminPaymentLedgerQuery(paymentParams);
  const duesQuery = useGetAdminPartyDuesQuery({ settled: duesScope === "all" ? "true" : "false" });

  const payments = useMemo(() => paymentsQuery.data || [], [paymentsQuery.data]);
  const dues = useMemo(() => duesQuery.data || [], [duesQuery.data]);

  const paymentsError = paymentsQuery.error
    ? getQueryErrorMessage(paymentsQuery.error, "Failed to load payments.")
    : "";
  const duesError = duesQuery.error ? getQueryErrorMessage(duesQuery.error, "Failed to load dues.") : "";

  const totals = useMemo(
    () =>
      payments.reduce(
        (acc, row) => ({ count: acc.count + 1, amount: acc.amount + Number(row.amount || 0) }),
        { count: 0, amount: 0 },
      ),
    [payments],
  );

  const totalDue = useMemo(() => dues.reduce((sum, row) => sum + Number(row.due || 0), 0), [dues]);

  const paymentColumns = useMemo(
    () => [
      { key: "createdAt", header: "Date", render: (row) => formatDate(row.createdAt) },
      {
        key: "partyName",
        header: "From",
        render: (row) => (
          <span>
            <span style={{ fontWeight: 700 }}>{row.partyName}</span>
            {row.partyType === "DISPATCHER" ? (
              <Pill tone="neutral" size="small" style={{ marginLeft: 6 }}>
                Dispatcher
              </Pill>
            ) : null}
          </span>
        ),
      },
      {
        key: "orderNumber",
        header: "Applied to",
        render: (row) =>
          row.onAccount ? (
            <span style={{ color: "var(--color-graphite, #707070)" }}>
              On account{row.allocationCount ? ` · ${row.allocationCount} order${row.allocationCount === 1 ? "" : "s"}` : ""}
            </span>
          ) : (
            row.orderNumber || "—"
          ),
      },
      { key: "method", header: "Method", render: (row) => row.method },
      { key: "status", header: "Status", render: (row) => <Pill tone={statusTone(row.status)}>{row.status}</Pill> },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.amount, CURRENCY),
      },
    ],
    [],
  );

  const duesColumns = useMemo(
    () => [
      {
        key: "name",
        header: "Party",
        render: (row) => (
          <span>
            <span style={{ fontWeight: 700 }}>{row.name}</span>
            {row.partyType === "DISPATCHER" ? (
              <Pill tone="neutral" size="small" style={{ marginLeft: 6 }}>
                Dispatcher
              </Pill>
            ) : null}
          </span>
        ),
      },
      {
        key: "billed",
        header: "Billed",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.billed, CURRENCY),
      },
      {
        key: "paid",
        header: "Paid",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.paid, CURRENCY),
      },
      {
        key: "due",
        header: "Due",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => (
          <span style={{ color: row.due > 0 ? "#b42318" : row.due < 0 ? "#15803d" : "inherit", fontWeight: 700 }}>
            {money(row.due, CURRENCY)}
          </span>
        ),
      },
    ],
    [],
  );

  const summary = (
    <div style={{ display: "grid", gap: 14 }}>
      {paymentsError ? <ErrorBanner message={paymentsError} /> : null}
      {duesError ? <ErrorBanner message={duesError} /> : null}

      <div style={kpiRowStyle()}>
        <MetricTile icon="invoice" label="Recorded in window" value={money(totals.amount, CURRENCY)} tone="accent" />
        <MetricTile icon="orders" label="Payments" value={number(totals.count)} />
        <MetricTile icon="warning" label="Total outstanding" value={money(totalDue, CURRENCY)} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <AppleDropdown value={method} options={METHOD_FILTERS} onChange={setMethod} placeholder="Method" icon="invoice" style={{ minWidth: 180 }} />
        <AppleDropdown value={status} options={STATUS_FILTERS} onChange={setStatus} placeholder="Status" icon="filter" style={{ minWidth: 190 }} />
        <AppleDropdown value={duesScope} options={DUES_FILTERS} onChange={setDuesScope} placeholder="Dues" icon="store" style={{ minWidth: 180 }} />
        <div style={{ marginLeft: "auto" }}>
          <PrimaryButton icon="plus" onClick={() => setAddOpen(true)}>
            Add payment
          </PrimaryButton>
        </div>
      </div>
    </div>
  );

  const charts = (
    <Surface padding={0}>
      <PanelHead eyebrow="Outstanding" icon="chart" title="Dues by party" />
      <MagnitudeBarChart
        items={dues.filter((row) => row.due > 0).slice(0, 10).map((row) => ({ label: row.name, value: row.due }))}
        formatValue={(v) => money(v, CURRENCY)}
        empty="Every party is settled."
      />
    </Surface>
  );

  const dataView = (
    <>
      <Surface padding={0}>
        <PanelHead eyebrow="Ledger" icon="list" title="Recorded payments" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={paymentColumns}
            rows={payments}
            getRowKey={(row) => row._id}
            loading={paymentsQuery.isLoading && !paymentsQuery.data}
            emptyState={{ icon: "invoice", title: "No payments recorded", subtitle: "Use Add payment to record one." }}
            minWidth={860}
          />
        </div>
      </Surface>

      <Surface padding={0}>
        <PanelHead eyebrow="Balances" icon="store" title="Dues by party" />
        <div style={{ padding: "0 18px 18px" }}>
          <DataTable
            columns={duesColumns}
            rows={dues}
            getRowKey={(row) => row.key}
            loading={duesQuery.isLoading && !duesQuery.data}
            emptyState={{ icon: "checkmark", title: "Nothing outstanding", subtitle: "Every party is settled." }}
            minWidth={640}
          />
        </div>
      </Surface>
    </>
  );

  return (
    <>
      <SectionViewFrame
        summary={summary}
        charts={charts}
        data={dataView}
        view={view}
        onViewChange={onViewChange}
      />
      {/* Mounted only while open so each visit starts from a clean form. */}
      {addOpen ? <AddPaymentModal open={addOpen} onClose={() => setAddOpen(false)} /> : null}
    </>
  );
}
