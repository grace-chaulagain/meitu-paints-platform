import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDispatcherAnalyticsQuery,
  useGetAdminDispatcherQuery,
  useResendDispatcherSetupEmailMutation,
  useSetAdminDispatcherActiveMutation,
  useUpdateAdminDispatcherMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import {
  Avatar,
  DashboardUIStyles,
  GhostButton,
  ListRow,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { useIsMobileAdmin } from "../../mobile/useIsMobileAdmin.js";
import { AdminDispatcherProfileMobileView } from "../../mobile/AdminDispatcherProfileMobileView.jsx";
import { isDetailMissing, joinDetailLabels } from "../../../utils/missingDetails.js";
import EditDispatcherModal from "./EditDispatcherModal.jsx";
import DispatcherHubMark from "./DispatcherHubMark.jsx";
import {
  DISPATCHER_DETAIL_FIELDS,
  dispatcherDisplayId,
  dispatcherStateLabel,
  healthBand,
  missingDispatcherDetails,
} from "./dispatcherDetails.js";

// Laid out like the dealer profile (breadcrumb + actions, summary card, tabs,
// labelled rows) so an admin moving between the two finds everything in the
// same place. What sets it apart is deliberate: a square "hub" mark with a
// truck badge instead of the dealer's round avatar, a DISPATCHER eyebrow, and
// a slate-indigo accent (from the palette's indigo finish) where the dealer
// page uses Meitu red.

const TAB_OPTIONS = [
  { key: "overview", label: "Overview" },
  { key: "dealers", label: "Dealers" },
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
];

const DETAIL_ICONS = { name: "user", companyName: "store", phone: "headset", email: "inbox", address: "pin" };

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
}

function formatShortDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

const TONE_COLOR = {
  positive: "#15803d",
  caution: "var(--color-caution,#b64400)",
  critical: "#b42318",
  neutral: "var(--color-graphite,#707070)",
};

function InfoTile({ label, value }) {
  return (
    <div className="dsp-profile-info-tile">
      <div className="dsp-profile-info-label">{label}</div>
      <div className="dsp-profile-info-value">{value || "—"}</div>
    </div>
  );
}

function TabBar({ options, value, counts, onChange }) {
  return (
    <div className="dsp-profile-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        const count = counts[option.key];
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dsp-profile-tab ${active ? "is-active" : ""}`}
          >
            {option.label}
            {count != null ? <span className="dsp-profile-tab-count">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function DetailRow({ icon, label, value, flagMissing = false }) {
  const missing = flagMissing && isDetailMissing(value);
  return (
    <div className={`dsp-profile-row ${missing ? "is-missing-detail" : ""}`}>
      <span className="dsp-profile-row-icon">
        <DashboardIcon name={icon} size={14} strokeWidth={1.8} />
      </span>
      <span className="dsp-profile-row-label">{label}</span>
      <span className={`dsp-profile-row-value ${missing ? "missing-detail-value" : ""}`}>
        {missing ? "Not entered yet" : value || "—"}
      </span>
    </div>
  );
}

function MissingDetailsNotice({ fields, onFillIn }) {
  if (!fields.length) return null;
  const count = fields.length;
  return (
    <div className="dsp-profile-missing" role="status">
      <span className="dsp-profile-missing-icon">
        <DashboardIcon name="warning" size={15} strokeWidth={2} />
      </span>
      <div className="dsp-profile-missing-copy">
        <strong>
          {count} detail{count === 1 ? "" : "s"} not entered yet
        </strong>
        <span>
          {joinDetailLabels(fields)} {count === 1 ? "is" : "are"} missing from this dispatcher's record.
        </span>
      </div>
      <button type="button" className="dsp-profile-missing-btn" onClick={onFillIn}>
        Fill in
      </button>
    </div>
  );
}

function StatTile({ label, value, helper }) {
  return (
    <div className="dsp-profile-stat">
      <div className="dsp-profile-stat-label">{label}</div>
      <div className="dsp-profile-stat-value">{value}</div>
      {helper ? <div className="dsp-profile-stat-helper">{helper}</div> : null}
    </div>
  );
}

// A single ratio against a limit: the fill carries the band's colour over a
// lighter step of the same colour, and the band is always named with an icon
// so the colour never has to carry the meaning alone.
function HealthMeter({ score }) {
  const band = healthBand(score);
  if (!band) {
    return <div className="dsp-profile-muted">Not enough activity to score yet.</div>;
  }
  const color = TONE_COLOR[band.tone];
  return (
    <div className="dsp-profile-meter">
      <div className="dsp-profile-meter-head">
        <span className="dsp-profile-meter-value">
          {score}
          <span>/100</span>
        </span>
        <span className="dsp-profile-meter-band" style={{ color }}>
          <DashboardIcon name={band.icon} size={13} strokeWidth={2.2} />
          {band.label}
        </span>
      </div>
      <div
        className="dsp-profile-meter-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={`Health score ${score} out of 100, ${band.label}`}
        style={{ "--meter-color": color }}
      >
        <span style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function Signal({ tone, icon, children }) {
  return (
    <div className={`dsp-profile-signal is-${tone}`}>
      <DashboardIcon name={icon} size={14} strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

function MoreMenu({ open, onToggle, onClose, canToggleActive, isActive, canResendSetup, busy, onToggleActive, onResendSetup, onRefresh }) {
  return (
    <div className="dsp-profile-more-wrap">
      <GhostButton icon="moreHorizontal" onClick={onToggle}>
        More
      </GhostButton>
      {open ? (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={onClose} />
          <div className="dsp-profile-more-menu dash-modal-surface-in">
            {canToggleActive ? (
              <button type="button" disabled={busy} onClick={onToggleActive}>
                {isActive ? "Suspend dispatcher" : "Activate dispatcher"}
              </button>
            ) : null}
            {canResendSetup ? (
              <button type="button" disabled={busy} onClick={onResendSetup}>
                Resend setup link
              </button>
            ) : null}
            <button type="button" onClick={onRefresh}>
              Refresh data
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AdminDispatcherProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileAdmin();
  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dispatchers\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState("overview");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeConfirmOpen, setActiveConfirmOpen] = useState(false);
  const [activeConfirmation, setActiveConfirmation] = useState("");

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  // The endpoint answers { ok, item } - every sibling page unwraps `.item`.
  const dispatcher = dispatcherQuery.data?.item || null;
  const analyticsQuery = useGetAdminDispatcherAnalyticsQuery(dispatcherId, { skip: !dispatcherId });
  const [resendSetupEmail] = useResendDispatcherSetupEmailMutation();
  const [setDispatcherActive] = useSetAdminDispatcherActiveMutation();
  const [updateDispatcher] = useUpdateAdminDispatcherMutation();

  const loading = dispatcherQuery.isLoading && !dispatcher;
  const pageError = error || (dispatcherQuery.error ? getQueryErrorMessage(dispatcherQuery.error, "Failed to load dispatcher.") : "");
  const analytics = analyticsQuery.data || null;
  const missingDetails = useMemo(() => missingDispatcherDetails(dispatcher), [dispatcher]);

  if (isMobile) {
    return (
      <AdminDispatcherProfileMobileView
        dispatcher={dispatcher}
        replenishment={analytics?.replenishment || {}}
        network={analytics?.network || {}}
        stock={analytics?.stock || {}}
        commercial={analytics?.commercial || {}}
        assignedDealers={dispatcher?.assignedDealers || []}
        loading={loading}
        loadError={pageError}
        onBack={() => navigate("/admin/dashboard/dispatchers")}
        onOpenDealer={(dealer) => navigate(`/admin/dashboard/dealers/${dealer._id}`)}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Surface key={index} padding={20}>
            <div style={{ height: 110, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          </Surface>
        ))}
      </div>
    );
  }

  if (!dispatcher) {
    return (
      <Surface padding={26}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>Dispatcher not found</div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {pageError || "The requested dispatcher profile could not be loaded."}
        </div>
        <div style={{ marginTop: 16 }}>
          <GhostButton onClick={() => navigate("/admin/dashboard/dispatchers")}>Back to Dispatchers</GhostButton>
        </div>
      </Surface>
    );
  }

  const summary = dispatcher.operationalSummary || {};
  const assignedDealers = dispatcher.assignedDealers || [];
  const accessState = dispatcher.accessState || {};
  const replenishment = analytics?.replenishment || {};
  const network = analytics?.network || {};
  const commercial = analytics?.commercial || {};
  const state = dispatcherStateLabel(dispatcher);
  const displayName = dispatcher.name || dispatcher.companyName || "Dispatcher";
  const canToggleActive = dispatcher.status === "VERIFIED" && !dispatcher.deletion?.pending;
  const signals = [
    ...(commercial.riskFlags || []).map((text) => ({ tone: "critical", icon: "warning", text })),
    ...(commercial.opportunityTags || []).map((text) => ({ tone: "positive", icon: "trend", text })),
    ...(commercial.recommendations || []).map((text) => ({ tone: "neutral", icon: "info", text })),
  ];

  async function runAction(key, request, message) {
    try {
      setBusy(key);
      setError("");
      setSuccess("");
      await request();
      if (message) setSuccess(message);
      return true;
    } catch (err) {
      setError(getQueryErrorMessage(err, "Action could not be completed."));
      return false;
    } finally {
      setBusy("");
    }
  }

  function handleResendSetup() {
    if (!accessState.userId) return;
    runAction("setup", () => resendSetupEmail(accessState.userId).unwrap(), "A fresh password setup link has been sent if eligible.");
  }

  async function handleToggleActive() {
    const next = !dispatcher.isActive;
    const ok = await runAction(
      "active",
      () => setDispatcherActive({ dispatcherId: dispatcher._id, isActive: next }).unwrap(),
      next ? "Dispatcher activated." : "Dispatcher suspended.",
    );
    if (ok) {
      setActiveConfirmOpen(false);
      setActiveConfirmation("");
    }
  }

  async function handleSaveEdit(payload) {
    const ok = await runAction("edit", () => updateDispatcher({ dispatcherId: dispatcher._id, payload }).unwrap(), "Dispatcher profile updated.");
    if (ok) setEditOpen(false);
  }

  function openTab(key) {
    if (key === "sales") {
      navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases`, { state: { fromDispatcherProfile: true } });
      return;
    }
    if (key === "orders") {
      navigate(`/admin/dashboard/dispatchers/${dispatcherId}/orders`);
      return;
    }
    setActiveTab(key);
  }

  return (
    <div className="dsp-profile" style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <div className="dsp-profile-breadcrumb">
        <button type="button" className="dsp-profile-back-btn" onClick={() => navigate("/admin/dashboard/dispatchers")} aria-label="Back to dispatchers">
          <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" className="dsp-profile-crumb-link" onClick={() => navigate("/admin/dashboard/dispatchers")}>
          Dispatchers
        </button>
        <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
        <span className="dsp-profile-crumb-current">Dispatcher Profile</span>
        <div style={{ flex: 1 }} />
        <GhostButton icon="edit" onClick={() => setEditOpen(true)}>
          Edit Dispatcher
        </GhostButton>
        <MoreMenu
          open={moreOpen}
          onToggle={() => setMoreOpen((value) => !value)}
          onClose={() => setMoreOpen(false)}
          canToggleActive={canToggleActive}
          isActive={Boolean(dispatcher.isActive)}
          canResendSetup={Boolean(accessState.canResendSetup)}
          busy={Boolean(busy)}
          onToggleActive={() => {
            setMoreOpen(false);
            setActiveConfirmation("");
            setActiveConfirmOpen(true);
          }}
          onResendSetup={() => {
            setMoreOpen(false);
            handleResendSetup();
          }}
          onRefresh={() => {
            setMoreOpen(false);
            dispatcherQuery.refetch();
            analyticsQuery.refetch();
          }}
        />
      </div>

      <Surface padding={24} className="dash-fade-up dsp-profile-hero">
        <div className="dsp-profile-summary">
          <DispatcherHubMark label={displayName} />
          <div className="dsp-profile-summary-copy">
            <div className="dsp-profile-eyebrow">Dispatcher</div>
            <div className="dsp-profile-name">{displayName}</div>
            <div className="dsp-profile-status">
              <span className="dsp-profile-status-dot" style={{ background: TONE_COLOR[state.tone] }} aria-hidden="true" />
              <span style={{ color: TONE_COLOR[state.tone] }}>{state.label}</span>
              {dispatcher.companyName && dispatcher.companyName !== displayName ? (
                <span className="dsp-profile-status-company">· {dispatcher.companyName}</span>
              ) : null}
            </div>
          </div>

          <div className="dsp-profile-info-tiles">
            <InfoTile label="Dispatcher ID" value={dispatcherDisplayId(dispatcher)} />
            <InfoTile label="Dealers Served" value={String(summary.assignedDealerCount ?? assignedDealers.length)} />
            <InfoTile label="Joined On" value={formatDate(dispatcher.createdAt)} />
          </div>
        </div>
      </Surface>

      {pageError ? <div className="dsp-profile-banner is-error">{pageError}</div> : null}
      {success ? <div className="dsp-profile-banner is-success">{success}</div> : null}

      <TabBar
        options={TAB_OPTIONS}
        value={activeTab}
        counts={{ dealers: assignedDealers.length }}
        onChange={openTab}
      />

      {activeTab === "overview" ? (
        <div className="dsp-profile-overview">
          <div className="dsp-profile-col">
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="user" title="Contact Information" />
              <MissingDetailsNotice fields={missingDetails} onFillIn={() => setEditOpen(true)} />
              <div style={{ marginTop: 12 }}>
                {DISPATCHER_DETAIL_FIELDS.map((field) => (
                  <DetailRow key={field.key} icon={DETAIL_ICONS[field.key]} label={field.label} value={dispatcher[field.key]} flagMissing />
                ))}
                {dispatcher.notes ? <DetailRow icon="edit" label="Internal Notes" value={dispatcher.notes} /> : null}
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader
                icon="shield"
                title="Account Access"
                action={
                  accessState.canResendSetup ? (
                    <GhostButton onClick={handleResendSetup} disabled={busy === "setup"}>
                      {busy === "setup" ? "Sending…" : "Resend Setup Link"}
                    </GhostButton>
                  ) : null
                }
              />
              <div style={{ marginTop: 12 }}>
                <DetailRow icon="user" label="Account Status" value={accessState.accountStatus} />
                <DetailRow
                  icon="lock"
                  label="Password"
                  value={accessState.passwordSet ? `Set${accessState.passwordSetAt ? ` on ${formatShortDate(accessState.passwordSetAt)}` : ""}` : "Not set yet"}
                />
                <DetailRow icon="inbox" label="Invitation Sent" value={formatShortDate(accessState.invitationLastSentAt) || "—"} />
                <DetailRow icon="calendar" label="Invitation Expires" value={formatShortDate(accessState.invitationExpiresAt) || "—"} />
              </div>
            </Surface>
          </div>

          <div className="dsp-profile-col">
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="package" title="Workload" subtitle="Orders from the dealers this dispatcher serves." />
              <div className="dsp-profile-stats">
                <StatTile
                  label="Assigned Dealers"
                  value={(summary.assignedDealerCount || 0).toLocaleString()}
                  helper={`${summary.activeAssignedDealerCount || 0} active`}
                />
                <StatTile label="Pending Orders" value={(summary.pendingOrders || 0).toLocaleString()} helper="Waiting for review" />
                <StatTile
                  label="Handled Orders"
                  value={`${summary.verifiedOrders || 0} / ${summary.rejectedOrders || 0}`}
                  helper="Verified / rejected"
                />
                <StatTile label="Verified Sales" value={money(summary.totalVerifiedSales)} helper="Through this dispatcher" />
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="chart" title="Network Health" subtitle="Replenishment, dealer activity, rejections and stock, in one score." />
              <div style={{ marginTop: 16 }}>
                <HealthMeter score={commercial.businessHealthScore ?? null} />
              </div>
              <div style={{ marginTop: 14 }}>
                <DetailRow
                  icon="truck"
                  label="Replenishment Orders"
                  value={`${replenishment.totalOrders || 0} · ${
                    replenishment.daysSinceLastReplenishment != null
                      ? `last ${replenishment.daysSinceLastReplenishment}d ago`
                      : "none yet"
                  }`}
                />
                <DetailRow
                  icon="invoice"
                  label="Replenishment Spend"
                  value={`${money(replenishment.totalSpend)} · ${replenishment.revenueGrowth30d >= 0 ? "+" : ""}${Number(
                    replenishment.revenueGrowth30d || 0,
                  ).toFixed(1)}% vs prior 30 days`}
                />
                <DetailRow
                  icon="reject"
                  label="Dealer Rejection Rate"
                  value={`${Number(network.networkRejectionRate || 0).toFixed(1)}% · ${network.activeDealerCount || 0} of ${
                    network.assignedDealerCount || 0
                  } dealers active`}
                />
              </div>
              {signals.length ? (
                <div className="dsp-profile-signals">
                  {signals.map((signal, index) => (
                    <Signal key={`${signal.tone}-${index}`} tone={signal.tone} icon={signal.icon}>
                      {signal.text}
                    </Signal>
                  ))}
                </div>
              ) : null}
            </Surface>
          </div>
        </div>
      ) : null}

      {activeTab === "dealers" ? (
        <Surface padding={0} className="dash-fade-up">
          <div className="dsp-profile-panel-head">
            <SectionHeader icon="store" title="Assigned Dealers" subtitle="Dealers whose orders this dispatcher reviews and fulfils." />
          </div>
          {assignedDealers.length ? (
            assignedDealers.map((dealer) => {
              const activity = dealer.activitySummary || {};
              return (
                <ListRow key={dealer._id} onClick={() => navigate(`/admin/dashboard/dealers/${dealer._id}`)}>
                  <Avatar label={dealer.companyName || dealer.contactName || "D"} size={34} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>{dealer.companyName || "Dealer"}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                      {dealer.contactName || "No contact"} · {activity.lastOrderAt ? `last order ${formatShortDate(activity.lastOrderAt)}` : "no orders yet"}
                    </div>
                  </div>
                  <Pill tone={dealer.status === "VERIFIED" ? "positive" : "critical"} size="small">
                    {dealer.status === "VERIFIED" ? "Active" : dealer.status || "—"}
                  </Pill>
                  <div style={{ flex: "0 0 auto", textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>{activity.pendingOrders || 0} pending</div>
                    <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                      {activity.verifiedOrders || 0} verified · {money(activity.totalVerifiedSales)}
                    </div>
                  </div>
                </ListRow>
              );
            })
          ) : (
            <div className="dsp-profile-empty">No dealers are assigned to this dispatcher yet.</div>
          )}
        </Surface>
      ) : null}

      <EditDispatcherModal
        key={editOpen ? `edit-${dispatcher._id}` : "closed"}
        open={editOpen}
        dispatcher={dispatcher}
        saving={busy === "edit"}
        onClose={() => {
          if (busy !== "edit") setEditOpen(false);
        }}
        onSave={handleSaveEdit}
      />

      <AdminDecisionModal
        open={activeConfirmOpen}
        title={dispatcher.isActive ? "Suspend dispatcher access?" : "Activate dispatcher access?"}
        subtitle={
          dispatcher.isActive
            ? "This blocks the dispatcher's portal and new activity. Their assigned dealers stay assigned."
            : "This restores the dispatcher's access to their portal."
        }
        tone={dispatcher.isActive ? "danger" : "default"}
        confirmLabel={dispatcher.isActive ? "Suspend Dispatcher" : "Activate Dispatcher"}
        busy={busy === "active"}
        details={[
          { label: "Dispatcher", value: displayName },
          { label: "Current state", value: state.label },
          { label: "Assigned dealers", value: String(assignedDealers.length) },
        ]}
        requireText={dispatcher.isActive ? displayName : ""}
        confirmationText={activeConfirmation}
        onConfirmationTextChange={setActiveConfirmation}
        onClose={() => {
          if (busy === "active") return;
          setActiveConfirmOpen(false);
          setActiveConfirmation("");
        }}
        onConfirm={handleToggleActive}
      />

      <style>{`
        .dsp-profile{
          --dsp-accent:#4a5a8a;
          --dsp-accent-soft:rgba(74,90,138,.1);
        }
        .dsp-profile-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dsp-profile-back-btn{
          width:32px;
          height:32px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:10px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s cubic-bezier(.23,1,.32,1);
        }
        .dsp-profile-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-back-btn:active{
          transform:scale(.92);
        }
        .dsp-profile-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font:inherit;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .dsp-profile-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-more-wrap{
          position:relative;
        }
        .dsp-profile-more-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:200px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .dsp-profile-more-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font:inherit;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .dsp-profile-more-menu button:hover:not(:disabled){
          background:var(--dsp-accent-soft);
        }
        .dsp-profile-more-menu button:disabled{
          opacity:.5;
          cursor:not-allowed;
        }

        .dsp-profile-summary{
          display:flex;
          align-items:center;
          gap:18px;
          flex-wrap:wrap;
        }
        .dsp-profile-summary-copy{
          min-width:0;
          flex:0 1 auto;
        }
        .dsp-profile-eyebrow{
          font-size:10.5px;
          font-weight:750;
          letter-spacing:.09em;
          text-transform:uppercase;
          color:var(--dsp-accent);
        }
        .dsp-profile-name{
          margin-top:2px;
          font-size:21px;
          font-weight:700;
          letter-spacing:-.02em;
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-status{
          margin-top:5px;
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:7px;
          font-size:13px;
          font-weight:650;
        }
        .dsp-profile-status-dot{
          width:7px;
          height:7px;
          border-radius:999px;
          flex:0 0 auto;
        }
        .dsp-profile-status-company{
          color:var(--color-graphite,#707070);
          font-weight:600;
        }
        .dsp-profile-info-tiles{
          margin-left:auto;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .dsp-profile-info-tile{
          min-width:126px;
          padding:10px 14px;
          border-radius:14px;
          background:var(--color-fog,#f5f5f7);
        }
        .dsp-profile-info-label{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite,#707070);
        }
        .dsp-profile-info-value{
          margin-top:3px;
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }

        .dsp-profile-banner{
          padding:12px 14px;
          border-radius:12px;
          font-size:13px;
          font-weight:600;
        }
        .dsp-profile-banner.is-error{
          background:rgba(180,35,24,.08);
          color:#b42318;
        }
        .dsp-profile-banner.is-success{
          background:rgba(22,163,74,.08);
          color:#15803d;
        }

        .dsp-profile-tabs{
          display:flex;
          align-items:center;
          gap:22px;
          border-bottom:1px solid rgba(29,29,31,.08);
          overflow-x:auto;
          scrollbar-width:none;
        }
        .dsp-profile-tabs::-webkit-scrollbar{
          display:none;
        }
        .dsp-profile-tab{
          flex:0 0 auto;
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:12px 2px 13px;
          border:none;
          background:transparent;
          border-bottom:2px solid transparent;
          margin-bottom:-1px;
          font:inherit;
          font-size:13.5px;
          font-weight:650;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          white-space:nowrap;
          transition:color .15s ease;
        }
        .dsp-profile-tab:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-tab.is-active{
          color:var(--color-ink,#1d1d1f);
          font-weight:700;
          border-bottom-color:var(--dsp-accent);
        }
        .dsp-profile-tab-count{
          min-width:18px;
          height:18px;
          padding:0 6px;
          border-radius:999px;
          display:inline-grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          font-size:11px;
          font-weight:700;
        }
        .dsp-profile-tab.is-active .dsp-profile-tab-count{
          background:var(--dsp-accent-soft);
          color:var(--dsp-accent);
        }

        .dsp-profile-overview{
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(0,1fr);
          gap:16px;
          align-items:start;
        }
        .dsp-profile-col{
          display:grid;
          gap:16px;
          align-content:start;
          min-width:0;
        }
        .dsp-profile-row{
          display:flex;
          align-items:center;
          gap:10px;
          padding:11px 0;
          border-top:1px solid rgba(0,0,0,.06);
        }
        .dsp-profile-row:first-child{
          border-top:none;
        }
        .dsp-profile-row-icon{
          width:26px;
          height:26px;
          flex:0 0 auto;
          border-radius:8px;
          display:grid;
          place-items:center;
          background:var(--dsp-accent-soft);
          color:var(--dsp-accent);
        }
        .dsp-profile-row.is-missing-detail .dsp-profile-row-icon{
          background:rgba(193,18,31,.1);
          color:var(--color-meitu-red,#c1121f);
        }
        .dsp-profile-row-label{
          flex:0 0 150px;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
        }
        .dsp-profile-row-value{
          flex:1 1 auto;
          min-width:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-ink,#1d1d1f);
          overflow-wrap:anywhere;
        }
        .dsp-profile-row-value.missing-detail-value{
          color:var(--color-meitu-red,#c1121f);
        }

        .dsp-profile-missing{
          margin-top:14px;
          display:flex;
          align-items:center;
          gap:12px;
          padding:12px 14px;
          border-radius:14px;
          background:rgba(193,18,31,.06);
          border:1px solid rgba(193,18,31,.16);
          animation:dashModalSurfaceIn .32s cubic-bezier(.23,1,.32,1) both;
        }
        .dsp-profile-missing-icon{
          width:30px;
          height:30px;
          flex:0 0 auto;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:rgba(193,18,31,.12);
          color:var(--color-meitu-red,#c1121f);
        }
        .dsp-profile-missing-copy{
          flex:1 1 auto;
          min-width:0;
          display:grid;
          gap:2px;
        }
        .dsp-profile-missing-copy strong{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-meitu-red,#c1121f);
        }
        .dsp-profile-missing-copy span{
          font-size:12.5px;
          font-weight:500;
          line-height:1.4;
          color:var(--color-slate,#474747);
        }
        .dsp-profile-missing-btn{
          flex:0 0 auto;
          height:32px;
          padding:0 14px;
          border:0;
          border-radius:999px;
          background:var(--color-meitu-red,#c1121f);
          color:#fff;
          font:inherit;
          font-size:12.5px;
          font-weight:700;
          cursor:pointer;
          transition:transform .16s cubic-bezier(.23,1,.32,1), filter .16s ease;
        }
        .dsp-profile-missing-btn:hover{
          filter:brightness(1.08);
        }
        .dsp-profile-missing-btn:active{
          transform:scale(.97);
        }

        .dsp-profile-stats{
          margin-top:16px;
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:10px;
        }
        .dsp-profile-stat{
          padding:14px 16px;
          border-radius:14px;
          background:var(--color-fog,#f5f5f7);
          min-width:0;
        }
        .dsp-profile-stat-label{
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite,#707070);
        }
        .dsp-profile-stat-value{
          margin-top:6px;
          font-size:22px;
          font-weight:700;
          letter-spacing:-.02em;
          color:var(--color-ink,#1d1d1f);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dsp-profile-stat-helper{
          margin-top:3px;
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }

        .dsp-profile-meter-head{
          display:flex;
          align-items:baseline;
          justify-content:space-between;
          gap:12px;
        }
        .dsp-profile-meter-value{
          font-size:30px;
          font-weight:700;
          letter-spacing:-.03em;
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-meter-value span{
          margin-left:2px;
          font-size:14px;
          font-weight:600;
          letter-spacing:0;
          color:var(--color-graphite,#707070);
        }
        .dsp-profile-meter-band{
          display:inline-flex;
          align-items:center;
          gap:5px;
          font-size:12.5px;
          font-weight:700;
        }
        .dsp-profile-meter-track{
          position:relative;
          margin-top:10px;
          height:8px;
          border-radius:999px;
          overflow:hidden;
          background:rgba(29,29,31,.07);
          background:color-mix(in srgb, var(--meter-color) 16%, transparent);
        }
        .dsp-profile-meter-track span{
          position:absolute;
          inset:0 auto 0 0;
          border-radius:999px;
          background:var(--meter-color);
          transform-origin:left center;
          animation:dspMeterFill .7s cubic-bezier(.23,1,.32,1) .1s both;
        }
        @keyframes dspMeterFill{
          from{ transform:scaleX(0); }
          to{ transform:scaleX(1); }
        }
        .dsp-profile-muted{
          font-size:13px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }

        .dsp-profile-signals{
          margin-top:14px;
          display:grid;
          gap:8px;
        }
        .dsp-profile-signal{
          display:flex;
          align-items:flex-start;
          gap:9px;
          padding:11px 13px;
          border-radius:12px;
          font-size:12.5px;
          font-weight:550;
          line-height:1.45;
          color:var(--color-ink,#1d1d1f);
        }
        .dsp-profile-signal svg{
          flex:0 0 auto;
          margin-top:1px;
        }
        .dsp-profile-signal.is-critical{
          background:rgba(180,35,24,.06);
        }
        .dsp-profile-signal.is-critical svg{
          color:#b42318;
        }
        .dsp-profile-signal.is-positive{
          background:rgba(22,163,74,.06);
        }
        .dsp-profile-signal.is-positive svg{
          color:#15803d;
        }
        .dsp-profile-signal.is-neutral{
          background:var(--color-fog,#f5f5f7);
        }
        .dsp-profile-signal.is-neutral svg{
          color:var(--color-graphite,#707070);
        }

        .dsp-profile-panel-head{
          padding:20px 22px 18px;
          border-bottom:1px solid rgba(0,0,0,.06);
        }
        .dsp-profile-empty{
          padding:22px;
          font-size:13px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }

        @media (max-width:1100px){
          .dsp-profile-overview{
            grid-template-columns:minmax(0,1fr);
          }
        }
        @media (max-width:980px){
          .dsp-profile-info-tiles{
            margin-left:0;
          }
        }
        @media (max-width:640px){
          .dsp-profile-stats{
            grid-template-columns:minmax(0,1fr);
          }
          .dsp-profile-row-label{
            flex-basis:112px;
          }
          .dsp-profile-missing{
            flex-wrap:wrap;
          }
          .dsp-profile-missing-btn{
            margin-left:42px;
          }
        }
        @media (prefers-reduced-motion: reduce){
          .dsp-profile-back-btn,
          .dsp-profile-tab,
          .dsp-profile-missing-btn{
            transition:none!important;
          }
          .dsp-profile-missing,
          .dsp-profile-meter-track span{
            animation:none!important;
          }
        }
      `}</style>
    </div>
  );
}
