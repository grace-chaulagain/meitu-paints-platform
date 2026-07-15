import { useState } from "react";
import { GhostButton, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

function fieldInputStyle() {
  return {
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
  };
}

function getPainterForm(painter) {
  return {
    name: painter?.name || "",
    phones: painter?.phones?.length ? [...painter.phones] : [""],
    address: painter?.address || "",
    notes: painter?.notes || "",
  };
}

// Shared add/edit modal used by both AdminPaintersPage.jsx (list/grid quick
// edit) and AdminPainterProfilePage.jsx (profile page edit) - one form, two
// entry points.
export default function PainterFormModal({ open, painter, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(() => getPainterForm(painter));

  if (!open) return null;

  const cleanedPhones = form.phones.map((p) => p.trim()).filter(Boolean);
  const canSave = form.name.trim() && cleanedPhones.length > 0 && !saving;

  function updatePhone(index, value) {
    setForm((prev) => ({ ...prev, phones: prev.phones.map((p, i) => (i === index ? value : p)) }));
  }
  function addPhoneRow() {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, ""] }));
  }
  function removePhoneRow(index) {
    setForm((prev) => ({ ...prev, phones: prev.phones.filter((_, i) => i !== index) }));
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)" }} padding={22}>
        <SectionHeader
          title={painter?._id ? "Edit Painter" : "Add Painter"}
          subtitle="Keep the Meitu painter directory up to date."
          action={
            <GhostButton onClick={onClose} icon="reject">
              Close
            </GhostButton>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite,#707070)" }}>
              Name
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Painter name"
              style={fieldInputStyle()}
            />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite,#707070)" }}>
              Phone Numbers
            </span>
            {form.phones.map((phone, index) => (
              <div key={index} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={phone}
                  onChange={(e) => updatePhone(index, e.target.value)}
                  placeholder="98XXXXXXXX"
                  style={fieldInputStyle()}
                />
                <button
                  type="button"
                  onClick={() => removePhoneRow(index)}
                  disabled={form.phones.length <= 1}
                  aria-label="Remove phone number"
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    border: "none",
                    borderRadius: 9,
                    background: "var(--color-fog,#f5f5f7)",
                    color: "var(--color-graphite,#707070)",
                    cursor: form.phones.length <= 1 ? "not-allowed" : "pointer",
                    opacity: form.phones.length <= 1 ? 0.5 : 1,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <DashboardIcon name="minus" size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
            <GhostButton icon="plus" onClick={addPhoneRow} style={{ justifySelf: "start" }}>
              Add phone number
            </GhostButton>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite,#707070)" }}>
              Address
            </span>
            <input
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Area, District"
              style={fieldInputStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite,#707070)" }}>
              Notes (optional)
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              style={{ ...fieldInputStyle(), height: "auto", padding: 12, resize: "vertical" }}
            />
          </label>
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton
            onClick={() => onSave({ name: form.name.trim(), phones: cleanedPhones, address: form.address.trim(), notes: form.notes.trim() })}
            disabled={!canSave}
          >
            {saving ? "Saving…" : "Save Painter"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}
