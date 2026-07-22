import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { ToggleSwitch } from "../../components/dashboard/DashboardUI.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { toast } from "../../dealer/mobile/useToast.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  adminEmail: "",
  factoryEmail: "",
  notificationsEnabled: true,
  dealerApplicationNotificationsEnabled: true,
  dispatcherApplicationNotificationsEnabled: true,
  factoryOrderNotificationsEnabled: true,
};

// Genuinely small enough (2 fields + 4 toggles) to port with zero scope
// cuts - same axios-style `api` client as desktop (no RTK hooks exist for
// these two settings endpoints). ToggleSwitch is reused directly from
// DashboardUI.jsx rather than rebuilt - a plain checkbox-based switch with
// its own scoped CSS, no desktop-only assumptions baked in.
function ToggleRow({ icon, title, description, checked, onChange }) {
  return (
    <div className="admin-m-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
      <span className="admin-m-feed-icon" style={checked ? { background: "rgba(0,113,227,.12)", color: "var(--color-azure, #0071e3)" } : undefined}>
        <DashboardIcon name={icon} size={16} strokeWidth={1.8} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 12, lineHeight: 1.5, color: "var(--color-graphite, #707070)" }}>{description}</span>
      </span>
      <ToggleSwitch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function AdminSettingsMobileView() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/settings/notifications");
      setForm({ ...EMPTY_FORM, ...(res?.data?.item || {}) });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to load notification settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  }

  const adminEmailTrimmed = form.adminEmail.trim();
  const factoryEmailTrimmed = form.factoryEmail.trim();
  const adminEmailInvalid = touched && Boolean(adminEmailTrimmed) && !EMAIL_PATTERN.test(adminEmailTrimmed);
  const factoryEmailInvalid = touched && Boolean(factoryEmailTrimmed) && !EMAIL_PATTERN.test(factoryEmailTrimmed);
  const formHasErrors = adminEmailInvalid || factoryEmailInvalid;

  function buildPayload() {
    return {
      adminEmail: adminEmailTrimmed.toLowerCase(),
      factoryEmail: factoryEmailTrimmed.toLowerCase(),
      notificationsEnabled: form.notificationsEnabled,
      dealerApplicationNotificationsEnabled: form.dealerApplicationNotificationsEnabled,
      dispatcherApplicationNotificationsEnabled: form.dispatcherApplicationNotificationsEnabled,
      factoryOrderNotificationsEnabled: form.factoryOrderNotificationsEnabled,
    };
  }

  async function handleSave() {
    if (formHasErrors) {
      toast("Fix the highlighted email address before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.patch("/api/admin/settings/notifications", buildPayload());
      setForm({ ...EMPTY_FORM, ...(res?.data?.item || {}) });
      toast("Notification settings saved");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (formHasErrors) {
      toast("Fix the highlighted email address before sending a test.");
      return;
    }
    setTesting(true);
    setError("");
    try {
      const saved = await api.patch("/api/admin/settings/notifications", buildPayload());
      setForm({ ...EMPTY_FORM, ...(saved?.data?.item || {}) });
      const res = await api.post("/api/admin/settings/notifications/test");
      const to = res?.data?.item?.to || saved?.data?.item?.adminEmail || "";
      toast(to ? `Test notification sent to ${to}` : "Test notification sent");
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send test notification.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Settings</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Settings" />

        {error ? <div className="dealer-m-newsale-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div className="admin-m-section-title" style={{ marginTop: 14 }}>
          Notification Recipients
        </div>
        <div className="dealer-m-newsale-field-label" style={{ marginTop: 10 }}>
          Factory Email
        </div>
        <input
          className="dealer-m-newsale-input"
          type="email"
          value={form.factoryEmail}
          onChange={(e) => updateField("factoryEmail", e.target.value)}
          placeholder="factory@example.com"
        />
        <div className="dealer-m-newsale-field-label">Admin Notification Email</div>
        <input
          className="dealer-m-newsale-input"
          type="email"
          value={form.adminEmail}
          onChange={(e) => updateField("adminEmail", e.target.value)}
          placeholder="operations-admin@example.com"
        />

        <div className="admin-m-section-title" style={{ marginTop: 18 }}>
          Alert Types
        </div>
        <div className="admin-m-card-list" style={{ marginTop: 10 }}>
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
            description="Only factory-routed dealer orders trigger this alert."
            checked={form.factoryOrderNotificationsEnabled}
            onChange={(value) => updateField("factoryOrderNotificationsEnabled", value)}
          />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <PrimaryButton loading={saving} onClick={handleSave}>
            Save Notification Settings
          </PrimaryButton>
          <PrimaryButton variant="secondary" loading={testing} onClick={handleSendTest}>
            Send Test Email
          </PrimaryButton>
          <button type="button" className="dealer-m-newsale-ghost" style={{ justifySelf: "center" }} onClick={() => navigate("/admin/dashboard/settings/trash")}>
            View Trash
          </button>
        </div>
      </SkeletonSwap>
    </div>
  );
}
