import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminDispatchersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";

const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "VERIFIED", label: "Verified" },
  { key: "PENDING", label: "Pending" },
  { key: "REJECTED", label: "Rejected" },
];

function statusTone(status) {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED" || status === "SUSPENDED") return "critical";
  return "caution";
}

// PENDING/REJECTED dispatchers here still route to the desktop-only
// Applications review flow when tapped (same as AdminDispatchersPage.jsx -
// application approve/reject is a separate phase, not this one), so the
// only real navigation target for a card here is either the profile
// (VERIFIED) or the Applications section (anything else).
export function AdminDispatchersMobileView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const dispatchersQuery = useGetAdminDispatchersQuery({ limit: 1000 });
  const dispatchers = useMemo(() => dispatchersQuery.data?.items || [], [dispatchersQuery.data]);

  const byStatus = useMemo(() => {
    if (status === "ALL") return dispatchers;
    return dispatchers.filter((dispatcher) => dispatcher.status === status);
  }, [dispatchers, status]);

  const visible = useMemo(
    () => rankBySearch(byStatus, query, (dispatcher) => [dispatcher.name, dispatcher.companyName, dispatcher.phone, dispatcher.email]),
    [byStatus, query],
  );

  const counts = useMemo(() => {
    const result = { ALL: dispatchers.length, VERIFIED: 0, PENDING: 0, REJECTED: 0 };
    dispatchers.forEach((dispatcher) => {
      if (result[dispatcher.status] !== undefined) result[dispatcher.status] += 1;
    });
    return result;
  }, [dispatchers]);

  const segmentOptions = useMemo(() => SEGMENTS.map((option) => ({ ...option, count: counts[option.key] })), [counts]);

  const loading = dispatchersQuery.isLoading && dispatchers.length === 0;
  const loadError = dispatchersQuery.error ? getQueryErrorMessage(dispatchersQuery.error, "Failed to load dispatchers.") : "";

  function openDispatcher(dispatcher) {
    if (dispatcher.status === "VERIFIED") {
      navigate(`/admin/dashboard/dispatchers/${dispatcher._id}`);
    } else {
      navigate("/admin/dashboard/applications");
    }
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => dispatchersQuery.refetch()}>
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
            <div className="dealer-m-large-title">Dispatchers</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Dispatchers" contextLabel={`${visible.length} of ${dispatchers.length}`} />

        <div style={{ marginTop: 6 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, company, phone…"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={segmentOptions} value={status} onChange={setStatus} />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="handshake" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No dispatchers found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((dispatcher) => (
              <button key={dispatcher._id} type="button" className="admin-m-card admin-m-feed-row" onClick={() => openDispatcher(dispatcher)}>
                <span className="admin-m-feed-icon">
                  <DashboardIcon name="handshake" size={16} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="admin-m-feed-title">{dispatcher.companyName || dispatcher.name || "Dispatcher"}</span>
                  <span className="admin-m-feed-detail">
                    {dispatcher.operationalSummary?.assignedDealerCount || 0} dealers · {dispatcher.operationalSummary?.handledOrders || 0} orders
                  </span>
                </span>
                <StatusChip tone={statusTone(dispatcher.status)}>{dispatcher.status === "VERIFIED" && dispatcher.isActive === false ? "Inactive" : dispatcher.status}</StatusChip>
              </button>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
