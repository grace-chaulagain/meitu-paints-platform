import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useGetPainterPayoutReportQuery, useGetSettlementReportQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DataTable, Pill, SegmentedControl } from "../../../../components/dashboard/DashboardUI.jsx";
import { useMediaQuery } from "../../../../hooks/useMediaQuery.js";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import { formatDateOnly, formatMoney, redeemHistorySearch, settlementActorName } from "../couponFormatting.js";
import { SeeRedeemHistoryDialog } from "../SeeRedeemHistoryDialog.jsx";

// The same cash, counted from either end: who Meitu reimburses (dealers and
// dispatchers, who paid the painter over the counter) and who earned it
// (painters). They are separate tables rather than one, because a single
// redemption appears on both sides - adding them together would count the
// same rupee twice.
const VIEW_OPTIONS = [
  { key: "ACTORS", label: "Dealers & dispatchers" },
  { key: "PAINTERS", label: "Painters" },
];

// Each table opens on its biggest number, which is the question the tab is
// there to answer ("who do we owe the most?").
const DEFAULT_SORT = {
  ACTORS: { key: "cash", direction: "desc" },
  PAINTERS: { key: "points", direction: "desc" },
};

function compareValues(a, b) {
  if (typeof a === "string" || typeof b === "string") {
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
  }
  return Number(a ?? 0) - Number(b ?? 0);
}

// Sorting is done here rather than by the server: a payout table is one row
// per dealer, dispatcher or painter - tens of rows, all already loaded - so a
// round trip per click would only make it slower.
function sortRows(rows, sort, sortValueOf) {
  if (!sort?.key) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => factor * compareValues(sortValueOf(a, sort.key), sortValueOf(b, sort.key)));
}

// A column header that sorts. The arrow only appears on the column in use, so
// the header row stays quiet, and it points the way the rows are going.
function SortHeader({ label, columnKey, sort, onSort, align = "left" }) {
  const active = sort.key === columnKey;
  const ascending = active && sort.direction === "asc";
  return (
    <button
      type="button"
      className={`coupon-sort-header ${active ? "is-active" : ""}`}
      style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      onClick={() => onSort(columnKey)}
      aria-label={`Sort by ${label}${active ? (ascending ? ", currently lowest first" : ", currently highest first") : ""}`}
    >
      <span>{label}</span>
      <DashboardIcon
        name="chevron"
        size={11}
        strokeWidth={2.6}
        className="coupon-sort-arrow"
        style={{ transform: `rotate(${ascending ? -90 : 90}deg)`, opacity: active ? 1 : 0 }}
      />
    </button>
  );
}

export default function SettlementTab() {
  const navigate = useNavigate();
  const location = useLocation();
  // Below 640px DataTable drops the header row and prints each column's
  // `header` as the field label inside every row card - a sort button there
  // would be repeated once per row and would fight the row's own tap, so that
  // width gets plain labels and the default order. Nothing reaches it today
  // (under 768px the whole Coupons page is replaced by AdminCouponsMobileView,
  // which has no Payouts tab), but the table stays correct on its own terms
  // rather than depending on where some other file draws its breakpoint.
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [view, setView] = useState("ACTORS");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [rowMenu, setRowMenu] = useState(null);

  const settlementQuery = useGetSettlementReportQuery({});
  const painterQuery = useGetPainterPayoutReportQuery({});
  const activeQuery = view === "PAINTERS" ? painterQuery : settlementQuery;
  const activeSort = sort[view];

  const items = useMemo(() => settlementQuery.data?.items || [], [settlementQuery.data]);
  const painterItems = useMemo(() => painterQuery.data?.items || [], [painterQuery.data]);
  const loadError = activeQuery.error
    ? getQueryErrorMessage(
        activeQuery.error,
        view === "PAINTERS" ? "Failed to load painter payouts." : "Failed to load settlement report.",
      )
    : "";

  function changeSort(columnKey) {
    setSort((current) => {
      const previous = current[view];
      // A second click on the same column flips it; a new column starts on the
      // reading people expect - biggest number, or A-Z for a name.
      const direction =
        previous.key === columnKey
          ? previous.direction === "asc"
            ? "desc"
            : "asc"
          : columnKey === "name"
            ? "asc"
            : "desc";
      return { ...current, [view]: { key: columnKey, direction } };
    });
  }

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

  const painterTotals = useMemo(
    () =>
      painterItems.reduce(
        (acc, row) => ({
          redemptionCount: acc.redemptionCount + Number(row.redemptionCount || 0),
          totalPoints: acc.totalPoints + Number(row.totalPoints || 0),
          totalCashPaid: acc.totalCashPaid + Number(row.totalCashPaid || 0),
        }),
        { redemptionCount: 0, totalPoints: 0, totalCashPaid: 0 },
      ),
    [painterItems],
  );

  const sortedItems = useMemo(
    () =>
      sortRows(items, sort.ACTORS, (row, key) => {
        if (key === "name") return settlementActorName(row);
        if (key === "redemptions") return row.redemptionCount;
        if (key === "points") return row.totalPoints;
        return row.totalCashPaid;
      }),
    [items, sort.ACTORS],
  );

  const sortedPainterItems = useMemo(
    () =>
      sortRows(painterItems, sort.PAINTERS, (row, key) => {
        if (key === "name") return row.painter?.name || "";
        if (key === "type") return row.painter?.type || "";
        if (key === "redemptions") return row.redemptionCount;
        if (key === "cash") return row.totalCashPaid;
        if (key === "last") return row.lastRedeemedAt ? new Date(row.lastRedeemedAt).getTime() : 0;
        return row.totalPoints;
      }),
    [painterItems, sort.PAINTERS],
  );

  function header(label, columnKey, align = "left") {
    if (isMobile) return label;
    return <SortHeader label={label} columnKey={columnKey} sort={activeSort} onSort={changeSort} align={align} />;
  }

  const columns = useMemo(
    () => [
      {
        key: "dealer",
        header: header("Redeemed By", "name"),
        render: (row) => <span style={{ fontWeight: 700 }}>{settlementActorName(row)}</span>,
      },
      {
        key: "redemptions",
        header: header("Redemptions", "redemptions", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => row.redemptionCount,
      },
      {
        key: "points",
        header: header("Points Paid Out", "points", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => row.totalPoints.toLocaleString(),
      },
      {
        key: "cash",
        header: header("Cash Paid Out", "cash", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>{formatMoney(row.totalCashPaid)}</span>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSort, isMobile],
  );

  const painterColumns = useMemo(
    () => [
      {
        key: "painter",
        header: header("Painter", "name"),
        render: (row) => (
          <span style={{ fontWeight: 700 }}>{row.painter?.name || "Unknown painter"}</span>
        ),
      },
      {
        key: "type",
        header: header("Type", "type"),
        render: (row) =>
          row.painter?.type ? (
            <Pill tone={row.painter.type === "TTP" ? "accent" : "neutral"} size="small">
              {row.painter.type}
            </Pill>
          ) : (
            "—"
          ),
      },
      {
        key: "redemptions",
        header: header("Redemptions", "redemptions", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => row.redemptionCount,
      },
      {
        key: "points",
        header: header("Points Earned", "points", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => row.totalPoints.toLocaleString(),
      },
      {
        key: "cash",
        header: header("Cash Received", "cash", "right"),
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>{formatMoney(row.totalCashPaid)}</span>,
      },
      {
        key: "last",
        header: header("Last Redeemed", "last", "right"),
        align: "right",
        render: (row) => formatDateOnly(row.lastRedeemedAt),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSort, isMobile],
  );

  // A payout row IS one dealer, dispatcher or painter, so clicking it can only
  // mean "tell me more about this person" - the same dialog and the same trip
  // to Redeemed, whichever table it came from.
  function actorOf(row) {
    if (!row) return null;
    if (row.painterId) {
      return { kind: "PAINTER", id: String(row.painterId), name: row.painter?.name || "Unknown painter" };
    }
    const isDispatcher = row.actorType === "DISPATCHER";
    const id = isDispatcher ? row.dispatcherId : row.dealerId;
    if (!id) return null;
    return { kind: isDispatcher ? "DISPATCHER" : "DEALER", id: String(id), name: settlementActorName(row) };
  }

  function subtitleOf(row) {
    if (!row) return "";
    const redemptions = `${Number(row.redemptionCount || 0).toLocaleString()} redemptions`;
    if (row.painterId) {
      return `${redemptions} · ${Number(row.totalPoints || 0).toLocaleString()} points · ${formatMoney(row.totalCashPaid)}`;
    }
    return `${redemptions} · ${formatMoney(row.totalCashPaid)} paid out`;
  }

  const footerCells = items.length
    ? [
        { key: "dealer", content: "Total", align: "left" },
        { key: "redemptions", content: totals.redemptionCount.toLocaleString(), align: "right" },
        { key: "points", content: totals.totalPoints.toLocaleString(), align: "right" },
        { key: "cash", content: formatMoney(totals.totalCashPaid), align: "right" },
      ]
    : null;

  const painterFooterCells = painterItems.length
    ? [
        { key: "painter", content: "Total", align: "left" },
        { key: "type", content: "", align: "left" },
        { key: "redemptions", content: painterTotals.redemptionCount.toLocaleString(), align: "right" },
        { key: "points", content: painterTotals.totalPoints.toLocaleString(), align: "right" },
        { key: "cash", content: formatMoney(painterTotals.totalCashPaid), align: "right" },
        { key: "last", content: "", align: "right" },
      ]
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} size="small" />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {view === "PAINTERS"
            ? "Points and cash earned by each painter. Tap a painter for their redeem history."
            : "Cash to reimburse each dealer and dispatcher."}
        </span>
      </div>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : view === "PAINTERS" ? (
        <DataTable
          columns={painterColumns}
          rows={sortedPainterItems}
          onRowClick={(row) => setRowMenu((current) => (current === row ? null : row))}
          getRowKey={(row) => String(row.painterId)}
          loading={painterQuery.isLoading && !painterQuery.data}
          footerCells={painterFooterCells}
          emptyState={{
            icon: "checkmark",
            title: "No painter points yet",
            subtitle: "Once a coupon is scanned for a painter, their points and cash show up here.",
          }}
          minWidth={760}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={sortedItems}
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
        subtitle={subtitleOf(rowMenu)}
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
