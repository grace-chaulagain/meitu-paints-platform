import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDealerQuery,
  useGetAdminScopedOrdersQuery,
  useGetProductFamiliesQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import {
  AdminOrderCardStyles,
  AdminOrderTimelineRow,
} from "../orders/AdminOrdersPage.jsx";
import { groupOrdersByDay } from "../orders/orderFormatting.js";
import { OwnerChipStyles } from "../../../components/orderflow/OwnerChip.jsx";
import { OrderFlowRailStyles } from "../../../components/orderflow/OrderStatusRail.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

// Mirrors AdminOrdersPage.jsx's own status tabs (ALL is a real, distinct
// server-side scope there - "no status/archive param at all" quietly
// defaults to SUBMITTED-only, see listOrdersForActor in order.service.js -
// so this list must pass status:"ALL" explicitly or a dealer's own "full
// order history" would silently only ever show their still-pending orders).
const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

const LIST_DEFAULTS = { search: "", status: "ALL" };

function parseListState(search) {
  const params = new URLSearchParams(search || "");
  const status = params.get("status") || LIST_DEFAULTS.status;
  return {
    search: params.get("q") || LIST_DEFAULTS.search,
    status: STATUS_FILTERS.some((option) => option.key === status) ? status : LIST_DEFAULTS.status,
  };
}

function buildListSearch(state) {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.status && state.status !== LIST_DEFAULTS.status) params.set("status", state.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// A plain, minimal top-left back link - Apple's own back-navigation
// convention (chevron + text, no button chrome) rather than a boxed
// button competing with the page's real actions.
function BackLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        color: "var(--color-azure, #0071e3)",
        fontSize: 14.5,
        fontWeight: 600,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {children}
    </button>
  );
}

export default function AdminDealerOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)\/orders$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const listState = useMemo(() => parseListState(location.search), [location.search]);
  const { search, status } = listState;

  const updateListState = useCallback(
    (patch) => {
      const next = { ...listState, ...patch };
      navigate(
        { pathname: `/admin/dashboard/dealers/${dealerId}/orders`, search: buildListSearch(next) },
        { replace: true },
      );
    },
    [listState, navigate, dealerId],
  );

  const setSearch = useCallback((value) => updateListState({ search: value }), [updateListState]);
  const setStatus = useCallback((value) => updateListState({ status: value }), [updateListState]);

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  // No status param at all - admin.service.js's listOrders (the backend for
  // /api/admin/orders, a different implementation than the fleet-wide
  // /api/orders the main Orders page uses) does a plain `if (status)
  // q.status = status`, with no "ALL means every status" special case. Send
  // the frontend's "ALL" sentinel literally and it filters for orders whose
  // status is the string "ALL" - i.e. none - so omitting the param entirely
  // is what actually fetches every status; status filtering happens
  // client-side below instead. limit:100 is the server's own validated
  // ceiling (order.validation.js), not just a sensible default - this is
  // meant to be the dealer's *complete* order history.
  const ordersQuery = useGetAdminScopedOrdersQuery(
    { dealerId, limit: 100 },
    { skip: !dealerId },
  );
  const productsQuery = useGetProductsQuery();
  const familiesQuery = useGetProductFamiliesQuery();

  const dealer = dealerQuery.data?.item || null;

  const productsMap = useMemo(() => {
    const map = {};
    for (const item of productsQuery.data || []) map[item.sku] = item;
    return map;
  }, [productsQuery.data]);

  const familyMap = useMemo(() => {
    const map = {};
    for (const family of familiesQuery.data || []) {
      if (family?.code) map[family.code] = family;
    }
    return map;
  }, [familiesQuery.data]);

  const allDealerOrders = useMemo(() => {
    const incomingOrders = ordersQuery.data?.items || [];
    return incomingOrders.filter((order) => {
      const directDealerId = String(order?.dealerId?._id || order?.dealerId || "");
      const snapshotDealerId = String(order?.dealerSnapshot?._id || "");
      return directDealerId === dealerId || snapshotDealerId === dealerId;
    });
  }, [ordersQuery.data, dealerId]);

  const loading =
    !dealer && allDealerOrders.length === 0 && (dealerQuery.isLoading || ordersQuery.isLoading);
  const isRefreshing =
    Boolean(dealer || allDealerOrders.length) && (dealerQuery.isFetching || ordersQuery.isFetching);
  const queryError = dealerQuery.error || ordersQuery.error;
  const error = queryError ? getQueryErrorMessage(queryError, "Failed to load order history.") : "";

  function loadPageData() {
    dealerQuery.refetch();
    ordersQuery.refetch();
  }

  const searchedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDealerOrders;

    return allDealerOrders.filter((order) =>
      [order.orderNumber, order.payment?.method, order.payment?.reference, order.dealerNote, order.internalNote]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [allDealerOrders, search]);

  const filteredOrders = useMemo(() => {
    if (status === "ALL") return searchedOrders;
    return searchedOrders.filter((order) => String(order.status || "").toUpperCase() === status);
  }, [searchedOrders, status]);

  const countsByStatus = useMemo(() => {
    const counts = { ALL: allDealerOrders.length };
    for (const option of STATUS_FILTERS) {
      if (option.key === "ALL") continue;
      counts[option.key] = allDealerOrders.filter(
        (order) => String(order.status || "").toUpperCase() === option.key,
      ).length;
    }
    return counts;
  }, [allDealerOrders]);

  const dayGroups = useMemo(() => groupOrdersByDay(filteredOrders), [filteredOrders]);

  const openOrder = useCallback(
    (order) => {
      navigate(`/admin/dashboard/dealers/${dealerId}/orders/${order._id}`, {
        state: { fromDealerOrdersList: true },
      });
    },
    [navigate, dealerId],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />
      <AdminOrderCardStyles />
      <OwnerChipStyles />
      <OrderFlowRailStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}`)}>Back to Dealer Profile</BackLink>

      <Surface padding={18} className="dash-fade-up">
        <SectionHeader
          icon="orders"
          title="Order History"
          subtitle={dealer?.companyName || ""}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isRefreshing ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              <GhostButton icon="refresh" onClick={loadPageData}>Refresh</GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 320, flex: "1 1 240px" }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search order number, payment, notes…" />
          </div>
          <SegmentedControl
            options={STATUS_FILTERS.map((option) => ({ ...option, count: countsByStatus[option.key] }))}
            value={status}
            onChange={setStatus}
          />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : filteredOrders.length === 0 ? (
        <Surface padding={20}>
          <EmptyState
            icon="orders"
            title="No orders found"
            subtitle={dealer?.companyName ? `No matching order records were found for ${dealer.companyName}.` : "No matching order records were found for this dealer."}
          />
          <div style={{ marginTop: 4 }}>
            <GhostButton onClick={() => updateListState({ search: "", status: "ALL" })}>Clear filters</GhostButton>
          </div>
        </Surface>
      ) : (
        <div className="admin-order-timeline">
          {dayGroups.map((group) => (
            <div key={group.key} className="admin-order-timeline-day">
              <div className="admin-order-timeline-day-header">
                <div className="admin-order-timeline-day-label">
                  {group.relativeLabel ? (
                    <>
                      <strong>{group.relativeLabel}</strong>
                      <span className="admin-order-timeline-day-sep">•</span>
                      <span>{group.dateText}</span>
                    </>
                  ) : (
                    <strong>{group.dateText}</strong>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {group.orders.map((order) => (
                  <AdminOrderTimelineRow
                    key={order._id}
                    item={order}
                    onOpen={openOrder}
                    onVerify={openOrder}
                    isArrived={false}
                    productsMap={productsMap}
                    familyMap={familyMap}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
