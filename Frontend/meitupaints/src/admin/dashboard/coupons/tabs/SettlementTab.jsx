import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useGetSettlementReportQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DataTable } from "../../../../components/dashboard/DashboardUI.jsx";
import { formatMoney, redeemHistorySearch, settlementActorName } from "../couponFormatting.js";
import { SeeRedeemHistoryDialog } from "../SeeRedeemHistoryDialog.jsx";

export default function SettlementTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rowMenu, setRowMenu] = useState(null);
  const settlementQuery = useGetSettlementReportQuery({});
  const items = useMemo(() => settlementQuery.data?.items || [], [settlementQuery.data]);
  const loadError = settlementQuery.error ? getQueryErrorMessage(settlementQuery.error, "Failed to load settlement report.") : "";

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, row) => ({
          redemptionCount: acc.redemptionCount + Number(row.redemptionCount || 0),
          totalPoints: acc.totalPoints + Number(row.totalPoints || 0),
          totalCashPaid: acc.totalCashPaid + Number(row.totalCashPaid || 0),
        }),
        { redemptionCount: 0, totalPoints: 0, totalCashPaid: 0 },
      ),
    [items],
  );

  const columns = useMemo(
    () => [
      { key: "dealer", header: "Redeemed By", render: (row) => <span style={{ fontWeight: 700 }}>{settlementActorName(row)}</span> },
      { key: "redemptions", header: "Redemptions", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => row.redemptionCount },
      { key: "points", header: "Points Paid Out", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => row.totalPoints.toLocaleString() },
      {
        key: "cash",
        header: "Cash Paid Out",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>{formatMoney(row.totalCashPaid)}</span>,
      },
    ],
    [],
  );

  // A payout row IS one dealer or dispatcher, so clicking it can only mean
  // "tell me more about this person".
  function actorOf(row) {
    if (!row) return null;
    const isDispatcher = row.actorType === "DISPATCHER";
    const id = isDispatcher ? row.dispatcherId : row.dealerId;
    if (!id) return null;
    return { kind: isDispatcher ? "DISPATCHER" : "DEALER", id: String(id), name: settlementActorName(row) };
  }

  const footerCells = items.length
    ? [
        { key: "dealer", content: "Total", align: "left" },
        { key: "redemptions", content: totals.redemptionCount.toLocaleString(), align: "right" },
        { key: "points", content: totals.totalPoints.toLocaleString(), align: "right" },
        { key: "cash", content: formatMoney(totals.totalCashPaid), align: "right" },
      ]
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          onRowClick={(row) => setRowMenu((current) => (current === row ? null : row))}
          getRowKey={(row) => row.dealerId || row.dispatcherId}
          loading={settlementQuery.isLoading && !settlementQuery.data}
          footerCells={footerCells}
          emptyState={{ icon: "invoice", title: "No cash payouts yet", subtitle: "Dealer and dispatcher cash payout totals will show up here once coupons are redeemed." }}
          minWidth={640}
        />
      )}

      <SeeRedeemHistoryDialog
        actor={actorOf(rowMenu)}
        subtitle={rowMenu ? `${Number(rowMenu.redemptionCount || 0).toLocaleString()} redemptions · ${formatMoney(rowMenu.totalCashPaid)} paid out` : ""}
        onClose={() => setRowMenu(null)}
        onConfirm={() => {
          const actor = actorOf(rowMenu);
          setRowMenu(null);
          if (actor) navigate({ pathname: location.pathname, search: redeemHistorySearch(actor) });
        }}
      />
    </div>
  );
}
