import { useMemo, useState } from "react";

import {
  useGetAdminPaymentReconciliationQuery,
  useGetAdminPaymentsQuery,
  useVerifyAdminPaymentMutation,
  useRejectAdminPaymentMutation,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { Surface, DataTable, GhostButton, Pill, MetricTile } from "../../../../components/dashboard/DashboardUI.jsx";
import { money, number, formatDate } from "../insightsFormatting.js";
import { CURRENCY, twoColStyle, kpiRowStyle } from "./sectionLayout.js";
import { PanelHead, ErrorBanner } from "./sectionShared.jsx";
import MagnitudeBarChart from "./charts/MagnitudeBarChart.jsx";

function statusPillTone(status) {
  if (status === "VERIFIED" || status === "PAID") return "positive";
  if (status === "REJECTED" || status === "OVERDUE") return "critical";
  if (status === "PARTIAL") return "caution";
  return "neutral";
}

export default function PaymentReconciliationSection({ dateFilters }) {
  const breakdownQuery = useGetAdminPaymentReconciliationQuery(dateFilters);
  const queueQuery = useGetAdminPaymentsQuery({ status: "PENDING_VERIFICATION", limit: 50 });
  const [verifyPayment, verifyState] = useVerifyAdminPaymentMutation();
  const [rejectPayment, rejectState] = useRejectAdminPaymentMutation();
  const [actingOnId, setActingOnId] = useState("");

  const queueSummary = breakdownQuery.data?.queueSummary?.totals || { amount: 0, count: 0 };
  const methodBreakdown = useMemo(
    () => breakdownQuery.data?.queueSummary?.byMethod || [],
    [breakdownQuery.data],
  );
  const breakdownError = breakdownQuery.error
    ? getQueryErrorMessage(breakdownQuery.error, "Failed to load payment breakdown.")
    : "";

  const queueItems = queueQuery.data?.items || [];
  const queueError = queueQuery.error ? getQueryErrorMessage(queueQuery.error, "Failed to load the verification queue.") : "";

  async function handleVerify(paymentId) {
    setActingOnId(paymentId);
    try {
      await verifyPayment({ paymentId }).unwrap();
    } catch {
      // surfaced via verifyState.error below
    } finally {
      setActingOnId("");
    }
  }

  async function handleReject(paymentId) {
    setActingOnId(paymentId);
    try {
      await rejectPayment({ paymentId }).unwrap();
    } catch {
      // surfaced via rejectState.error below
    } finally {
      setActingOnId("");
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "dealer",
        header: "Dealer",
        render: (row) => row.dealerId?.companyName || row.dealerId?.contactName || "Unknown dealer",
      },
      {
        key: "order",
        header: "Order",
        render: (row) => row.orderId?.orderNumber || "—",
      },
      {
        key: "method",
        header: "Method",
        render: (row) => row.method,
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => money(row.amount, row.currency || CURRENCY),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <Pill tone={statusPillTone(row.status)}>{row.status}</Pill>,
      },
      {
        key: "createdAt",
        header: "Declared",
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (row) => (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <GhostButton
              onClick={() => handleVerify(row._id)}
              disabled={actingOnId === row._id && (verifyState.isLoading || rejectState.isLoading)}
            >
              Verify
            </GhostButton>
            <GhostButton
              danger
              onClick={() => handleReject(row._id)}
              disabled={actingOnId === row._id && (verifyState.isLoading || rejectState.isLoading)}
            >
              Reject
            </GhostButton>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actingOnId, verifyState.isLoading, rejectState.isLoading],
  );

  const actionError =
    (verifyState.error ? getQueryErrorMessage(verifyState.error, "Failed to verify payment.") : "") ||
    (rejectState.error ? getQueryErrorMessage(rejectState.error, "Failed to reject payment.") : "");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {breakdownError ? <ErrorBanner message={breakdownError} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      <div style={kpiRowStyle()}>
        <MetricTile icon="invoice" label="Pending Verification" value={money(queueSummary.amount, CURRENCY)} tone="accent" />
        <MetricTile icon="orders" label="Pending Payments" value={number(queueSummary.count)} />
      </div>

      <div style={twoColStyle()}>
        <Surface padding={0}>
          <PanelHead eyebrow="Pending" icon="chart" title="Pending amount by method" />
          <MagnitudeBarChart
            items={methodBreakdown.map((row) => ({ label: row.method, value: row.amount }))}
            formatValue={(v) => money(v, CURRENCY)}
            empty="Nothing pending verification."
          />
        </Surface>
        <Surface padding={0}>
          <PanelHead eyebrow="Window" icon="list" title="Status/method breakdown" />
          <MagnitudeBarChart
            items={(breakdownQuery.data?.breakdown || []).map((row) => ({
              label: `${row.status} · ${row.method}`,
              value: row.amount,
            }))}
            formatValue={(v) => money(v, CURRENCY)}
            empty="No payments recorded in this window."
          />
        </Surface>
      </div>

      <Surface padding={0}>
        <PanelHead eyebrow="Action needed" icon="warning" title="Verification queue" />
        <div style={{ padding: "0 18px 18px" }}>
          {queueError ? (
            <ErrorBanner message={queueError} />
          ) : (
            <DataTable
              columns={columns}
              rows={queueItems}
              getRowKey={(row) => row._id}
              loading={queueQuery.isLoading && !queueQuery.data}
              emptyState={{ icon: "checkmark", title: "Queue is clear", subtitle: "No payments are waiting on verification." }}
              minWidth={760}
            />
          )}
        </div>
      </Surface>
    </div>
  );
}
