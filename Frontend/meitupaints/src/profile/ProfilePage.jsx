import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "../auth/AuthProvider.jsx";
import { api, getApiErrorMessage } from "../api/client.js";
import NavBar from "../components/NavBar.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import {
  CheckCircleIcon,
  CreditCardIcon,
  DocumentIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
  StoreIcon,
  TruckIcon,
  UserIcon,
} from "../components/ui/ApplePageIcons.jsx";

function useReveal() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const elements = Array.from(root.querySelectorAll("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-in"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

function isActiveStatus(status) {
  return status === "ACTIVE" || status === "VERIFIED";
}

function StatTile({ icon, label, value }) {
  return (
    <div className="profile-stat-tile">
      <span className="profile-stat-icon">{icon}</span>
      <div className="profile-stat-copy">
        <p>{label}</p>
        <strong>{value || "—"}</strong>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="profile-detail-row">
      <span className="profile-detail-icon">{icon}</span>
      <span className="profile-detail-label">{label}</span>
      <strong className="profile-detail-value">{value || "—"}</strong>
    </div>
  );
}

function ActionTile({ icon, label, description, active, onClick }) {
  return (
    <button
      type="button"
      className={`profile-action-tile${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      <span className="profile-action-icon">{icon}</span>
      <span className="profile-action-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="profile-action-chevron" aria-hidden="true">
        {active ? "–" : "›"}
      </span>
    </button>
  );
}

function Banner({ tone, text }) {
  if (!text) return null;
  return <div className={`profile-banner profile-banner-${tone}`}>{text}</div>;
}

function EditPanel({ profile, isDealer }) {
  const { refresh } = useAuth();
  const initial = useMemo(
    () => ({
      contactName: profile.contactName === "—" ? "" : profile.contactName,
      phone: profile.phone === "—" ? "" : profile.phone,
      address: profile.address === "—" ? "" : profile.address,
      username: profile.username === "—" ? "" : profile.username,
    }),
    [profile],
  );

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setBanner(null);
  }

  function handleReset() {
    setForm(initial);
    setBanner(null);
  }

  async function handleSave() {
    setLoading(true);
    setBanner(null);
    try {
      const payload = isDealer
        ? { contactName: form.contactName, phone: form.phone, address: form.address }
        : { username: form.username, phone: form.phone };
      await api.patch("/api/users/me", payload);
      await refresh();
      setBanner({ tone: "success", text: "Profile updated successfully." });
    } catch (error) {
      setBanner({ tone: "error", text: getApiErrorMessage(error, "Couldn't save your changes.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="profile-panel">
      <div className="profile-panel-fields">
        {isDealer ? (
          <>
            <label className="profile-field">
              <span>Contact Name</span>
              <input name="contactName" value={form.contactName} onChange={handleChange} placeholder="Contact name" />
            </label>
            <label className="profile-field">
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" />
            </label>
            <label className="profile-field profile-field-wide">
              <span>Business Address</span>
              <input name="address" value={form.address} onChange={handleChange} placeholder="Business address" />
            </label>
          </>
        ) : (
          <>
            <label className="profile-field">
              <span>Username</span>
              <input name="username" value={form.username} onChange={handleChange} placeholder="Username" />
            </label>
            <label className="profile-field">
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" />
            </label>
          </>
        )}
      </div>

      <Banner tone={banner?.tone} text={banner?.text} />

      <div className="profile-panel-actions">
        <button type="button" className="profile-ghost-btn" onClick={handleReset} disabled={loading}>
          Reset
        </button>
        <button type="button" className="apple-pill primary" onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function PasswordField({ label, name, value, onChange, visible, onToggleVisible }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      <div className="profile-password-wrap">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="profile-password-toggle"
          onClick={onToggleVisible}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function SecurityPanel() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [visible, setVisible] = useState({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setBanner(null);
  }

  function toggleVisible(name) {
    setVisible((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function handleSubmit() {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setBanner({ tone: "error", text: "Fill in all three password fields." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setBanner({ tone: "error", text: "New password and confirmation don't match." });
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      await api.post("/api/users/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setBanner({ tone: "success", text: "Password updated successfully." });
    } catch (error) {
      setBanner({ tone: "error", text: getApiErrorMessage(error, "Couldn't update your password.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="profile-panel">
      <div className="profile-panel-fields">
        <PasswordField
          label="Current Password"
          name="currentPassword"
          value={form.currentPassword}
          onChange={handleChange}
          visible={visible.currentPassword}
          onToggleVisible={() => toggleVisible("currentPassword")}
        />
        <PasswordField
          label="New Password"
          name="newPassword"
          value={form.newPassword}
          onChange={handleChange}
          visible={visible.newPassword}
          onToggleVisible={() => toggleVisible("newPassword")}
        />
        <PasswordField
          label="Confirm Password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          visible={visible.confirmPassword}
          onToggleVisible={() => toggleVisible("confirmPassword")}
        />
      </div>

      <Banner tone={banner?.tone} text={banner?.text} />

      <div className="profile-panel-actions">
        <button type="button" className="apple-pill primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Updating…" : "Update Password"}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser, booting, refresh } = useAuth();
  const reduxUser = useSelector((state) => state?.user?.user || null);
  const reduxRole = useSelector((state) => state?.user?.role || null);
  const reduxDealerProfile = useSelector((state) => state?.user?.dealerProfile || null);
  const pageRef = useReveal();
  const [activePanel, setActivePanel] = useState(null);
  const avatarInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarBanner, setAvatarBanner] = useState(null);

  const sourceUser = reduxUser || authUser || null;

  const profile = useMemo(() => {
    if (!sourceUser) return null;

    const username =
      sourceUser?.username ||
      sourceUser?.name ||
      sourceUser?.fullName ||
      sourceUser?.contactName ||
      reduxDealerProfile?.contactName ||
      (sourceUser?.email ? String(sourceUser.email).split("@")[0] : "Meitu User");

    const role = String(reduxRole || sourceUser?.role || "USER").toUpperCase();
    const dealer = role === "DEALER" ? reduxDealerProfile || null : null;
    const displayName = dealer?.contactName || username;

    return {
      username,
      displayName,
      initial: String(displayName || "U").trim().charAt(0).toUpperCase(),
      avatarUrl: sourceUser?.avatarUrl || null,
      email: sourceUser?.email || dealer?.email || "—",
      role,
      status: String(dealer?.status || sourceUser?.status || "ACTIVE").toUpperCase(),
      companyName: dealer?.companyName || "—",
      contactName: dealer?.contactName || username,
      phone: dealer?.phone || sourceUser?.phone || "—",
      address: dealer?.address || sourceUser?.address || "—",
      panVat: dealer?.panVat || "—",
      dispatcherName: dealer?.dispatcherName || dealer?.dispatcherId || "Not assigned",
      creditLimit: dealer?.creditLimit != null ? `NPR ${Number(dealer.creditLimit).toLocaleString()}` : "—",
      availableCredit: dealer?.availableCredit != null ? `NPR ${Number(dealer.availableCredit).toLocaleString()}` : "—",
    };
  }, [reduxDealerProfile, reduxRole, sourceUser]);

  if (booting) return null;
  if (!profile) return <NotFoundPage />;

  const isDealer = profile.role === "DEALER";

  function togglePanel(panel) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function handleAvatarButtonClick() {
    avatarInputRef.current?.click();
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    setAvatarBanner(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      await api.post("/api/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refresh();
    } catch (error) {
      setAvatarBanner({ tone: "error", text: getApiErrorMessage(error, "Couldn't update your photo.") });
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="apple-profile-page" ref={pageRef}>
        <div className="profile-container">
          <section className="profile-hero" data-reveal>
            <div className="profile-avatar-ring">
              <div className="profile-avatar">
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.displayName} /> : profile.initial}
              </div>
              <button
                type="button"
                className="profile-avatar-edit-btn"
                onClick={handleAvatarButtonClick}
                disabled={avatarUploading}
                aria-label="Change profile photo"
              >
                {avatarUploading ? "…" : <EditIcon />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>
            <div className="profile-hero-copy">
              <h1>{profile.displayName}</h1>
              <p>{profile.email}</p>
              {avatarBanner ? (
                <div style={{ marginTop: 8 }}>
                  <Banner tone={avatarBanner.tone} text={avatarBanner.text} />
                </div>
              ) : null}
              <div className="profile-pill-row">
                <span className="profile-pill">{profile.role}</span>
                <span className={`profile-pill ${isActiveStatus(profile.status) ? "is-positive" : "is-caution"}`}>
                  {profile.status}
                </span>
              </div>
            </div>
          </section>

          {isDealer ? (
            <section className="profile-stats" data-reveal>
              <StatTile icon={<StoreIcon />} label="Company" value={profile.companyName} />
              <StatTile icon={<TruckIcon />} label="Dispatcher" value={profile.dispatcherName} />
              <StatTile icon={<CreditCardIcon />} label="Credit Limit" value={profile.creditLimit} />
              <StatTile icon={<CheckCircleIcon />} label="Available Credit" value={profile.availableCredit} />
            </section>
          ) : null}

          <section className="profile-actions" data-reveal>
            <ActionTile
              icon={<EditIcon />}
              label="Edit Profile"
              description="Update your contact details"
              active={activePanel === "edit"}
              onClick={() => togglePanel("edit")}
            />
            <ActionTile
              icon={<LockIcon />}
              label="Change Password"
              description="Keep your account secure"
              active={activePanel === "security"}
              onClick={() => togglePanel("security")}
            />
          </section>

          <div className={`profile-panel-slot${activePanel ? " is-open" : ""}`}>
            {activePanel === "edit" ? <EditPanel profile={profile} isDealer={isDealer} /> : null}
            {activePanel === "security" ? <SecurityPanel /> : null}
          </div>

          <section className="profile-details" data-reveal>
            {isDealer ? (
              <>
                <DetailRow icon={<UserIcon />} label="Contact Person" value={profile.contactName} />
                <DetailRow icon={<PhoneIcon />} label="Phone" value={profile.phone} />
                <DetailRow icon={<MailIcon />} label="Email" value={profile.email} />
                <DetailRow icon={<PinIcon />} label="Address" value={profile.address} />
                <DetailRow icon={<DocumentIcon />} label="PAN / VAT" value={profile.panVat} />
              </>
            ) : (
              <>
                <DetailRow icon={<UserIcon />} label="Username" value={profile.username} />
                <DetailRow icon={<MailIcon />} label="Email" value={profile.email} />
                <DetailRow icon={<ShieldIcon />} label="Role" value={profile.role} />
              </>
            )}
          </section>
        </div>
      </main>

      <style>{`
        .apple-profile-page {
          background: var(--surface-canvas, #f5f5f7);
          min-height: 100vh;
          padding: 112px 24px 80px;
          font-family: var(--font-sf-pro-text, Inter, system-ui, sans-serif);
        }
        .apple-profile-page svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .profile-container {
          width: min(760px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }

        .profile-hero {
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 8px 4px 12px;
        }
        .profile-avatar-ring {
          position: relative;
          flex-shrink: 0;
          width: 92px;
          height: 92px;
          border-radius: 999px;
          padding: 3px;
          background: conic-gradient(from 200deg, rgba(0,113,227,.65), rgba(181,28,28,.5), rgba(0,113,227,.65));
          animation: profileRingSpin 7s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .profile-avatar-ring { animation: none; }
        }
        @keyframes profileRingSpin {
          to { transform: rotate(360deg); }
        }
        .profile-avatar {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          background: var(--color-ink, #1d1d1f);
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 34px;
          font-weight: 600;
          letter-spacing: -0.02em;
          overflow: hidden;
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-avatar-edit-btn {
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          border: 2px solid var(--surface-canvas, #f5f5f7);
          background: var(--color-azure, #0071e3);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: transform .12s ease, background-color .12s ease;
        }
        .profile-avatar-edit-btn svg { width: 13px; height: 13px; }
        .profile-avatar-edit-btn:hover:not(:disabled) { background: #0077ed; transform: scale(1.05); }
        .profile-avatar-edit-btn:disabled { opacity: .6; cursor: not-allowed; }
        .profile-hero-copy { min-width: 0; }
        .profile-hero-copy h1 {
          margin: 0;
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 600;
          letter-spacing: -0.03em;
          color: var(--color-ink, #1d1d1f);
          overflow-wrap: anywhere;
        }
        .profile-hero-copy p {
          margin: 4px 0 0;
          font-size: 15px;
          color: var(--color-graphite, #707070);
          overflow-wrap: anywhere;
        }
        .profile-pill-row {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .profile-pill {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(0,0,0,.055);
          color: var(--color-slate, #474747);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .profile-pill.is-positive { background: rgba(22,163,74,.1); color: #15803d; }
        .profile-pill.is-caution { background: rgba(182,68,0,.1); color: var(--color-caution, #b64400); }

        .profile-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .profile-stat-tile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          transition: transform .18s ease;
        }
        .profile-stat-tile:hover { transform: translateY(-2px); }
        .profile-stat-icon {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(0,113,227,.08);
          color: var(--color-azure, #0071e3);
        }
        .profile-stat-copy { min-width: 0; }
        .profile-stat-copy p {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: var(--color-graphite, #707070);
        }
        .profile-stat-copy strong {
          display: block;
          margin-top: 3px;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-ink, #1d1d1f);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .profile-action-tile {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 20px;
          border: none;
          background: #fff;
          cursor: pointer;
          text-align: left;
          transition: transform .16s ease, box-shadow .16s ease;
        }
        .profile-action-tile:hover { transform: translateY(-2px); }
        .profile-action-tile.is-active {
          background: var(--color-azure, #0071e3);
        }
        .profile-action-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(0,113,227,.08);
          color: var(--color-azure, #0071e3);
          transition: background .16s ease, color .16s ease;
        }
        .profile-action-tile.is-active .profile-action-icon {
          background: rgba(255,255,255,.18);
          color: #fff;
        }
        .profile-action-copy {
          flex: 1;
          min-width: 0;
          display: grid;
        }
        .profile-action-copy strong {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-ink, #1d1d1f);
        }
        .profile-action-copy small {
          margin-top: 2px;
          font-size: 12.5px;
          color: var(--color-graphite, #707070);
        }
        .profile-action-tile.is-active .profile-action-copy strong,
        .profile-action-tile.is-active .profile-action-copy small {
          color: #fff;
        }
        .profile-action-chevron {
          flex-shrink: 0;
          font-size: 20px;
          font-weight: 300;
          color: var(--color-graphite, #707070);
        }
        .profile-action-tile.is-active .profile-action-chevron { color: #fff; }

        .profile-panel-slot {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows .3s var(--ease-smooth, ease);
        }
        .profile-panel-slot.is-open { grid-template-rows: 1fr; }
        .profile-panel-slot > div { overflow: hidden; }

        .profile-panel {
          padding: 22px;
          border-radius: 22px;
          background: #fff;
          display: grid;
          gap: 16px;
        }
        .profile-panel-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
        }
        .profile-field { display: grid; gap: 6px; min-width: 0; }
        .profile-field-wide { grid-column: 1 / -1; }
        .profile-field span {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: var(--color-graphite, #707070);
        }
        .profile-field input {
          height: 42px;
          border-radius: 12px;
          border: none;
          background: var(--color-fog, #f5f5f7);
          padding: 0 14px;
          font-size: 14px;
          color: var(--color-ink, #1d1d1f);
          outline: none;
          transition: box-shadow .16s ease;
        }
        .profile-field input:focus {
          box-shadow: 0 0 0 2px rgba(0,113,227,.4);
        }
        .profile-password-wrap { position: relative; }
        .profile-password-wrap input { width: 100%; padding-right: 44px; }
        .profile-password-toggle {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--color-graphite, #707070);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .profile-password-toggle svg { width: 17px; height: 17px; }

        .profile-banner {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .profile-banner-success { background: rgba(22,163,74,.08); color: #15803d; }
        .profile-banner-error { background: rgba(180,35,24,.08); color: #b42318; }

        .profile-panel-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .profile-ghost-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.1);
          background: #fff;
          color: var(--color-ink, #1d1d1f);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .apple-pill.primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 38px;
          padding: 0 20px;
          border-radius: 999px;
          border: none;
          background: var(--color-azure, #0071e3);
          color: #fff;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color .12s ease, transform .12s ease;
        }
        .apple-pill.primary:hover:not(:disabled) {
          background: #0077ed;
          transform: translateY(-1px);
        }
        .apple-pill.primary:active:not(:disabled) { transform: scale(.98); }
        .apple-pill.primary:disabled { opacity: .55; cursor: not-allowed; }

        .profile-details {
          border-radius: 22px;
          background: #fff;
          overflow: hidden;
        }
        .profile-detail-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-top: 1px solid rgba(0,0,0,.05);
        }
        .profile-detail-row:first-child { border-top: none; }
        .profile-detail-icon {
          flex-shrink: 0;
          color: var(--color-graphite, #707070);
        }
        .profile-detail-label {
          flex: 1;
          min-width: 0;
          font-size: 13.5px;
          color: var(--color-graphite, #707070);
        }
        .profile-detail-value {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--color-ink, #1d1d1f);
          text-align: right;
          overflow-wrap: anywhere;
          max-width: 60%;
        }

        @media (max-width: 640px) {
          .apple-profile-page { padding: 96px 16px 56px; }
          .profile-hero { gap: 16px; }
          .profile-avatar-ring { width: 72px; height: 72px; }
          .profile-avatar { font-size: 26px; }
          .profile-panel-fields { grid-template-columns: 1fr; }
          .profile-detail-row { flex-wrap: wrap; }
          .profile-detail-value { max-width: 100%; text-align: left; }
        }
      `}</style>
    </>
  );
}
