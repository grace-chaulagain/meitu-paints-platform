import { useMemo, useState } from "react";
import {
  useGetAdminDealerApplicationsQuery,
  useGetAdminDispatcherApplicationsQuery,
  useGetAdminDealerApplicationQuery,
  useGetAdminDispatcherQuery,
  useGetVerifiedDispatchersQuery,
  useApproveDealerApplicationMutation,
  useRejectDealerApplicationMutation,
  useApproveDispatcherMutation,
  useRejectDispatcherMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { toast } from "../../dealer/mobile/useToast.js";

const FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

function statusTone(status) {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED") return "critical";
  return "caution";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Mirrors AdminApplicationsPage.jsx's own architecture exactly: no per-
// application URL exists (desktop keeps `selectedApplication` as local
// state and swaps in a detail component), so the mobile list does the same
// rather than inventing a route that doesn't exist elsewhere in the app.
function AdminApplicationDetailMobileView({ type, id, onBack, onDone }) {
  const isDealer = type === "DEALER";
  const dealerQuery = useGetAdminDealerApplicationQuery(id, { skip: !isDealer || !id });
  const dispatcherQuery = useGetAdminDispatcherQuery(id, { skip: isDealer || !id });
  const dispatchersQuery = useGetVerifiedDispatchersQuery(undefined, { skip: !isDealer });

  const [approveDealer] = useApproveDealerApplicationMutation();
  const [rejectDealer] = useRejectDealerApplicationMutation();
  const [approveDispatcher] = useApproveDispatcherMutation();
  const [rejectDispatcher] = useRejectDispatcherMutation();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [approveSheetOpen, setApproveSheetOpen] = useState(false);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState("FACTORY");
  const [dispatcherId, setDispatcherId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const query = isDealer ? dealerQuery : dispatcherQuery;
  const application = query.data?.item || null;
  const dispatchers = dispatchersQuery.data?.items || [];
  const loading = query.isLoading && !application;
  const loadError = query.error ? getQueryErrorMessage(query.error, "Failed to load application.") : "";

  if (!loading && (loadError || !application)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Application" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This application could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to applications
          </button>
        </div>
      </div>
    );
  }

  const name = isDealer ? application?.companyName : application?.companyName || application?.name;
  const contact = isDealer ? application?.contactName : application?.name;
  const canDecide = application?.status === "PENDING";

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      if (isDealer) {
        await approveDealer({
          applicationId: application._id,
          payload: {
            fulfillmentMode,
            dispatcherId: fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
            reviewNote: reviewNote.trim(),
          },
        }).unwrap();
      } else {
        await approveDispatcher({ dispatcherId: application._id, payload: { notes: application.notes || "" } }).unwrap();
      }
      toast(`${name || "Application"} approved`);
      onDone();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to approve application."));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError("");
    try {
      if (isDealer) {
        await rejectDealer({ applicationId: application._id, payload: { reviewNote: rejectNote.trim() } }).unwrap();
      } else {
        await rejectDispatcher({ dispatcherId: application._id, payload: { notes: application.notes || "" } }).unwrap();
      }
      toast(`${name || "Application"} rejected`);
      onDone();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to reject application."));
    } finally {
      setBusy(false);
    }
  }

  const canApproveDealer = fulfillmentMode === "FACTORY" || (fulfillmentMode === "DISPATCHER" && dispatcherId);

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Application" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
          </>
        }
      >
        {application ? (
          <>
            <MobilePushHeader title={name || "Application"} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className="dealer-m-order-hero-headline">{name || "Application"}</div>
              <div className="dealer-m-order-hero-sub">Submitted {formatDate(application.createdAt)}</div>
            </div>

            <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
              <StatusChip tone={isDealer ? "neutral" : "accent"}>{isDealer ? "Dealer" : "Dispatcher"}</StatusChip>
              <StatusChip tone={statusTone(application.status)}>{application.status === "VERIFIED" ? "Approved" : application.status}</StatusChip>
            </div>

            {error ? <div className="dealer-m-newsale-error" style={{ marginTop: 12 }}>{error}</div> : null}

            <div className="admin-m-card" style={{ marginTop: 16 }}>
              <div className="admin-m-section-title">Applicant</div>
              <div className="admin-m-kv-row" style={{ paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Contact</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{contact || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Email</span>
                <span style={{ fontSize: 13, fontWeight: 700, wordBreak: "break-word", textAlign: "right" }}>{application.email || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Phone</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{application.phone || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Address</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", wordBreak: "break-word" }}>{application.address || "—"}</span>
              </div>
              {isDealer && application.panVat ? (
                <div className="admin-m-kv-row">
                  <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>PAN/VAT</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{application.panVat}</span>
                </div>
              ) : null}
            </div>

            {application.notes || application.reviewNote ? (
              <div className="admin-m-card">
                <div className="admin-m-section-title">Notes</div>
                {application.notes ? (
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>{application.notes}</div>
                ) : null}
                {application.reviewNote ? (
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>{application.reviewNote}</div>
                ) : null}
              </div>
            ) : null}

            {canDecide ? (
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <PrimaryButton
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setRejectNote("");
                    setRejectSheetOpen(true);
                  }}
                >
                  Reject
                </PrimaryButton>
                <PrimaryButton
                  variant="primary"
                  disabled={busy}
                  onClick={() => {
                    setFulfillmentMode("FACTORY");
                    setDispatcherId("");
                    setReviewNote("");
                    setApproveSheetOpen(true);
                  }}
                >
                  {isDealer ? "Verify" : "Approve"}
                </PrimaryButton>
              </div>
            ) : null}
          </>
        ) : null}
      </SkeletonSwap>

      <MobileSheet
        open={approveSheetOpen}
        onClose={() => {
          if (!busy) setApproveSheetOpen(false);
        }}
        ariaLabel="Approve application"
        footer={
          <PrimaryButton loading={busy} disabled={isDealer && !canApproveDealer} onClick={handleApprove}>
            {isDealer ? "Verify Dealer" : "Approve Dispatcher"}
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">{isDealer ? "Verify this dealer?" : "Approve this dispatcher?"}</div>
        {isDealer ? (
          <>
            <div className="dealer-m-newsale-field-label">Fulfillment Mode</div>
            <div style={{ marginTop: 8 }}>
              <SegmentedControl
                options={[
                  { key: "FACTORY", label: "Factory" },
                  { key: "DISPATCHER", label: "Dispatcher" },
                ]}
                value={fulfillmentMode}
                onChange={(value) => {
                  setFulfillmentMode(value);
                  setDispatcherId("");
                }}
              />
            </div>
            {fulfillmentMode === "DISPATCHER" ? (
              <>
                <div className="dealer-m-newsale-field-label">Assigned Dispatcher</div>
                <select className="admin-m-select" value={dispatcherId} onChange={(e) => setDispatcherId(e.target.value)}>
                  <option value="">Select dispatcher</option>
                  {dispatchers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.companyName ? `${d.name} · ${d.companyName}` : d.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <div className="dealer-m-newsale-field-label">Review Note (optional)</div>
            <textarea className="dealer-m-newsale-textarea" rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          </>
        ) : (
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
            {application?.companyName || application?.name} will gain dispatcher access and can be assigned dealers.
          </div>
        )}
      </MobileSheet>

      <MobileSheet
        open={rejectSheetOpen}
        onClose={() => {
          if (!busy) setRejectSheetOpen(false);
        }}
        ariaLabel="Reject application"
        footer={
          <PrimaryButton variant="danger" loading={busy} disabled={isDealer && !rejectNote.trim()} onClick={handleReject}>
            Reject Application
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Reject this application?</div>
        {isDealer ? (
          <>
            <div className="dealer-m-newsale-field-label">Rejection Reason (required)</div>
            <textarea className="dealer-m-newsale-textarea" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </>
        ) : (
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>This cannot be undone.</div>
        )}
      </MobileSheet>
    </div>
  );
}

export function AdminApplicationsMobileView() {
  const [filter, setFilter] = useState("PENDING");
  const [selected, setSelected] = useState(null); // { type, id }

  const dealerApplicationsQuery = useGetAdminDealerApplicationsQuery({ limit: 100 });
  const dispatcherApplicationsQuery = useGetAdminDispatcherApplicationsQuery({ limit: 100 });

  const items = useMemo(() => {
    const dealerItems = (dealerApplicationsQuery.data?.items || []).map((item) => ({
      ...item,
      type: "DEALER",
      title: item.companyName || "Dealer Application",
      contact: item.contactName,
    }));
    const dispatcherItems = (dispatcherApplicationsQuery.data?.items || []).map((item) => ({
      ...item,
      type: "DISPATCHER",
      title: item.companyName || item.name || "Dispatcher Application",
      contact: item.name,
    }));
    return [...dealerItems, ...dispatcherItems].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [dealerApplicationsQuery.data, dispatcherApplicationsQuery.data]);

  const counts = useMemo(() => {
    const result = { PENDING: 0, VERIFIED: 0, REJECTED: 0, ALL: items.length };
    items.forEach((item) => {
      if (result[item.status] !== undefined) result[item.status] += 1;
    });
    return result;
  }, [items]);

  const visible = useMemo(() => (filter === "ALL" ? items : items.filter((item) => item.status === filter)), [items, filter]);

  const loading = dealerApplicationsQuery.isLoading && dispatcherApplicationsQuery.isLoading && items.length === 0;
  const loadError = dealerApplicationsQuery.error || dispatcherApplicationsQuery.error
    ? getQueryErrorMessage(dealerApplicationsQuery.error || dispatcherApplicationsQuery.error, "Failed to load applications.")
    : "";

  if (selected) {
    return (
      <AdminApplicationDetailMobileView
        type={selected.type}
        id={selected.id}
        onBack={() => setSelected(null)}
        onDone={() => setSelected(null)}
      />
    );
  }

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
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
            <div className="dealer-m-large-title">Applications</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Applications" contextLabel={`${visible.length} of ${items.length}`} />

        <div style={{ marginTop: 6 }}>
          <SegmentedControl options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="inbox" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No applications here</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((item) => (
              <button key={item._id} type="button" className="admin-m-card admin-m-feed-row" onClick={() => setSelected({ type: item.type, id: item._id })}>
                <span className="admin-m-feed-icon">
                  <DashboardIcon name={item.type === "DEALER" ? "store" : "handshake"} size={16} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="admin-m-feed-title">{item.title}</span>
                  <span className="admin-m-feed-detail">
                    {item.contact || "—"} · {formatDate(item.createdAt)}
                  </span>
                </span>
                <StatusChip tone={statusTone(item.status)}>{item.status === "VERIFIED" ? "Approved" : item.status}</StatusChip>
              </button>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
