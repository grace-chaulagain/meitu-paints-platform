import { useState } from "react";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import {
  useApproveDealerApplicationMutation,
  useDeleteDealerApplicationMutation,
  useGetAdminDealerApplicationQuery,
  useGetVerifiedDispatchersQuery,
  useRejectDealerApplicationMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";

function statusTone(status) {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED") return "critical";
  return "neutral";
}

function formatFullDateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 12px 0 8px",
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-ink, #1d1d1f)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
      Applications
    </button>
  );
}

function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--color-graphite, #707070)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".02em",
          textTransform: "uppercase",
          color: "var(--color-graphite, #707070)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          fontWeight: 500,
          color: "var(--color-ink, #1d1d1f)",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

const textAreaStyle = {
  width: "100%",
  borderRadius: 12,
  border: "none",
  background: "var(--color-fog, #f5f5f7)",
  padding: 12,
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
  resize: "vertical",
};

function RoutingChoice({ active, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 14,
        borderRadius: 14,
        border: "none",
        background: active ? "rgba(0,113,227,.08)" : "var(--color-fog, #f5f5f7)",
        cursor: "pointer",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
        {desc}
      </div>
    </button>
  );
}

function ApproveModal({ open, application, dispatchers, saving, onClose, onSave }) {
  const [fulfillmentMode, setFulfillmentMode] = useState("FACTORY");
  const [dispatcherId, setDispatcherId] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  if (!open || !application) return null;

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Surface
        className="dash-modal-surface-in"
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto" }}
        padding={22}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionHeader
          title="Verify Application"
          subtitle={`Configure onboarding for ${application.companyName || "this dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "var(--color-fog, #f5f5f7)",
                color: "var(--color-graphite, #707070)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <CardLabel icon="truck">Fulfillment Mode</CardLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <RoutingChoice
                active={fulfillmentMode === "FACTORY"}
                title="Factory"
                desc="Admin and factory workflow handle this dealer's orders directly."
                onClick={() => {
                  setFulfillmentMode("FACTORY");
                  setDispatcherId("");
                }}
              />
              <RoutingChoice
                active={fulfillmentMode === "DISPATCHER"}
                title="Dispatcher"
                desc="Assign this dealer to a dispatcher for routed order handling."
                onClick={() => setFulfillmentMode("DISPATCHER")}
              />
            </div>
          </div>

          {fulfillmentMode === "DISPATCHER" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <CardLabel icon="handshake">Assigned Dispatcher</CardLabel>
              <AppleDropdown
                value={dispatcherId}
                options={dispatcherOptions}
                onChange={setDispatcherId}
                placeholder="Select dispatcher"
              />
              {dispatchers.length === 0 ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(180,35,24,.08)",
                    color: "#b42318",
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  No verified dispatchers are currently available. Add or verify a dispatcher first.
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <CardLabel icon="edit">Review Note</CardLabel>
            <textarea
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Optional internal note for this approval…"
              style={textAreaStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
                reviewNote: reviewNote.trim(),
              })
            }
          >
            {saving ? "Verifying…" : "Verify Dealer"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

export default function AdminDealerApplicationDetailPage({ applicationId, onBack }) {
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const applicationQuery = useGetAdminDealerApplicationQuery(applicationId, { skip: !applicationId });
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const application = applicationQuery.data?.item || null;
  const dispatchers = dispatchersQuery.data?.items || [];

  const [approveDealerApplication] = useApproveDealerApplicationMutation();
  const [rejectDealerApplication] = useRejectDealerApplicationMutation();
  const [deleteDealerApplication] = useDeleteDealerApplicationMutation();

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Action failed."));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  const goBack = () => onBack?.();

  const handleApprove = async (payload) => {
    const success = await runAction(`approve-${application._id}`, () =>
      approveDealerApplication({ applicationId: application._id, payload }).unwrap(),
    );
    if (success) goBack();
  };

  const handleReject = async () => {
    const success = await runAction(`reject-${application._id}`, () =>
      rejectDealerApplication({
        applicationId: application._id,
        payload: { reviewNote: rejectNote.trim() },
      }).unwrap(),
    );
    if (success) goBack();
  };

  const handleDelete = async () => {
    const success = await runAction(`delete-${application._id}`, () =>
      deleteDealerApplication({
        applicationId: application._id,
        payload: {
          confirmation: deleteConfirmation,
          reason: "Admin moved dealer application to trash",
        },
      }).unwrap(),
    );
    if (success) goBack();
  };

  if (applicationQuery.isLoading && !application) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={20}>
          <div style={{ height: 20, width: 200, borderRadius: 8, background: "rgba(0,0,0,.06)" }} />
        </Surface>
        <Surface padding={18} style={{ minHeight: 220 }}>
          <div style={{ height: 180, borderRadius: 12, background: "rgba(0,0,0,.04)" }} />
        </Surface>
      </div>
    );
  }

  if (!applicationQuery.isLoading && !application) {
    return (
      <Surface padding={26} style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
          Application not found
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          It may have been moved to trash or the link is out of date.
        </div>
        <div style={{ marginTop: 16 }}>
          <BackButton onClick={goBack} />
        </div>
      </Surface>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <BackButton onClick={goBack} />
      </div>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Applications"
          icon="store"
          title={application.companyName || "Dealer Application"}
          subtitle={`Submitted ${formatFullDateTime(application.createdAt)}`}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {application.status === "PENDING" ? (
                <>
                  <PrimaryButton
                    icon="checkmark"
                    disabled={!application.emailConfirmed}
                    onClick={() => setApproving(true)}
                  >
                    Verify
                  </PrimaryButton>
                  <GhostButton
                    danger
                    icon="reject"
                    onClick={() => {
                      setRejecting(true);
                      setRejectNote("");
                    }}
                  >
                    Reject
                  </GhostButton>
                </>
              ) : null}
              <GhostButton
                danger
                icon="trash"
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setDeleteConfirmation("");
                }}
              >
                Delete
              </GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={statusTone(application.status)} size="small">
            {application.status || "PENDING"}
          </Pill>
          {application.status === "PENDING" && !application.emailConfirmed ? (
            <Pill tone="caution" size="small">
              Email not confirmed
            </Pill>
          ) : null}
        </div>

        {application.status === "PENDING" && !application.emailConfirmed ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
            Waiting for the applicant to confirm their email before this application can be verified.
          </div>
        ) : null}

        {actionError ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {actionError}
          </div>
        ) : null}
      </Surface>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(300px,.85fr)",
          gap: 16,
        }}
      >
        <Surface padding={18}>
          <CardLabel icon="user">Applicant</CardLabel>
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <DetailItem label="Company" value={application.companyName} />
            <DetailItem label="Contact" value={application.contactName} />
            <DetailItem label="Email" value={application.email} />
            <DetailItem label="Phone" value={application.phone} />
          </div>
        </Surface>

        <div style={{ display: "grid", gap: 16 }}>
          <Surface padding={18}>
            <CardLabel icon="invoice">Business Details</CardLabel>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <DetailItem label="PAN / VAT" value={application.panVat} />
              <DetailItem label="Address" value={application.address} />
            </div>
          </Surface>

          {application.notes || application.reviewNote ? (
            <Surface padding={18}>
              <CardLabel icon="edit">Notes</CardLabel>
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {application.notes ? (
                  <DetailItem label="Applicant Notes" value={application.notes} />
                ) : null}
                {application.reviewNote ? (
                  <DetailItem label="Review Note" value={application.reviewNote} />
                ) : null}
              </div>
            </Surface>
          ) : null}
        </div>
      </div>

      <ApproveModal
        open={approving}
        application={application}
        dispatchers={dispatchers}
        saving={busyAction === `approve-${application._id}`}
        onClose={() => {
          if (!busyAction) setApproving(false);
        }}
        onSave={handleApprove}
      />

      <AdminDecisionModal
        open={rejecting}
        title="Reject Dealer Application"
        subtitle="This records an admin review decision and prevents this application from becoming a dealer account."
        tone="danger"
        confirmLabel="Reject Application"
        busy={busyAction === `reject-${application._id}`}
        disabled={!rejectNote.trim()}
        details={[
          { label: "Company", value: application.companyName },
          { label: "Contact", value: application.contactName },
          { label: "Email", value: application.email },
          { label: "Phone", value: application.phone },
        ]}
        onClose={() => {
          if (!busyAction) {
            setRejecting(false);
            setRejectNote("");
          }
        }}
        onConfirm={handleReject}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--color-graphite, #707070)",
            }}
          >
            Required Review Note
          </div>
          <textarea
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Document the reason for rejecting this application…"
            disabled={busyAction === `reject-${application._id}`}
            style={textAreaStyle}
          />
        </div>
      </AdminDecisionModal>

      <AdminDecisionModal
        open={deleteConfirmOpen}
        title="Delete Dealer Application"
        subtitle="This moves the application to Settings Trash for 30 days before permanent database deletion."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${application._id}`}
        details={[
          { label: "Company", value: application.companyName },
          { label: "Contact", value: application.contactName },
          { label: "Email", value: application.email },
          { label: "Retention", value: "30 days in Settings Trash" },
        ]}
        requireText={application.companyName || ""}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (!busyAction) {
            setDeleteConfirmOpen(false);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
