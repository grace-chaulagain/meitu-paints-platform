import { useState } from "react";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import {
  useApproveDispatcherMutation,
  useDeleteAdminDispatcherMutation,
  useGetAdminDispatcherQuery,
  useRejectDispatcherMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";

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

export default function AdminDispatcherApplicationDetailPage({ dispatcherId, onBack }) {
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingDecision, setPendingDecision] = useState(""); // "approve" | "reject" | ""
  const [rejectNote, setRejectNote] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const dispatcher = dispatcherQuery.data?.item || null;

  const [approveDispatcher] = useApproveDispatcherMutation();
  const [rejectDispatcher] = useRejectDispatcherMutation();
  const [deleteDispatcher] = useDeleteAdminDispatcherMutation();

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

  const handleApprove = async () => {
    const success = await runAction(`approve-${dispatcher._id}`, () =>
      approveDispatcher({
        dispatcherId: dispatcher._id,
        payload: { notes: dispatcher.notes || "" },
      }).unwrap(),
    );
    if (success) goBack();
  };

  const handleReject = async () => {
    const success = await runAction(`reject-${dispatcher._id}`, () =>
      rejectDispatcher({
        dispatcherId: dispatcher._id,
        payload: { reviewNote: rejectNote.trim() },
      }).unwrap(),
    );
    if (success) goBack();
  };

  const handleDelete = async () => {
    const success = await runAction(`delete-${dispatcher._id}`, () =>
      deleteDispatcher({
        dispatcherId: dispatcher._id,
        payload: {
          reason: dispatcher.status === "VERIFIED" ? "Admin moved dispatcher to trash" : "Admin moved dispatcher application to trash",
        },
      }).unwrap(),
    );
    if (success) goBack();
  };

  if (dispatcherQuery.isLoading && !dispatcher) {
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

  if (!dispatcherQuery.isLoading && !dispatcher) {
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

  const isPending = dispatcher.status === "PENDING";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <BackButton onClick={goBack} />
      </div>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Applications"
          icon="handshake"
          title={dispatcher.companyName || dispatcher.name || "Dispatcher Application"}
          subtitle={`Submitted ${formatFullDateTime(dispatcher.createdAt)}`}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {isPending ? (
                <>
                  <PrimaryButton icon="checkmark" onClick={() => setPendingDecision("approve")}>
                    Verify
                  </PrimaryButton>
                  <GhostButton danger icon="reject" onClick={() => setPendingDecision("reject")}>
                    Reject
                  </GhostButton>
                </>
              ) : null}
              <GhostButton
                danger
                icon="trash"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete
              </GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 16 }}>
          <Pill tone={statusTone(dispatcher.status)} size="small">
            {dispatcher.status || "PENDING"}
          </Pill>
        </div>

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
          <CardLabel icon="handshake">Applicant</CardLabel>
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <DetailItem label="Company" value={dispatcher.companyName} />
            <DetailItem label="Contact" value={dispatcher.name} />
            <DetailItem label="Email" value={dispatcher.email} />
            <DetailItem label="Phone" value={dispatcher.phone} />
            <DetailItem label="Address" value={dispatcher.address} />
          </div>
        </Surface>

        {dispatcher.notes ? (
          <Surface padding={18}>
            <CardLabel icon="edit">Notes</CardLabel>
            <div style={{ marginTop: 12 }}>
              <DetailItem label="Operational Notes" value={dispatcher.notes} />
            </div>
          </Surface>
        ) : null}
      </div>

      <AdminDecisionModal
        open={pendingDecision === "approve"}
        title="Verify Dispatcher"
        subtitle="This will verify the dispatcher and make the account eligible for operational assignment."
        confirmLabel="Verify Dispatcher"
        busy={busyAction === `approve-${dispatcher._id}`}
        details={[
          { label: "Name", value: dispatcher.name },
          { label: "Company", value: dispatcher.companyName },
          { label: "Email", value: dispatcher.email },
          { label: "Phone", value: dispatcher.phone },
        ]}
        onClose={() => {
          if (!busyAction) setPendingDecision("");
        }}
        onConfirm={handleApprove}
      />

      <AdminDecisionModal
        open={pendingDecision === "reject"}
        title="Reject Dispatcher"
        subtitle="The applicant will be emailed this reason, so keep it clear and professional."
        tone="danger"
        confirmLabel="Reject Dispatcher"
        busy={busyAction === `reject-${dispatcher._id}`}
        details={[
          { label: "Name", value: dispatcher.name },
          { label: "Company", value: dispatcher.companyName },
          { label: "Email", value: dispatcher.email },
          { label: "Phone", value: dispatcher.phone },
        ]}
        onClose={() => {
          if (!busyAction) {
            setPendingDecision("");
            setRejectNote("");
          }
        }}
        onConfirm={handleReject}
      >
        <textarea
          rows={4}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Document the reason for rejecting this application…"
          disabled={busyAction === `reject-${dispatcher._id}`}
          style={textAreaStyle}
        />
      </AdminDecisionModal>

      <AdminDecisionModal
        open={deleteConfirmOpen}
        title="Delete Dispatcher Application"
        subtitle="This moves the application to Settings Trash for 30 days before permanent database deletion."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${dispatcher._id}`}
        details={[
          { label: "Name", value: dispatcher.name },
          { label: "Company", value: dispatcher.companyName },
          { label: "Email", value: dispatcher.email },
          { label: "Retention", value: "30 days in Settings Trash" },
        ]}
        onClose={() => {
          if (!busyAction) setDeleteConfirmOpen(false);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
