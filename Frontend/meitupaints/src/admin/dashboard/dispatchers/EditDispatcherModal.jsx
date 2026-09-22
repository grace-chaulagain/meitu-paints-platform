import { useState } from "react";
import { GhostButton, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { isDetailMissing } from "../../../utils/missingDetails.js";
import { DISPATCHER_DETAIL_FIELDS } from "./dispatcherDetails.js";

// Shared by the dispatchers list and the dispatcher profile. It reads the
// dispatcher once, when it mounts - callers give it a `key` per dispatcher so
// opening it for someone else starts from their details, not the last one's.

const FLAGGED_KEYS = new Set(DISPATCHER_DETAIL_FIELDS.map((field) => field.key));

function getDispatcherForm(dispatcher) {
  return {
    name: dispatcher?.name || "",
    companyName: dispatcher?.companyName || "",
    phone: dispatcher?.phone || "",
    email: dispatcher?.email || "",
    address: dispatcher?.address || "",
    notes: dispatcher?.notes || "",
  };
}

function InlineLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        color: "var(--color-graphite,#707070)",
      }}
    >
      {children}
    </div>
  );
}

// `flagged` marks a detail the profile reports as "not entered yet" - it keeps
// that red until something is typed.
function FormField({ label, value, onChange, placeholder, textarea = false, flagged = false }) {
  const missing = flagged && isDetailMissing(value);
  const missingStyle = missing
    ? { background: "rgba(193,18,31,.05)", boxShadow: "inset 0 0 0 1.5px rgba(193,18,31,.45)" }
    : null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <InlineLabel>{label}</InlineLabel>
      {textarea ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          style={{
            width: "100%",
            borderRadius: 10,
            border: "none",
            background: "var(--color-fog,#f5f5f7)",
            padding: 12,
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--color-ink,#1d1d1f)",
            outline: "none",
            resize: "vertical",
            ...missingStyle,
          }}
        />
      ) : (
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: "100%",
            height: 40,
            borderRadius: 10,
            border: "none",
            background: "var(--color-fog,#f5f5f7)",
            padding: "0 12px",
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--color-ink,#1d1d1f)",
            outline: "none",
            ...missingStyle,
          }}
        />
      )}
    </div>
  );
}

export default function EditDispatcherModal({ open, dispatcher, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => getDispatcherForm(dispatcher));

  if (!open || !dispatcher) return null;

  const canSave =
    form.name.trim() && form.phone.trim() && form.email.trim() && !saving;

  const field = (key) => ({
    value: form[key],
    flagged: FLAGGED_KEYS.has(key),
    onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

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
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        padding={22}
      >
        <SectionHeader
          title="Edit Dispatcher"
          subtitle="Update operational and contact details for this dispatcher."
          action={
            <GhostButton onClick={onClose} icon="reject">
              Close
            </GhostButton>
          }
        />

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: 16,
          }}
        >
          <FormField label="Name" placeholder="Dispatcher name" {...field("name")} />
          <FormField label="Company Name" placeholder="Company name" {...field("companyName")} />
          <FormField label="Phone" placeholder="Phone" {...field("phone")} />
          <FormField label="Email" placeholder="Email" {...field("email")} />
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField label="Address" placeholder="Address" {...field("address")} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField label="Notes" textarea placeholder="Operational notes" {...field("notes")} />
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            onClick={() =>
              onSave({
                name: form.name.trim(),
                companyName: form.companyName.trim(),
                phone: form.phone.trim(),
                email: form.email.trim().toLowerCase(),
                address: form.address.trim(),
                notes: form.notes.trim(),
              })
            }
            disabled={!canSave}
          >
            {saving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}
