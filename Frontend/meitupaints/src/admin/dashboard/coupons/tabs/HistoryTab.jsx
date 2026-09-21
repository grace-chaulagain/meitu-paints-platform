import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetCouponRedemptionHistoryQuery,
  useGetAdminDealersQuery,
  useGetVerifiedDispatchersQuery,
} from "../../../../redux/api/meituApi.js";
import { rankByLooseSearch } from "../../../../utils/searchMatch.js";
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
  redeemedByName,
  redeemedPainterName,
  resolveCouponDateRange,
  skipReasonPillLabel,
} from "../couponFormatting.js";

export default function HistoryTab() {
  const navigate = useNavigate();
  const location = useLocation();
  // Who the history is scoped to, if anyone. Read from the URL so a
  // "See redeem history" link is a real, shareable address.
  const actor = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const name = p.get("actorName") || "";
    if (p.get("dealerId")) return { kind: "DEALER", id: p.get("dealerId"), name: name || "this dealer" };
    if (p.get("dispatcherId")) return { kind: "DISPATCHER", id: p.get("dispatcherId"), name: name || "this dispatcher" };
    return null;
  }, [location.search]);

  function scopeTo(next) {
    const search = new URLSearchParams(location.search);
    search.set("tab", "history");
    search.delete("dealerId");
    search.delete("dispatcherId");
    search.delete("actorName");
    if (next) {
      search.set(next.kind === "DISPATCHER" ? "dispatcherId" : "dealerId", next.id);
      search.set("actorName", next.name);
    }
    navigate({ pathname: location.pathname, search: `?${search}` });
  }

  const [type, setType] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [rowMenu, setRowMenu] = useState(null);

  const historyParams = useMemo(() => {
    const params = { type, q, page, limit: PAGE_SIZE };
    if (actor?.kind === "DEALER") params.dealerId = actor.id;
    else if (actor?.kind === "DISPATCHER") params.dispatcherId = actor.id;
    const { from, to } = resolveCouponDateRange(datePreset, customFrom, customTo);
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }, [actor, customFrom, customTo, datePreset, page, q, type]);

  // Loaded only while the admin is actually typing a name, so the tab costs
  // nothing extra to open.
  const wantsSuggestions = draftQ.trim().length >= 2 && !actor;
  const dealersQuery = useGetAdminDealersQuery({ limit: 200 }, { skip: !wantsSuggestions });
  const dispatchersQuery = useGetVerifiedDispatchersQuery(undefined, { skip: !wantsSuggestions });

  const people = useMemo(() => {
    const dealers = (dealersQuery.data?.items || []).map((d) => ({
      kind: "DEALER",
      id: String(d._id),
      name: d.companyName || d.contactName || "Dealer",
      contactName: d.contactName || "",
      label: "Dealer",
    }));
    const dispatchers = (dispatchersQuery.data?.items || []).map((d) => ({
      kind: "DISPATCHER",
      id: String(d._id),
      name: d.companyName || d.name || "Dispatcher",
      contactName: d.contactName || "",
      label: "Dispatcher",
    }));
    return [...dealers, ...dispatchers];
  }, [dealersQuery.data, dispatchersQuery.data]);

  // Same forgiving matcher the scheme-order recipient picker uses, so a typo
  // or a set of initials still finds the right name.
  const suggestions = useMemo(
    () => (wantsSuggestions ? rankByLooseSearch(people, draftQ, (p) => [p.name, p.contactName, p.label]).slice(0, 6) : []),
    [people, draftQ, wantsSuggestions],
  );

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
    // Enter with exactly one matching name picks it; otherwise the text is
    // treated as a coupon code, which is what this box always did.
    if (suggestions.length === 1) {
      pickPerson(suggestions[0]);
      return;
    }
    setQ(draftQ.trim());
    setPage(1);
  }

  function pickPerson(person) {
    setDraftQ("");
    setQ("");
    setPage(1);
    scopeTo(person);
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
        header: "Redeemed By",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)" }}>{redeemedByName(row)}</span>,
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
          {actor ? (
            // While the history is scoped to one person the box is replaced by
            // a chip - there is nothing useful to type until it is cleared.
            <span className="coupon-history-scope">
              <DashboardIcon name={actor.kind === "DISPATCHER" ? "truck" : "store"} size={13} strokeWidth={2} />
              <span className="coupon-history-scope-name">{actor.name}</span>
              <button type="button" onClick={() => scopeTo(null)} aria-label="Show every redemption again">
                <DashboardIcon name="close" size={11} strokeWidth={2.6} />
              </button>
            </span>
          ) : (
            <span className="coupon-history-search">
              <SearchField
                value={draftQ}
                onChange={setDraftQ}
                onSubmit={submitSearch}
                placeholder="Search coupon code or dealer…"
                style={{ maxWidth: 260 }}
              />
              {suggestions.length ? (
                <div className="coupon-history-suggest" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                  {suggestions.map((person) => (
                    <button key={`${person.kind}:${person.id}`} type="button" role="option" aria-selected="false" onClick={() => pickPerson(person)}>
                      <span className="coupon-history-suggest-name">{person.name}</span>
                      <span className="coupon-history-suggest-kind">{person.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          )}
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
            onRowClick={(row) => setRowMenu((current) => (current?._id === row._id ? null : row))}
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
          {rowMenu ? (
            <div className="coupon-history-rowmenu-backdrop" onClick={() => setRowMenu(null)}>
              <div className="coupon-history-rowmenu" onClick={(e) => e.stopPropagation()}>
                <div className="coupon-history-rowmenu-head">
                  <strong>{redeemedByName(rowMenu)}</strong>
                  <span>{rowMenu.couponCode}</span>
                </div>
                <button
                  type="button"
                  className="coupon-history-rowmenu-action"
                  disabled={!rowMenu.dealerId && !rowMenu.dispatcherId}
                  onClick={() => {
                    const person = rowMenu.dealerId
                      ? { kind: "DEALER", id: String(rowMenu.dealerId._id || rowMenu.dealerId), name: redeemedByName(rowMenu) }
                      : { kind: "DISPATCHER", id: String(rowMenu.dispatcherId._id || rowMenu.dispatcherId), name: redeemedByName(rowMenu) };
                    setRowMenu(null);
                    pickPerson(person);
                  }}
                >
                  <DashboardIcon name="history" size={14} strokeWidth={2} />
                  See redeem history
                </button>
                <button type="button" className="coupon-history-rowmenu-cancel" onClick={() => setRowMenu(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="redemptions" onChange={setPage} />
        </>
      )}
    </div>
  );
}
