import { useMemo, useState } from "react";

import { useGetCouponRedemptionHistoryQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import { DataTable, Pagination, Pill, SearchField, Surface } from "../../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import {
  COUPON_DATE_PRESETS,
  couponTypeLabel,
  formatMoney,
  formatTimeOnly,
  groupRedemptionsByDay,
  HISTORY_TYPE_OPTIONS,
  PAGE_SIZE,
  redeemedDealerName,
  redeemedPainterName,
  resolveCouponDateRange,
  skipReasonPillLabel,
} from "../couponFormatting.js";

export default function HistoryTab() {
  const [type, setType] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);

  const historyParams = useMemo(() => {
    const params = { type, q, page, limit: PAGE_SIZE };
    const { from, to } = resolveCouponDateRange(datePreset, customFrom, customTo);
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }, [customFrom, customTo, datePreset, page, q, type]);

  const historyQuery = useGetCouponRedemptionHistoryQuery(historyParams);
  const items = useMemo(() => historyQuery.data?.items || [], [historyQuery.data]);
  const groupedItems = useMemo(() => groupRedemptionsByDay(items), [items]);
  const dayHeaderByFirstRowId = useMemo(() => {
    const map = new Map();
    groupedItems.forEach((group) => {
      if (group.items[0]) map.set(group.items[0]._id, group);
    });
    return map;
  }, [groupedItems]);
  const pagination = historyQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load redemption history.") : "";

  function changeType(next) {
    setType(next);
    setPage(1);
  }
  function changeDatePreset(next) {
    setDatePreset(next);
    setPage(1);
  }
  function changeCustomFrom(next) {
    setCustomFrom(next);
    setPage(1);
  }
  function changeCustomTo(next) {
    setCustomTo(next);
    setPage(1);
  }
  function submitSearch() {
    setQ(draftQ.trim());
    setPage(1);
  }

  const columns = useMemo(
    () => [
      {
        key: "coupon",
        header: "Coupon",
        render: (row) => {
          const golden = row.type === "GOLDEN";
          return (
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  background: golden ? "rgba(182,68,0,.1)" : "rgba(22,163,74,.1)",
                  color: golden ? "var(--color-caution,#b64400)" : "#15803d",
                }}
              >
                <DashboardIcon name={golden ? "award" : "shield"} size={13} strokeWidth={1.8} />
              </span>
              <span className="dash-table-mono">{row.couponCode}</span>
            </span>
          );
        },
      },
      {
        key: "type",
        header: "Type",
        render: (row) => <Pill tone={row.type === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(row.type)}</Pill>,
      },
      {
        key: "dealer",
        header: "Dealer",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)" }}>{redeemedDealerName(row)}</span>,
      },
      {
        key: "painter",
        header: "Painter",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)" }}>{redeemedPainterName(row)}</span>,
      },
      {
        key: "time",
        header: "Time",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)" }}>{formatTimeOnly(row.redeemedAt)}</span>,
      },
      {
        key: "points",
        header: "Points",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) =>
          row.pointsAwarded === false ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <span style={{ color: "var(--color-graphite,#707070)", textDecoration: "line-through" }}>
                {Number(row.points || 0).toLocaleString()}
              </span>
              <Pill tone="caution" size="small">{skipReasonPillLabel(row.skipReason)}</Pill>
            </span>
          ) : (
            <span style={{ fontWeight: 700 }}>{Number(row.points || 0).toLocaleString()}</span>
          ),
      },
      {
        key: "cashAmount",
        header: "Cash",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>{formatMoney(row.cashAmount)}</span>,
      },
    ],
    [],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={type} options={HISTORY_TYPE_OPTIONS} onChange={changeType} style={{ width: 170 }} />
          <AppleDropdown icon="calendar" value={datePreset} options={COUPON_DATE_PRESETS} onChange={changeDatePreset} style={{ width: 170 }} />
          <SearchField value={draftQ} onChange={setDraftQ} onSubmit={submitSearch} placeholder="Search coupon code…" style={{ maxWidth: 260 }} />
          {datePreset === "CUSTOM" ? (
            <>
              <label className="coupon-history-date-field">
                From
                <AppleDateField value={customFrom} onChange={changeCustomFrom} />
              </label>
              <label className="coupon-history-date-field">
                To
                <AppleDateField value={customTo} onChange={changeCustomTo} />
              </label>
            </>
          ) : null}
          {historyQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(row) => row._id}
            loading={historyQuery.isLoading && !historyQuery.data}
            renderGroupHeader={(row) => {
              const group = dayHeaderByFirstRowId.get(row._id);
              if (!group) return null;
              return (
                <>
                  <span className="dash-table-group-dot" aria-hidden="true" />
                  {group.relativeLabel ? (
                    <>
                      <strong>{group.relativeLabel}</strong> · {group.dateText}
                    </>
                  ) : (
                    <strong>{group.dateText}</strong>
                  )}
                </>
              );
            }}
            emptyState={{ icon: "invoice", title: "No redemptions found", subtitle: "Nothing matches these filters yet." }}
            minWidth={860}
          />
          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="redemptions" onChange={setPage} />
        </>
      )}
    </div>
  );
}
