import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDispatcherQuery,
  useResendDispatcherSetupEmailMutation,
} from "../../../redux/api/meituApi.js";

function GlassCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "No activity";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Metric({ label, value, helper = "", accent = false }) {
  return (
    <div className={`dispatcher-profile-metric ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <em>{helper}</em> : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  const tone =
    normalized === "VERIFIED"
      ? "good"
      : normalized === "REJECTED" || normalized === "SUSPENDED"
        ? "bad"
        : "neutral";
  return <span className={`dispatcher-profile-status ${tone}`}>{status || "—"}</span>;
}

export default function AdminDispatcherProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dispatchers\/([^/]+)$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const {
    data: dispatcher = null,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const [resendSetupEmail] = useResendDispatcherSetupEmailMutation();

  const loading = isLoading && !dispatcher;
  const pageError = error || queryError?.message || "";

  if (loading) {
    return (
      <div className="dispatcher-profile-page">
        {Array.from({ length: 4 }).map((_, index) => (
          <GlassCard key={index} style={{ padding: 18 }}>
            <div className="dispatcher-profile-skeleton" />
          </GlassCard>
        ))}
      </div>
    );
  }

  if (!dispatcher) {
    return (
      <GlassCard style={{ padding: 26 }}>
        <div className="dispatcher-profile-empty-title">
          Dispatcher not found
        </div>
        <div className="dispatcher-profile-empty-copy">
          The requested dispatcher profile could not be loaded.
        </div>
        <button
          type="button"
          className="dispatcher-profile-button"
          onClick={() => navigate("/admin/dashboard/dispatchers")}
        >
          Back to Dispatchers
        </button>
      </GlassCard>
    );
  }

  const summary = dispatcher.operationalSummary || {};
  const assignedDealers = dispatcher.assignedDealers || [];
  const accessState = dispatcher.accessState || {};

  async function handleResendSetup() {
    if (!accessState.userId) return;

    try {
      setBusy("setup");
      setError("");
      setSuccess("");
      await resendSetupEmail(accessState.userId).unwrap();
      await refetch();
      setSuccess("A fresh password setup link has been sent if eligible.");
    } catch (err) {
      setError(
        err?.data?.error ||
          err?.data?.message ||
          err?.message ||
          "Failed to resend setup link.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="dispatcher-profile-page">
      <GlassCard style={{ padding: 22 }}>
        <div className="dispatcher-profile-header">
          <div>
            <div className="dispatcher-profile-kicker">Dispatcher Profile</div>
            <h1>{dispatcher.name || dispatcher.companyName || "Dispatcher"}</h1>
            <p>
              Assigned dealer network, workload, and recent routing activity for
              this dispatcher.
            </p>
          </div>
          <div className="dispatcher-profile-actions">
            <button type="button" onClick={() => navigate(-1)}>
              Back
            </button>
            <button type="button" onClick={refetch}>
              {isFetching && dispatcher ? "Updating..." : "Refresh"}
            </button>
            {accessState.canResendSetup ? (
              <button
                type="button"
                onClick={handleResendSetup}
                disabled={busy === "setup"}
              >
                {busy === "setup" ? "Sending..." : "Resend Setup"}
              </button>
            ) : null}
          </div>
        </div>
        {pageError ? <div className="dispatcher-profile-error">{pageError}</div> : null}
        {success ? (
          <div className="dispatcher-profile-success">{success}</div>
        ) : null}
      </GlassCard>

      <div className="dispatcher-profile-strip">
        <Metric
          label="Assigned Dealers"
          value={summary.assignedDealerCount || 0}
          helper={`${summary.activeAssignedDealerCount || 0} active`}
          accent
        />
        <Metric
          label="Pending Workload"
          value={summary.pendingOrders || 0}
          helper="Submitted assigned orders"
        />
        <Metric
          label="Verified / Rejected"
          value={`${summary.verifiedOrders || 0}/${summary.rejectedOrders || 0}`}
          helper="Handled outcomes"
        />
        <Metric
          label="Verified Sales"
          value={money(summary.totalVerifiedSales)}
          helper="Dispatcher-routed"
          accent
        />
      </div>

      <GlassCard>
        <div className="dispatcher-profile-list-head">
          <span>Access State</span>
          <em>{accessState.accountStatus || "—"}</em>
        </div>
        <div className="dispatcher-profile-access-grid">
          <div>
            <span>Password Set</span>
            <strong>{accessState.passwordSet ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Invitation Last Sent</span>
            <strong>
              {accessState.invitationLastSentAt
                ? formatDate(accessState.invitationLastSentAt)
                : "—"}
            </strong>
          </div>
          <div>
            <span>Invitation Expires</span>
            <strong>
              {accessState.invitationExpiresAt
                ? formatDate(accessState.invitationExpiresAt)
                : "—"}
            </strong>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="dispatcher-profile-list-head">
          <span>Assigned Dealers</span>
          <em>{assignedDealers.length} accounts</em>
        </div>

        {assignedDealers.length ? (
          <div className="dispatcher-profile-list">
            {assignedDealers.map((dealer) => {
              const activity = dealer.activitySummary || {};
              return (
                <button
                  key={dealer._id}
                  type="button"
                  className="dispatcher-profile-row"
                  onClick={() =>
                    navigate(`/admin/dashboard/dealers/${dealer._id}`)
                  }
                >
                  <span className="dispatcher-profile-main">
                    <strong>{dealer.companyName || "Dealer"}</strong>
                    <em>
                      {dealer.contactName || "No contact"} · last{" "}
                      {formatDate(activity.lastOrderAt)}
                    </em>
                  </span>
                  <StatusBadge status={dealer.status} />
                  <span className="dispatcher-profile-row-metrics">
                    <strong>{activity.pendingOrders || 0} pending</strong>
                    <em>
                      {activity.verifiedOrders || 0} verified ·{" "}
                      {money(activity.totalVerifiedSales)}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="dispatcher-profile-empty">
            No dealers are currently assigned to this dispatcher.
          </div>
        )}
      </GlassCard>

      <style>{`
        .dispatcher-profile-page{ display:grid; gap:18px; }
        .dispatcher-profile-header{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
        .dispatcher-profile-kicker{ font-size:12px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .dispatcher-profile-header h1{ margin:8px 0 0; color:#0f172a; font-size:30px; line-height:1.1; font-weight:950; letter-spacing:-.03em; }
        .dispatcher-profile-header p{ margin:8px 0 0; max-width:680px; color:rgba(15,23,42,.58); font-size:14px; line-height:1.65; font-weight:700; }
        .dispatcher-profile-actions{ display:flex; gap:10px; flex-wrap:wrap; }
        .dispatcher-profile-button,
        .dispatcher-profile-actions button{ min-height:40px; border-radius:14px; border:1px solid rgba(15,23,42,.08); background:#fff; color:#0f172a; padding:0 14px; font-weight:900; cursor:pointer; }
        .dispatcher-profile-error{ margin-top:14px; padding:13px 15px; border-radius:16px; background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.14); font-weight:800; }
        .dispatcher-profile-success{ margin-top:14px; padding:13px 15px; border-radius:16px; background:rgba(18,183,106,.09); color:#067647; border:1px solid rgba(18,183,106,.16); font-weight:800; }
        .dispatcher-profile-access-grid{ padding:18px; display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
        .dispatcher-profile-access-grid div{ border-radius:18px; background:#fff; border:1px solid rgba(15,23,42,.06); padding:14px; display:grid; gap:7px; }
        .dispatcher-profile-access-grid span{ font-size:11px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .dispatcher-profile-access-grid strong{ color:#0f172a; font-size:13px; line-height:1.45; font-weight:900; word-break:break-word; }
        .dispatcher-profile-strip{ display:grid; grid-template-columns:repeat(auto-fit, minmax(190px,1fr)); gap:12px; }
        .dispatcher-profile-metric{ border-radius:20px; padding:16px 18px; background:rgba(255,255,255,.86); border:1px solid rgba(15,23,42,.07); box-shadow:0 16px 34px rgba(15,23,42,.05); display:grid; gap:7px; }
        .dispatcher-profile-metric.accent{ background:rgba(180,35,24,.055); border-color:rgba(180,35,24,.12); }
        .dispatcher-profile-metric span{ font-size:11px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .dispatcher-profile-metric strong{ font-size:25px; line-height:1.1; font-weight:950; color:#0f172a; letter-spacing:-.03em; }
        .dispatcher-profile-metric.accent strong{ color:#b42318; }
        .dispatcher-profile-metric em{ font-style:normal; font-size:12px; line-height:1.45; font-weight:800; color:rgba(15,23,42,.55); }
        .dispatcher-profile-list-head{ padding:16px 18px; border-bottom:1px solid rgba(15,23,42,.07); display:flex; justify-content:space-between; gap:12px; align-items:center; }
        .dispatcher-profile-list-head span{ font-size:12px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:rgba(15,23,42,.52); }
        .dispatcher-profile-list-head em{ font-style:normal; font-size:12px; font-weight:900; color:rgba(15,23,42,.46); }
        .dispatcher-profile-list{ display:grid; }
        .dispatcher-profile-row{ width:100%; border:0; border-bottom:1px solid rgba(15,23,42,.06); background:#fff; padding:15px 18px; display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:14px; align-items:center; text-align:left; cursor:pointer; }
        .dispatcher-profile-row:last-child{ border-bottom:0; }
        .dispatcher-profile-main,
        .dispatcher-profile-row-metrics{ display:grid; gap:4px; min-width:0; }
        .dispatcher-profile-main strong{ color:#0f172a; font-size:15px; font-weight:950; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .dispatcher-profile-main em,
        .dispatcher-profile-row-metrics em{ font-style:normal; color:rgba(15,23,42,.52); font-size:12px; line-height:1.45; font-weight:800; }
        .dispatcher-profile-row-metrics{ justify-items:end; text-align:right; }
        .dispatcher-profile-row-metrics strong{ color:#0f172a; font-size:13px; font-weight:950; }
        .dispatcher-profile-status{ height:28px; padding:0 10px; border-radius:999px; display:inline-flex; align-items:center; font-size:11px; font-weight:950; letter-spacing:.04em; }
        .dispatcher-profile-status.good{ background:rgba(22,163,74,.08); color:#15803d; border:1px solid rgba(22,163,74,.12); }
        .dispatcher-profile-status.bad{ background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.12); }
        .dispatcher-profile-status.neutral{ background:rgba(15,23,42,.05); color:#475569; border:1px solid rgba(15,23,42,.08); }
        .dispatcher-profile-empty,
        .dispatcher-profile-empty-copy{ padding:18px; color:rgba(15,23,42,.58); font-weight:800; }
        .dispatcher-profile-empty-title{ font-size:24px; font-weight:950; letter-spacing:-.03em; color:#0f172a; }
        .dispatcher-profile-skeleton{ height:86px; border-radius:18px; background:linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9)); }
        @media (max-width:760px){
          .dispatcher-profile-actions,
          .dispatcher-profile-actions button{ width:100%; }
          .dispatcher-profile-row{ grid-template-columns:1fr; }
          .dispatcher-profile-row-metrics{ justify-items:start; text-align:left; }
        }
      `}</style>
    </div>
  );
}
