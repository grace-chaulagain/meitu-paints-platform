import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  PrimaryButton,
  SectionHeader,
  Surface,
  ToggleSwitch,
} from "../../components/dashboard/DashboardUI.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  adminEmail: "",
  factoryEmail: "",
  notificationsEnabled: true,
  dealerApplicationNotificationsEnabled: true,
  dispatcherApplicationNotificationsEnabled: true,
  factoryOrderNotificationsEnabled: true,
};

function fieldStyle(invalid) {
  return {
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: invalid ? "1px solid rgba(180,35,24,.4)" : "none",
    background: invalid ? "rgba(180,35,24,.05)" : "var(--color-fog, #f5f5f7)",
    padding: "0 14px",
    outline: "none",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink, #1d1d1f)",
  };
}

function Field({ label, helper = "", error = "", children }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--color-graphite, #707070)",
        }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <div style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "#b42318" }}>{error}</div>
      ) : helper ? (
        <div style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({ icon, title, description, checked, onChange }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px minmax(0,1fr) auto",
        gap: 14,
        alignItems: "center",
        padding: 14,
        borderRadius: 14,
        background: "var(--color-fog, #f5f5f7)",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: checked ? "rgba(0,113,227,.12)" : "rgba(29,29,31,.06)",
          color: checked ? "var(--color-azure, #0071e3)" : "var(--color-graphite, #707070)",
        }}
      >
        <DashboardIcon name={icon} size={16} strokeWidth={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
          {title}
        </span>
        <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {description}
        </span>
      </span>
      <ToggleSwitch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [touched, setTouched] = useState(false);

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/settings/notifications");
      setForm({ ...EMPTY_FORM, ...(res?.data?.item || {}) });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to load notification settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
    setSuccess("");
  };

  const adminEmailTrimmed = form.adminEmail.trim();
  const factoryEmailTrimmed = form.factoryEmail.trim();
  const adminEmailInvalid = touched && Boolean(adminEmailTrimmed) && !EMAIL_PATTERN.test(adminEmailTrimmed);
  const factoryEmailInvalid = touched && Boolean(factoryEmailTrimmed) && !EMAIL_PATTERN.test(factoryEmailTrimmed);
  const missingAdminEmailWarning = form.notificationsEnabled && !adminEmailInvalid && !adminEmailTrimmed;
  const formHasErrors = adminEmailInvalid || factoryEmailInvalid;

  const buildPayload = () => ({
    adminEmail: adminEmailTrimmed.toLowerCase(),
    factoryEmail: factoryEmailTrimmed.toLowerCase(),
    notificationsEnabled: form.notificationsEnabled,
    dealerApplicationNotificationsEnabled: form.dealerApplicationNotificationsEnabled,
    dispatcherApplicationNotificationsEnabled: form.dispatcherApplicationNotificationsEnabled,
    factoryOrderNotificationsEnabled: form.factoryOrderNotificationsEnabled,
  });

  async function handleSave() {
    if (formHasErrors) {
      setError("Fix the highlighted email address before saving.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await api.patch("/api/admin/settings/notifications", buildPayload());

      setForm({ ...EMPTY_FORM, ...(res?.data?.item || {}) });
      setSuccess("Notification settings saved.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to save notification settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (formHasErrors) {
      setError("Fix the highlighted email address before sending a test.");
      return;
    }

    try {
      setTesting(true);
      setError("");
      setSuccess("");

      const saved = await api.patch("/api/admin/settings/notifications", buildPayload());
      setForm({ ...EMPTY_FORM, ...(saved?.data?.item || {}) });

      const res = await api.post("/api/admin/settings/notifications/test");
      const to = res?.data?.item?.to || saved?.data?.item?.adminEmail || "";
      setSuccess(to ? `Test notification sent to ${to}.` : "Test notification sent.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send test notification.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Settings"
          icon="gear"
          title="Notification Settings"
          subtitle="Configure operational email recipients for admin alerts. This admin email is separate from any admin login identity."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <GhostButton icon="bell" onClick={handleSendTest} disabled={loading || saving || testing}>
                {testing ? "Sending…" : "Send Test Email"}
              </GhostButton>
              <GhostButton icon="refresh" onClick={loadSettings} disabled={loading}>
                Refresh
              </GhostButton>
              <GhostButton icon="trash" onClick={() => navigate("/admin/dashboard/settings/trash")}>
                Trash
              </GhostButton>
            </div>
          }
        />

        {(error || success) ? (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 12,
              background: error ? "rgba(180,35,24,.08)" : "rgba(22,163,74,.08)",
              color: error ? "#b42318" : "#15803d",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error || success}
          </div>
        ) : null}
      </Surface>

      <Surface padding={22}>
        {loading ? (
          <div style={{ display: "grid", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: 56,
                  borderRadius: 12,
                  background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            {missingAdminEmailWarning ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(182,68,0,.08)",
                  color: "var(--color-caution, #b64400)",
                }}
              >
                <DashboardIcon name="warning" size={15} strokeWidth={1.9} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
                  Notification emails are enabled, but no admin notification email is set — alerts won&apos;t reach anyone until one is added below.
                </span>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <Field
                label="Factory Email"
                helper="Existing factory recipient used for factory order bill emails."
                error={factoryEmailInvalid ? "This doesn't look like a valid email address." : ""}
              >
                <input
                  type="email"
                  value={form.factoryEmail}
                  onChange={(e) => updateField("factoryEmail", e.target.value)}
                  placeholder="factory@example.com"
                  style={fieldStyle(factoryEmailInvalid)}
                />
              </Field>

              <Field
                label="Admin Notification Email"
                helper="Receives new dealer applications, dispatcher applications, and factory-routed order alerts. This is not the admin login email."
                error={adminEmailInvalid ? "This doesn't look like a valid email address." : ""}
              >
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => updateField("adminEmail", e.target.value)}
                  placeholder="operations-admin@example.com"
                  style={fieldStyle(adminEmailInvalid)}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <ToggleRow
                icon="bell"
                title="Enable admin notification email"
                description="Master switch for all admin-facing notification emails."
                checked={form.notificationsEnabled}
                onChange={(value) => updateField("notificationsEnabled", value)}
              />
              <ToggleRow
                icon="store"
                title="Dealer application alerts"
                description="Notify admin when a new dealer application is submitted."
                checked={form.dealerApplicationNotificationsEnabled}
                onChange={(value) => updateField("dealerApplicationNotificationsEnabled", value)}
              />
              <ToggleRow
                icon="handshake"
                title="Dispatcher application alerts"
                description="Notify admin when a new dispatcher application is submitted."
                checked={form.dispatcherApplicationNotificationsEnabled}
                onChange={(value) => updateField("dispatcherApplicationNotificationsEnabled", value)}
              />
              <ToggleRow
                icon="orders"
                title="Factory-routed order alerts"
                description="Notify admin only for new orders placed by factory-routed dealers. Dispatcher-routed dealer orders are excluded."
                checked={form.factoryOrderNotificationsEnabled}
                onChange={(value) => updateField("factoryOrderNotificationsEnabled", value)}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--color-fog, #f5f5f7)",
              }}
            >
              <DashboardIcon name="gear" size={15} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.6, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                SMTP credentials still come from the backend environment. These settings only decide who receives operational admin alerts.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                "Send Test Email" also saves your current changes first.
              </span>
              <PrimaryButton icon="checkmark" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Notification Settings"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}
