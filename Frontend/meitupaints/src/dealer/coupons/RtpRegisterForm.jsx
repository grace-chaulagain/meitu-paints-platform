import { useState } from "react";
import { useRegisterRtpPainterMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { PrimaryButton } from "../../components/dashboard/DashboardUI.jsx";
import { PainterResultRow, StepHeader } from "./wizardUI.jsx";

const INPUT_STYLE = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,.1)",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
};

export default function RtpRegisterForm({ onRegistered, onBack }) {
  const [form, setForm] = useState({ name: "", citizenshipNumber: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [existingPainter, setExistingPainter] = useState(null);
  const [registerPainter, registerState] = useRegisterRtpPainterMutation();

  const canSave = form.name.trim() && form.citizenshipNumber.trim() && form.phone.trim() && !registerState.isLoading;

  async function handleSubmit() {
    setError("");
    setExistingPainter(null);
    try {
      const painter = await registerPainter({
        name: form.name.trim(),
        citizenshipNumber: form.citizenshipNumber.trim(),
        phones: [form.phone.trim()],
        address: form.address.trim(),
      }).unwrap();
      onRegistered(painter);
    } catch (err) {
      if (err?.data?.code === "PAINTER_ALREADY_EXISTS" && err?.data?.details?.painter) {
        setExistingPainter(err.data.details.painter);
      } else {
        setError(getQueryErrorMessage(err, "Could not register this painter."));
      }
    }
  }

  return (
    <div>
      <StepHeader title="Register new painter" onBack={onBack} />

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={fieldLabelStyle()}>Full name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Painter's full name"
            style={INPUT_STYLE}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={fieldLabelStyle()}>Citizenship / official ID</span>
          <input
            value={form.citizenshipNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, citizenshipNumber: event.target.value }))}
            placeholder="Citizenship number"
            style={INPUT_STYLE}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={fieldLabelStyle()}>Phone number</span>
          <input
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="98XXXXXXXX"
            style={INPUT_STYLE}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={fieldLabelStyle()}>Address (optional)</span>
          <input
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            placeholder="Area, District"
            style={INPUT_STYLE}
          />
        </label>
      </div>

      <p style={{ marginTop: 12, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
        By registering, you confirm the painter has agreed to Meitu storing this information to track reward points.
      </p>

      {error ? (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 12.5, fontWeight: 600 }}>
          {error}
        </div>
      ) : null}

      {existingPainter ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: "#b42318" }}>
            A painter with this ID is already registered:
          </div>
          <PainterResultRow
            painter={existingPainter}
            maskedIdLabel={`ID ${existingPainter.citizenshipNumberMasked || "—"}`}
            onClick={() => onRegistered(existingPainter)}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <PrimaryButton onClick={handleSubmit} disabled={!canSave} style={{ width: "100%", justifyContent: "center", height: 46 }}>
          {registerState.isLoading ? "Registering…" : "Register & Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function fieldLabelStyle() {
  return { fontSize: 11, fontWeight: 700, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" };
}
