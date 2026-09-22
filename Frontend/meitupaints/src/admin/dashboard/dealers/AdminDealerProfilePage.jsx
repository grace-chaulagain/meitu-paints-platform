import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useDeleteAdminDealerMutation,
  useGetAdminDealerAnalyticsQuery,
  useGetAdminDealerQuery,
  useGetAdminScopedOrdersQuery,
  useGetVerifiedDispatchersQuery,
  useResendDealerSetupEmailMutation,
  useUpdateAdminDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useUpdateAdminDealerStatusMutation,
} from "../../../redux/api/meituApi.js";
import { useIsMobileAdmin } from "../../mobile/useIsMobileAdmin.js";
import { AdminDealerProfileMobileView } from "../../mobile/AdminDealerProfileMobileView.jsx";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { isDetailMissing, joinDetailLabels, missingDealerDetails } from "./dealerMissingDetails.js";

// Credit limits/terms were removed entirely (2026) - dealer payments are
// reconciled manually outside this system, so there is no "credit status"
// or "outstanding balance" concept left to show here. Don't reintroduce a
// credit UI without a real ledger backing it.

const ROUTING_MODES = [
  { key: "FACTORY", label: "Factory" },
  { key: "DISPATCHER", label: "Dispatcher" },
];

const TAB_OPTIONS = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "notes", label: "Notes" },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
}

// No dealer-number sequence exists in the data model - this is a stable,
// honest display transform of the real Mongo id, not a fabricated field.
function dealerDisplayId(dealer) {
  const id = String(dealer?._id || "");
  return id ? `DLR-${id.slice(-6).toUpperCase()}` : "—";
}

// There's no dedicated "route"/"territory" field on a dealer, only a
// free-text address - the first comma-separated segment (usually the city)
// stands in for it, same convention used on the dealer grid cards.
function dealerLocation(dealer) {
  const address = String(dealer?.address || "").trim();
  if (!address) return "No address on file";
  return address.split(",")[0].trim();
}

function getDealerFormValues(currentDealer = {}) {
  return {
    companyName: currentDealer.companyName || "",
    contactName: currentDealer.contactName || "",
    email: currentDealer.email || "",
    phone: currentDealer.phone || "",
    address: currentDealer.address || "",
    panVat: currentDealer.panVat || "",
  };
}

function getMutationErrorMessage(err, fallback = "Action failed.") {
  return (
    err?.data?.error ||
    err?.data?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function fieldInputStyle(disabled = false) {
  return {
    width: "100%",
    height: 38,
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: "0 12px",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
    opacity: disabled ? 0.55 : 1,
  };
}

// A company detail that's still empty carries the same red as the profile's
// "Not entered yet" rows, and loses it the moment something is typed.
function detailInputStyle(value) {
  const style = fieldInputStyle();
  if (!isDetailMissing(value)) return style;
  return { ...style, background: "rgba(193,18,31,.05)", boxShadow: "inset 0 0 0 1.5px rgba(193,18,31,.45)" };
}

function fieldTextareaStyle() {
  return {
    ...fieldInputStyle(),
    height: "auto",
    padding: 12,
    resize: "vertical",
  };
}

function ErrorBanner({ children }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function SuccessBanner({ children }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(22,163,74,.08)", color: "#15803d", fontSize: 13, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Surface key={index} padding={20}>
          <div style={{ height: 120, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ))}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="dealer-profile-info-tile">
      <div className="dealer-profile-info-label">{label}</div>
      <div className="dealer-profile-info-value">{value || "—"}</div>
    </div>
  );
}

function CompanyInfoRow({ icon, label, value }) {
  const missing = isDetailMissing(value);
  return (
    <div className={`dealer-profile-row ${missing ? "is-missing-detail" : ""}`}>
      <span className="dealer-profile-row-icon">
        <DashboardIcon name={icon} size={14} strokeWidth={1.8} />
      </span>
      <span className="dealer-profile-row-label">{label}</span>
      <span className={`dealer-profile-row-value ${missing ? "missing-detail-value" : ""}`}>
        {missing ? "Not entered yet" : value}
      </span>
    </div>
  );
}

function MissingDetailsNotice({ fields, onFillIn }) {
  if (!fields.length) return null;
  const count = fields.length;
  return (
    <div className="dealer-profile-missing" role="status">
      <span className="dealer-profile-missing-icon">
        <DashboardIcon name="warning" size={15} strokeWidth={2} />
      </span>
      <div className="dealer-profile-missing-copy">
        <strong>
          {count} detail{count === 1 ? "" : "s"} not entered yet
        </strong>
        <span>{joinDetailLabels(fields)} {count === 1 ? "is" : "are"} missing from this dealer's record.</span>
      </div>
      {onFillIn ? (
        <button type="button" className="dealer-profile-missing-btn" onClick={onFillIn}>
          Fill in
        </button>
      ) : null}
    </div>
  );
}

function TabBar({ options, value, onChange }) {
  return (
    <div className="dealer-profile-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dealer-profile-tab ${active ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MoreMenu({ open, onToggle, onClose, isVerified, canResendSetup, deletionPending, busy, onToggleStatus, onChangeRouting, onResendSetup, onScheduleDeletion }) {
  return (
    <div className="dealer-profile-more-wrap">
      <GhostButton icon="moreHorizontal" onClick={onToggle}>
        More
      </GhostButton>
      {open ? (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={onClose} />
          <div className="dealer-profile-more-menu dash-modal-surface-in">
            <button type="button" disabled={busy} onClick={onToggleStatus}>
              {isVerified ? "Suspend dealer" : "Activate dealer"}
            </button>
            <button type="button" onClick={onChangeRouting}>
              Change routing
            </button>
            {canResendSetup ? (
              <button type="button" disabled={busy} onClick={onResendSetup}>
                Resend setup link
              </button>
            ) : null}
            <div className="dealer-profile-more-divider" />
            <button type="button" className="danger" disabled={busy || deletionPending} onClick={onScheduleDeletion}>
              {deletionPending ? "Deletion pending" : "Move to trash"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RoutingModal({ open, dealer, dispatchers, saving, onClose, onSave }) {
  const initialDispatcherId = dealer?.dispatcherId?._id || dealer?.dispatcherId || "";
  const [fulfillmentMode, setFulfillmentMode] = useState(dealer?.fulfillmentMode || "FACTORY");
  const [dispatcherId, setDispatcherId] = useState(initialDispatcherId);

  if (!open || !dealer) return null;

  const canSave = fulfillmentMode === "FACTORY" || (fulfillmentMode === "DISPATCHER" && dispatcherId);
  const dispatcherOptions = dispatchers.map((dispatcher) => ({
    key: dispatcher._id,
    label: dispatcher.companyName ? `${dispatcher.name} · ${dispatcher.companyName}` : dispatcher.name,
  }));

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 28,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(520px, 100%)" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <SectionHeader
          eyebrow="Routing"
          icon="truck"
          title="Dealer Routing"
          subtitle={`Update fulfillment for ${dealer.companyName || "this dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          }
        />

        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
          <Field label="Fulfillment Mode">
            <SegmentedControl options={ROUTING_MODES} value={fulfillmentMode} onChange={setFulfillmentMode} />
          </Field>

          {fulfillmentMode === "DISPATCHER" ? (
            <Field label="Assigned Dispatcher">
              <AppleDropdown value={dispatcherId} options={dispatcherOptions} onChange={setDispatcherId} placeholder="Select dispatcher" />
              {dispatchers.length === 0 ? (
                <ErrorBanner>No verified dispatchers are currently available. Verify a dispatcher first.</ErrorBanner>
              ) : null}
            </Field>
          ) : null}
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            icon="checkmark"
            disabled={!canSave || saving}
            onClick={() =>
              onSave({
                fulfillmentMode,
                dispatcherId: fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
              })
            }
          >
            {saving ? "Saving…" : "Save Routing"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function EditDealerModal({ open, dealer, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => getDealerFormValues(dealer));

  useEffect(() => {
    if (open) setForm(getDealerFormValues(dealer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealer?._id]);

  if (!open || !dealer) return null;

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 28,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        <SectionHeader
          eyebrow="Edit"
          icon="edit"
          title="Edit Dealer"
          subtitle={`Update contact and registration details for ${dealer.companyName || "this dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
          <Field label="Company Name">
            <input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} style={detailInputStyle(form.companyName)} />
          </Field>
          <Field label="Contact Person">
            <input value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} style={detailInputStyle(form.contactName)} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} style={detailInputStyle(form.email)} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} style={detailInputStyle(form.phone)} />
          </Field>
          <Field label="Address">
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} style={detailInputStyle(form.address)} />
          </Field>
          <Field label="PAN / VAT Number">
            <input value={form.panVat} onChange={(e) => updateField("panVat", e.target.value)} style={detailInputStyle(form.panVat)} />
          </Field>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton icon="checkmark" onClick={() => onSave(form)} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

export default function AdminDealerProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileAdmin();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dealers\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  // If we arrived here by clicking a row in the list, go back via browser
  // history so the list's exact filters (preserved in its URL) and scroll
  // position (restored by DashboardShell's pathname-keyed scroll cache) come
  // back, instead of a fresh default list.
  const goBackToDealers = () => {
    if (location.state?.fromDealersList) {
      navigate(-1);
    } else {
      navigate("/admin/dashboard/dealers");
    }
  };

  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDealerId, setNotesDealerId] = useState("");

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const analyticsQuery = useGetAdminDealerAnalyticsQuery(dealerId, { skip: !dealerId });
  // Only the phone layout lists recent orders; the desktop profile has no
  // orders view, so it doesn't fetch them.
  const ordersQuery = useGetAdminScopedOrdersQuery({ dealerId, limit: 5 }, { skip: !dealerId || !isMobile });
  const [updateDealer] = useUpdateAdminDealerMutation();
  const [deleteAdminDealer] = useDeleteAdminDealerMutation();
  const [updateDealerStatus] = useUpdateAdminDealerStatusMutation();
  const [updateDealerRouting] = useUpdateAdminDealerRoutingMutation();
  const [resendDealerSetupEmail] = useResendDealerSetupEmailMutation();

  const dealer = dealerQuery.data?.item || null;
  const missingDetails = useMemo(() => missingDealerDetails(dealer), [dealer]);
  const dispatchers = dispatchersQuery.data?.items || [];
  const analytics = analyticsQuery.data || null;
  const recentOrders = useMemo(() => {
    const scoped = (ordersQuery.data?.items || []).filter((order) => {
      const directDealerId = String(order?.dealerId?._id || order?.dealerId || "");
      const snapshotDealerId = String(order?.dealerSnapshot?._id || "");
      return directDealerId === dealerId || snapshotDealerId === dealerId;
    });

    return scoped
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [ordersQuery.data, dealerId]);
  const loading = !dealer && (dealerQuery.isLoading || dispatchersQuery.isLoading || analyticsQuery.isLoading);
  const loadError = dealerQuery.error?.message || dispatchersQuery.error?.message || analyticsQuery.error?.message || "";

  useEffect(() => {
    if (!dealer?._id || notesDealerId === dealer._id) return;
    setNotes(dealer.notes || "");
    setNotesDealerId(dealer._id);
  }, [dealer, notesDealerId]);

  const performanceSummary = analytics?.performanceSummary || {};
  const productIntelligence = analytics?.productIntelligence || {};
  const accessState = dealer?.accessState || {};
  const isVerified = dealer?.status === "VERIFIED";
  const assignedDispatcher = dealer?.dispatcherId && typeof dealer.dispatcherId === "object" ? dealer.dispatcherId : null;

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setError("");
      setSuccess("");
      await request();
      return true;
    } catch (err) {
      setError(getMutationErrorMessage(err));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveProfile(form) {
    if (!dealer?._id) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateDealer({
        dealerId: dealer._id,
        payload: {
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          panVat: form.panVat.trim(),
        },
      }).unwrap();

      setEditOpen(false);
      setSuccess("Dealer profile updated.");
    } catch (err) {
      setError(getMutationErrorMessage(err, "Failed to update dealer profile."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!dealer?._id) return;
    const ok = await runAction(`notes-${dealer._id}`, () =>
      updateDealer({ dealerId: dealer._id, payload: { notes: notes.trim() } }).unwrap(),
    );
    if (ok) setSuccess("Notes updated.");
  }

  async function handleToggleStatus() {
    if (!dealer?._id) return;
    const nextStatus = dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED";

    const ok = await runAction(`status-${dealer._id}`, () =>
      updateDealerStatus({ dealerId: dealer._id, status: nextStatus }).unwrap(),
    );

    if (ok) {
      setSuccess(`Dealer status updated to ${nextStatus}.`);
      setStatusConfirmOpen(false);
      setStatusConfirmation("");
    }
  }

  async function handleDeleteDealer() {
    if (!dealer?._id) return;

    const ok = await runAction(`delete-${dealer._id}`, () =>
      deleteAdminDealer({
        dealerId: dealer._id,
        payload: { confirmation: deleteConfirmation, reason: "Admin scheduled dealer deletion from dealer profile" },
      }).unwrap(),
    );

    if (ok) {
      setDeleteConfirmOpen(false);
      setDeleteConfirmation("");
      goBackToDealers();
    }
  }

  async function handleSaveRouting({ fulfillmentMode, dispatcherId }) {
    if (!dealer?._id) return;

    const ok = await runAction(`routing-${dealer._id}`, () =>
      updateDealerRouting({ dealerId: dealer._id, payload: { fulfillmentMode, dispatcherId } }).unwrap(),
    );

    if (ok) {
      setRoutingOpen(false);
      setSuccess("Dealer routing updated.");
    }
  }

  function handleResendSetup() {
    const userId = accessState.userId;
    if (!userId || !dealer?._id) return;

    runAction(`setup-${dealer._id}`, () => resendDealerSetupEmail(userId).unwrap()).then((ok) => {
      if (ok) setSuccess("A fresh password setup link has been sent.");
    });
  }

  function openOrder(order) {
    navigate(`/admin/dashboard/orders/${order._id}`, { state: { fromOrdersList: true } });
  }

  if (isMobile) {
    return (
      <AdminDealerProfileMobileView
        dealer={dealer}
        dispatchers={dispatchers}
        performanceSummary={performanceSummary}
        productIntelligence={productIntelligence}
        recentOrders={recentOrders}
        loading={loading}
        loadError={loadError}
        onBack={goBackToDealers}
        busyAction={busyAction}
        error={error}
        onToggleStatus={handleToggleStatus}
        onSaveRouting={handleSaveRouting}
        onOpenOrder={openOrder}
      />
    );
  }

  if (loading) return <LoadingState />;

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <EmptyState icon="store" title="Dealer not found" subtitle="This dealer profile could not be located in the admin register." />
        <div>
          <GhostButton onClick={goBackToDealers}>Back to Dealer Register</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <div className="dealer-profile-breadcrumb">
        <button type="button" className="dealer-profile-back-btn" onClick={goBackToDealers} aria-label="Back to dealers">
          <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" className="dealer-profile-crumb-link" onClick={goBackToDealers}>
          Dealers
        </button>
        <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
        <span className="dealer-profile-crumb-current">Dealer Profile</span>
        <div style={{ flex: 1 }} />
        <GhostButton icon="edit" onClick={() => setEditOpen(true)}>
          Edit Dealer
        </GhostButton>
        <MoreMenu
          open={moreOpen}
          onToggle={() => setMoreOpen((v) => !v)}
          onClose={() => setMoreOpen(false)}
          isVerified={isVerified}
          canResendSetup={accessState.canResendSetup}
          deletionPending={Boolean(dealer.deletion?.pending)}
          busy={Boolean(busyAction)}
          onToggleStatus={() => {
            setMoreOpen(false);
            setStatusConfirmation("");
            setStatusConfirmOpen(true);
          }}
          onChangeRouting={() => {
            setMoreOpen(false);
            setRoutingOpen(true);
          }}
          onResendSetup={() => {
            setMoreOpen(false);
            handleResendSetup();
          }}
          onScheduleDeletion={() => {
            setMoreOpen(false);
            setDeleteConfirmation("");
            setDeleteConfirmOpen(true);
          }}
        />
      </div>

      <Surface padding={24} className="dash-fade-up">
        <div className="dealer-profile-summary">
          <Avatar label={dealer.companyName || dealer.contactName || "D"} size={56} />
          <div className="dealer-profile-summary-copy">
            <div className="dealer-profile-name">{dealer.companyName || "Dealer Profile"}</div>
            <div className="dealer-profile-status">
              <span className="dealer-profile-status-dot" style={{ background: isVerified ? "#15803d" : "#b42318" }} aria-hidden="true" />
              {isVerified ? "Active Dealer" : dealer.status === "SUSPENDED" ? "Suspended Dealer" : dealer.status || "Unknown"}
            </div>
          </div>

          <div className="dealer-profile-info-tiles">
            <InfoTile label="Dealer ID" value={dealerDisplayId(dealer)} />
            <InfoTile label="Route" value={dealerLocation(dealer)} />
            <InfoTile label="Joined On" value={formatDate(dealer.createdAt)} />
          </div>
        </div>
      </Surface>

      {error || loadError ? <ErrorBanner>{error || loadError}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}

      <TabBar
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={(key) => {
          if (key === "sales") {
            navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases`, { state: { fromDealerProfile: true } });
            return;
          }
          setActiveTab(key);
        }}
      />

      {activeTab === "overview" ? (
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Surface padding={22} className="dash-fade-up">
            <SectionHeader icon="user" title="Company Information" />
            <MissingDetailsNotice fields={missingDetails} onFillIn={() => setEditOpen(true)} />
            <div style={{ marginTop: 12 }}>
              <CompanyInfoRow icon="store" label="Company Name" value={dealer.companyName} />
              <CompanyInfoRow icon="user" label="Contact Person" value={dealer.contactName} />
              <CompanyInfoRow icon="headset" label="Phone" value={dealer.phone} />
              <CompanyInfoRow icon="inbox" label="Email" value={dealer.email} />
              <CompanyInfoRow icon="invoice" label="PAN/VAT Number" value={dealer.panVat} />
              <CompanyInfoRow icon="pin" label="Address" value={dealer.address} />
            </div>
          </Surface>

          <Surface padding={22} className="dash-fade-up">
            <SectionHeader icon="truck" title="Assigned Dispatcher" />
            {assignedDispatcher ? (
              <div className="dealer-profile-dispatcher">
                <Avatar label={assignedDispatcher.name || "D"} size={44} tone="accent" />
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{assignedDispatcher.name || "Dispatcher"}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Dispatcher</div>
                  <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
                    {assignedDispatcher.phone ? <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{assignedDispatcher.phone}</div> : null}
                    {assignedDispatcher.email ? <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{assignedDispatcher.email}</div> : null}
                  </div>
                </div>
                <GhostButton icon="user" onClick={() => navigate(`/admin/dashboard/dispatchers/${assignedDispatcher._id}`)}>
                  View Profile
                </GhostButton>
              </div>
            ) : (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-graphite,#707070)", maxWidth: 380 }}>
                  This dealer is fulfilled directly by the factory - no dispatcher is assigned.
                </div>
                <GhostButton icon="truck" onClick={() => setRoutingOpen(true)}>
                  Assign Dispatcher
                </GhostButton>
              </div>
            )}
          </Surface>
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <Surface padding={22} className="dash-fade-up" style={{ maxWidth: 720 }}>
          <SectionHeader icon="edit" title="Notes" subtitle="Internal notes about this dealer - not visible to the dealer." />
          <div style={{ marginTop: 16 }}>
            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this dealer…"
              style={fieldTextareaStyle()}
            />
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <PrimaryButton icon="checkmark" onClick={handleSaveNotes} disabled={busyAction === `notes-${dealer._id}`}>
              {busyAction === `notes-${dealer._id}` ? "Saving…" : "Save Notes"}
            </PrimaryButton>
          </div>
        </Surface>
      ) : null}

      <RoutingModal
        open={routingOpen}
        dealer={dealer}
        dispatchers={dispatchers}
        saving={busyAction === `routing-${dealer._id}`}
        onClose={() => {
          if (!busyAction) setRoutingOpen(false);
        }}
        onSave={handleSaveRouting}
      />

      <EditDealerModal
        open={editOpen}
        dealer={dealer}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveProfile}
      />

      <AdminDecisionModal
        open={statusConfirmOpen}
        title={dealer.status === "VERIFIED" ? "Suspend dealer access?" : "Activate dealer access?"}
        subtitle={
          dealer.status === "VERIFIED"
            ? "This suspends the dealer account, blocks new activity, and revokes active sessions for linked users."
            : "This restores linked dealer access and allows the dealer to use their portal again."
        }
        tone={dealer.status === "VERIFIED" ? "danger" : "default"}
        confirmLabel={dealer.status === "VERIFIED" ? "Suspend Dealer" : "Activate Dealer"}
        busy={busyAction === `status-${dealer._id}`}
        details={[
          { label: "Dealer", value: dealer.companyName || dealer.contactName || dealer.email || "Dealer" },
          { label: "Current status", value: dealer.status || "—" },
          { label: "New status", value: dealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED" },
        ]}
        requireText={dealer.status === "VERIFIED" ? dealer.companyName || dealer.contactName || dealer.email || String(dealer._id) : ""}
        confirmationText={statusConfirmation}
        onConfirmationTextChange={setStatusConfirmation}
        onClose={() => {
          if (busyAction === `status-${dealer._id}`) return;
          setStatusConfirmOpen(false);
          setStatusConfirmation("");
        }}
        onConfirm={handleToggleStatus}
      />

      <AdminDecisionModal
        open={deleteConfirmOpen}
        title="Move dealer to trash?"
        subtitle="This revokes dealer access and moves the profile to Settings Trash for the undo window before permanent deletion."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${dealer._id}`}
        details={[
          { label: "Dealer", value: dealer.companyName || dealer.contactName || dealer.email || "Dealer" },
          { label: "Contact", value: dealer.contactName || dealer.email || "—" },
          { label: "Undo Window", value: "30 days in Settings Trash" },
        ]}
        requireText={dealer.companyName || dealer.contactName || dealer.email || String(dealer._id)}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (busyAction === `delete-${dealer._id}`) return;
          setDeleteConfirmOpen(false);
          setDeleteConfirmation("");
        }}
        onConfirm={handleDeleteDealer}
      />

      <style>{`
        .dealer-profile-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-profile-back-btn{
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
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dealer-profile-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-back-btn:active{
          transform:scale(.92);
        }
        .dealer-profile-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .dealer-profile-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-more-wrap{
          position:relative;
        }
        .dealer-profile-more-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:190px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .dealer-profile-more-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .dealer-profile-more-menu button:hover:not(:disabled){
          background:rgba(0,113,227,.08);
        }
        .dealer-profile-more-menu button:disabled{
          opacity:.5;
          cursor:not-allowed;
        }
        .dealer-profile-more-menu button.danger{
          color:#b42318;
        }
        .dealer-profile-more-menu button.danger:hover:not(:disabled){
          background:rgba(180,35,24,.08);
        }
        .dealer-profile-more-divider{
          height:1px;
          margin:4px 2px;
          background:rgba(0,0,0,.06);
        }
        .dealer-profile-summary{
          display:flex;
          align-items:center;
          gap:18px;
          flex-wrap:wrap;
        }
        .dealer-profile-summary-copy{
          min-width:0;
          flex:0 1 auto;
        }
        .dealer-profile-name{
          font-size:21px;
          font-weight:700;
          letter-spacing:-.02em;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-status{
          margin-top:5px;
          display:inline-flex;
          align-items:center;
          gap:7px;
          font-size:13px;
          font-weight:650;
          color:#15803d;
        }
        .dealer-profile-status-dot{
          width:7px;
          height:7px;
          border-radius:999px;
          flex:0 0 auto;
        }
        .dealer-profile-info-tiles{
          margin-left:auto;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .dealer-profile-info-tile{
          min-width:126px;
          padding:10px 14px;
          border-radius:14px;
          background:var(--color-fog,#f5f5f7);
        }
        .dealer-profile-info-label{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-info-value{
          margin-top:3px;
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .dealer-profile-tabs{
          display:flex;
          align-items:center;
          gap:22px;
          border-bottom:1px solid rgba(29,29,31,.08);
          overflow-x:auto;
          scrollbar-width:none;
        }
        .dealer-profile-tabs::-webkit-scrollbar{
          display:none;
        }
        .dealer-profile-tab{
          flex:0 0 auto;
          padding:12px 2px 13px;
          border:none;
          background:transparent;
          border-bottom:2px solid transparent;
          margin-bottom:-1px;
          font-size:13.5px;
          font-weight:650;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          white-space:nowrap;
        }
        .dealer-profile-tab.is-active{
          color:var(--color-ink,#1d1d1f);
          font-weight:700;
          border-bottom-color:#dc2626;
        }
        .dealer-profile-row{
          display:flex;
          align-items:center;
          gap:10px;
          padding:11px 0;
          border-top:1px solid rgba(0,0,0,.06);
        }
        .dealer-profile-row:first-child{
          border-top:none;
        }
        .dealer-profile-row-icon{
          width:26px;
          height:26px;
          flex:0 0 auto;
          border-radius:8px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-row-label{
          flex:0 0 160px;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
        }
        .dealer-profile-row-value{
          flex:1 1 auto;
          min-width:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-ink,#1d1d1f);
          overflow-wrap:anywhere;
        }
        .dealer-profile-row-value.missing-detail-value{
          color:var(--color-meitu-red,#c1121f);
        }
        .dealer-profile-row.is-missing-detail .dealer-profile-row-icon{
          background:rgba(193,18,31,.1);
          color:var(--color-meitu-red,#c1121f);
        }
        .dealer-profile-missing{
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
        .dealer-profile-missing-icon{
          width:30px;
          height:30px;
          flex:0 0 auto;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:rgba(193,18,31,.12);
          color:var(--color-meitu-red,#c1121f);
        }
        .dealer-profile-missing-copy{
          flex:1 1 auto;
          min-width:0;
          display:grid;
          gap:2px;
        }
        .dealer-profile-missing-copy strong{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-meitu-red,#c1121f);
        }
        .dealer-profile-missing-copy span{
          font-size:12.5px;
          font-weight:500;
          line-height:1.4;
          color:var(--color-slate,#474747);
        }
        .dealer-profile-missing-btn{
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
        .dealer-profile-missing-btn:hover{
          filter:brightness(1.08);
        }
        .dealer-profile-missing-btn:active{
          transform:scale(.97);
        }
        @media (max-width:520px){
          .dealer-profile-missing{
            flex-wrap:wrap;
          }
          .dealer-profile-missing-btn{
            margin-left:42px;
          }
        }
        @media (prefers-reduced-motion: reduce){
          .dealer-profile-missing{
            animation:none;
          }
        }
        .dealer-profile-dispatcher{
          margin-top:14px;
          display:flex;
          align-items:center;
          gap:14px;
          flex-wrap:wrap;
        }
        @media (max-width:980px){
          .dealer-profile-info-tiles{
            margin-left:0;
          }
        }
        @media (max-width:640px){
          .dealer-profile-summary{
            flex-direction:column;
            align-items:flex-start;
          }
          .dealer-profile-info-tiles{
            width:100%;
          }
          .dealer-profile-info-tile{
            flex:1 1 auto;
          }
        }
      `}</style>
    </div>
  );
}
