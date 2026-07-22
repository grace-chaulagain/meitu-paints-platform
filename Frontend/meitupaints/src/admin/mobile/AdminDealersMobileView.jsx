import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminDealersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";

const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "VERIFIED", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
];

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function routingLabel(dealer) {
  if ((dealer.fulfillmentMode || "FACTORY") === "DISPATCHER") {
    return `Via ${dealer.dispatcherId?.name || dealer.dispatcherId?.companyName || "dispatcher"}`;
  }
  return "Factory";
}

// ADMIN_MOBILE_DESIGN_PROMPT.md §5 - same "fetch everything, filter
// client-side" pattern AdminDealersPage.jsx already uses ({limit:1000}) so
// switching the status segment never drops the other segments' counts.
export function AdminDealersMobileView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const dealersQuery = useGetAdminDealersQuery({ limit: 1000 });
  const dealers = useMemo(() => dealersQuery.data?.items || [], [dealersQuery.data]);

  const byStatus = useMemo(() => {
    if (status === "ALL") return dealers;
    return dealers.filter((dealer) => dealer.status === status);
  }, [dealers, status]);

  const visible = useMemo(
    () =>
      rankBySearch(byStatus, query, (dealer) => [
        dealer.companyName,
        dealer.contactName,
        dealer.phone,
        dealer.email,
        dealer.dispatcherId?.name,
      ]),
    [byStatus, query],
  );

  const counts = useMemo(() => {
    const result = { ALL: dealers.length, VERIFIED: 0, SUSPENDED: 0 };
    dealers.forEach((dealer) => {
      if (dealer.status === "VERIFIED") result.VERIFIED += 1;
      else if (dealer.status === "SUSPENDED") result.SUSPENDED += 1;
    });
    return result;
  }, [dealers]);

  const segmentOptions = useMemo(() => SEGMENTS.map((option) => ({ ...option, count: counts[option.key] })), [counts]);

  const loading = dealersQuery.isLoading && dealers.length === 0;
  const loadError = dealersQuery.error ? getQueryErrorMessage(dealersQuery.error, "Failed to load dealers.") : "";

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => dealersQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Dealers</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Dealers" contextLabel={`${visible.length} of ${dealers.length}`} />

        <div style={{ marginTop: 6 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, contact, phone…"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={segmentOptions} value={status} onChange={setStatus} />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="store" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No dealers found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((dealer) => (
              <button
                key={dealer._id}
                type="button"
                className="admin-m-card admin-m-feed-row"
                onClick={() => navigate(`/admin/dashboard/dealers/${dealer._id}`)}
              >
                <span className="admin-m-feed-icon">
                  <DashboardIcon name="store" size={16} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="admin-m-feed-title">{dealer.companyName || "Unnamed Dealer"}</span>
                  <span className="admin-m-feed-detail">
                    {routingLabel(dealer)} · {money(dealer.analyticsSummary?.totalApprovedSales)}
                  </span>
                </span>
                <StatusChip tone={dealer.status === "VERIFIED" ? "positive" : "critical"}>
                  {dealer.status === "VERIFIED" ? "Active" : "Suspended"}
                </StatusChip>
              </button>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
