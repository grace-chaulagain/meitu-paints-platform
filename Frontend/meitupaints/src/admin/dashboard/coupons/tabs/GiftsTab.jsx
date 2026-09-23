import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import {
  useCreateGiftMutation,
  useDeleteGiftMutation,
  useGetGiftsQuery,
  useGetPainterPortalSettingsQuery,
  useUpdateGiftMutation,
  useUpdatePainterPortalSettingsMutation,
  useUploadGiftImageMutation,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DataTable, GhostButton, PrimaryButton, Surface } from "../../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import { AppleDateField } from "../../../../components/dashboard/ApplePickers.jsx";

// Runs the painter portal (/painter): the gifts painters aim at, and the
// fiscal year their points are counted in.
//
// Operational, not marketing (DESIGN.md): one compact settings strip, a dense
// table, icons in place of rows of labelled buttons, and no sentence an admin
// has to read twice. Motion is limited to press feedback and the modal - this
// page is worked in daily, and anything that plays on every visit would only
// get in the way.

const PORTAL_PATH = "/painter";

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// The address on the QR, taken from the browser, so staging prints a staging
// link and production a production one with no setting to forget.
function portalUrl() {
  if (typeof window === "undefined") return PORTAL_PATH;
  return `${window.location.origin}${PORTAL_PATH}`;
}

function IconButton({ icon, label, onClick, tone = "" }) {
  return (
    <button type="button" className={`gift-icon-btn ${tone}`} onClick={onClick} aria-label={label} title={label}>
      <DashboardIcon name={icon} size={15} strokeWidth={1.9} />
    </button>
  );
}

function GiftFormModal({ gift, onClose, onSaved }) {
  const isEdit = Boolean(gift?._id);
  const [form, setForm] = useState({
    name: gift?.name || "",
    nameNepali: gift?.nameNepali || "",
    pointsRequired: gift?.pointsRequired ?? "",
    isActive: gift?.isActive ?? true,
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [createGift, createState] = useCreateGiftMutation();
  const [updateGift, updateState] = useUpdateGiftMutation();
  const [uploadGiftImage, uploadState] = useUploadGiftImageMutation();
  const busy = createState.isLoading || updateState.isLoading || uploadState.isLoading;

  function field(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    const points = Number(form.pointsRequired);
    if (!form.name.trim()) return setError("Give the gift a name.");
    if (!Number.isFinite(points) || points < 1) return setError("Points required must be 1 or more.");

    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        nameNepali: form.nameNepali.trim(),
        pointsRequired: points,
        isActive: form.isActive,
      };
      const saved = isEdit
        ? await updateGift({ giftId: gift._id, ...payload }).unwrap()
        : await createGift(payload).unwrap();
      if (file) await uploadGiftImage({ giftId: saved?._id || gift?._id, file }).unwrap();
      onSaved(isEdit ? "Gift updated" : "Gift added");
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not save this gift."));
    }
  }

  return (
    <div
      className="dash-modal-backdrop-in gift-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface
        className="dash-modal-surface-in"
        style={{ width: "min(460px, 100%)", maxHeight: "90vh", overflow: "auto" }}
        padding={20}
      >
        <div className="gift-modal-head">
          <h3>{isEdit ? "Edit gift" : "Add gift"}</h3>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>

        <form onSubmit={save} className="gift-form">
          <div className="gift-row-2">
            <label className="gift-field">
              <span>Name</span>
              <input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Rice cooker" />
            </label>
            <label className="gift-field">
              <span>Points</span>
              <input
                value={form.pointsRequired}
                onChange={(e) => field("pointsRequired", e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="3000"
              />
            </label>
          </div>
          <label className="gift-field">
            <span>Nepali name — what painters see</span>
            <input value={form.nameNepali} onChange={(e) => field("nameNepali", e.target.value)} placeholder="राइस कुकर" />
          </label>
          <label className="gift-field">
            <span>Picture {gift?.image?.url ? "— replaces the current one" : "— optional"}</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="gift-check">
            <input type="checkbox" checked={form.isActive} onChange={(e) => field("isActive", e.target.checked)} />
            <span>Show on the portal</span>
          </label>

          {error ? <div className="admin-coupons-error">{error}</div> : null}
          <div className="gift-modal-foot">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={busy} icon="check">
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </form>
      </Surface>
    </div>
  );
}

// Keyed by the caller on the saved version, so a save refills the fields
// without an effect copying state around.
function FiscalYearPanel({ settings, onSaved }) {
  const [label, setLabel] = useState(settings?.fiscalYearLabel || "");
  const [from, setFrom] = useState(dateInputValue(settings?.fiscalYearStart));
  const [to, setTo] = useState(dateInputValue(settings?.fiscalYearEnd));
  const [error, setError] = useState("");
  const [updateSettings, { isLoading }] = useUpdatePainterPortalSettingsMutation();

  async function save() {
    if (Boolean(from) !== Boolean(to)) {
      setError("Set both dates, or clear both to count every point.");
      return;
    }
    setError("");
    try {
      await updateSettings({
        fiscalYearLabel: label.trim(),
        fiscalYearStart: from ? new Date(`${from}T00:00:00`).toISOString() : null,
        fiscalYearEnd: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
      }).unwrap();
      onSaved("Fiscal year saved");
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not save the fiscal year."));
    }
  }

  return (
    <div className="gift-strip-col">
      <span className="gift-strip-label">Fiscal year</span>
      <div className="gift-strip-controls">
        <input
          className="gift-inline-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="2083/84"
          aria-label="Fiscal year label"
          style={{ width: 92 }}
        />
        <AppleDateField value={from} onChange={setFrom} />
        <span className="gift-strip-dash" aria-hidden="true">–</span>
        <AppleDateField value={to} onChange={setTo} />
        <PrimaryButton onClick={save} disabled={isLoading} icon="check">
          {isLoading ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
      <p className="gift-strip-note">
        {from && to ? "Only points earned in this range count." : "No range set — every point ever earned counts."}
      </p>
      {error ? (
        <div className="admin-coupons-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function PortalLinkPanel() {
  const [qr, setQr] = useState("");
  const url = portalUrl();

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((data) => {
        if (alive) setQr(data);
      })
      .catch(() => {
        if (alive) setQr("");
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="gift-strip-col gift-strip-qr">
      <span className="gift-strip-label">Portal QR</span>
      <div className="gift-qr-row">
        {qr ? (
          <img src={qr} alt="QR code for the painter portal" width={72} height={72} />
        ) : (
          <span className="gift-qr-empty" />
        )}
        <div className="gift-qr-side">
          <code>{url}</code>
          <div className="gift-qr-actions">
            <IconButton icon="copy" label="Copy link" onClick={() => navigator.clipboard?.writeText(url)} />
            {qr ? (
              <a
                href={qr}
                download="meitu-painter-portal-qr.png"
                className="gift-icon-btn"
                aria-label="Download QR"
                title="Download QR"
              >
                <DashboardIcon name="download" size={15} strokeWidth={1.9} />
              </a>
            ) : null}
            <a href={url} target="_blank" rel="noreferrer" className="gift-icon-btn" aria-label="Open portal" title="Open portal">
              <DashboardIcon name="eye" size={15} strokeWidth={1.9} />
            </a>
          </div>
        </div>
      </div>
      <p className="gift-strip-note">Print on cards and posters.</p>
    </div>
  );
}

export default function GiftsTab() {
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const giftsQuery = useGetGiftsQuery({});
  const settingsQuery = useGetPainterPortalSettingsQuery();
  const [updateGift] = useUpdateGiftMutation();
  const [deleteGift] = useDeleteGiftMutation();

  const gifts = useMemo(() => giftsQuery.data?.items || [], [giftsQuery.data]);
  const loadError = giftsQuery.error ? getQueryErrorMessage(giftsQuery.error, "Failed to load gifts.") : "";

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  async function toggleActive(gift) {
    try {
      await updateGift({ giftId: gift._id, isActive: !gift.isActive }).unwrap();
      setToast(gift.isActive ? "Hidden from the portal" : "Showing on the portal");
    } catch (err) {
      setToast(getQueryErrorMessage(err, "Could not update this gift."));
    }
  }

  async function removeGift(gift) {
    if (!window.confirm(`Remove "${gift.name}" from the gift list?`)) return;
    try {
      await deleteGift(gift._id).unwrap();
      setToast("Gift removed");
    } catch (err) {
      setToast(getQueryErrorMessage(err, "Could not remove this gift."));
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "gift",
        header: "Gift",
        render: (row) => (
          <span className="gift-cell">
            <span className="gift-thumb">
              {row.image?.url ? <img src={row.image.url} alt="" /> : <DashboardIcon name="gift" size={15} strokeWidth={1.8} />}
            </span>
            <span className="gift-names">
              <span className="gift-name">{row.name}</span>
              {row.nameNepali ? <span className="gift-name-ne">{row.nameNepali}</span> : null}
            </span>
          </span>
        ),
      },
      {
        key: "points",
        header: "Points",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => <span style={{ fontWeight: 600 }}>{Number(row.pointsRequired || 0).toLocaleString()}</span>,
      },
      {
        key: "state",
        header: "On portal",
        // The pill is the control: one tap is the whole interaction, rather
        // than a chip that reports and a button beside it that acts.
        render: (row) => (
          <button
            type="button"
            className={`gift-toggle ${row.isActive ? "is-on" : ""}`}
            aria-pressed={row.isActive}
            onClick={(event) => {
              event.stopPropagation();
              toggleActive(row);
            }}
            title={row.isActive ? "Hide from the portal" : "Show on the portal"}
          >
            <span className="gift-toggle-dot" aria-hidden="true" />
            {row.isActive ? "Showing" : "Hidden"}
          </button>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        mobileSlot: "actions",
        render: (row) => (
          <span className="gift-actions" onClick={(event) => event.stopPropagation()}>
            <IconButton icon="edit" label={`Edit ${row.name}`} onClick={() => setEditing(row)} />
            <IconButton icon="trash" label={`Remove ${row.name}`} tone="is-danger" onClick={() => removeGift(row)} />
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="gift-tab">
      <GiftsTabStyles />

      <Surface padding={16} className="gift-strip">
        <FiscalYearPanel
          key={`${settingsQuery.data?.fiscalYearLabel || ""}|${settingsQuery.data?.fiscalYearStart || ""}|${settingsQuery.data?.fiscalYearEnd || ""}`}
          settings={settingsQuery.data}
          onSaved={setToast}
        />
        <span className="gift-strip-divider" aria-hidden="true" />
        <PortalLinkPanel />
      </Surface>

      <div className="gift-tab-bar">
        <span className="gift-count">
          {gifts.length} {gifts.length === 1 ? "gift" : "gifts"} · cheapest first
        </span>
        <PrimaryButton icon="plus" onClick={() => setEditing({})}>
          Add gift
        </PrimaryButton>
      </div>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : (
        <DataTable
          columns={columns}
          rows={gifts}
          getRowKey={(row) => String(row._id)}
          loading={giftsQuery.isLoading && !giftsQuery.data}
          emptyState={{
            icon: "gift",
            title: "No gifts yet",
            subtitle: "Add what painters are working towards, and the points each one needs.",
          }}
          minWidth={620}
        />
      )}

      {editing ? (
        <GiftFormModal gift={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={setToast} />
      ) : null}

      {toast ? <div className="gift-toast">{toast}</div> : null}
    </div>
  );
}

function GiftsTabStyles() {
  return (
    <style>{`
      .gift-tab{ display:grid; gap:14px; }

      /* --- settings strip: two compact columns in one card, not two panels --- */
      .gift-strip{ display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; }
      .gift-strip-col{ display:grid; gap:8px; min-width:0; flex:1 1 340px; }
      .gift-strip-qr{ flex:1 1 250px; }
      .gift-strip-divider{ align-self:stretch; width:1px; background:rgba(232,232,237,.9); }
      .gift-strip-label{
        font-size:11px; font-weight:700; letter-spacing:.02em; text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .gift-strip-controls{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .gift-strip-dash{ color:var(--color-graphite,#707070); }
      .gift-strip-note{ margin:0; font-size:12px; color:var(--color-graphite,#707070); }

      .gift-inline-input,
      .gift-field input:not([type="file"]):not([type="checkbox"]){
        height:38px; padding:0 12px; border-radius:12px;
        border:1px solid rgba(29,29,31,.14); background:#fff;
        font:inherit; font-size:13.5px; color:var(--color-ink,#1d1d1f);
        transition:border-color .14s ease, box-shadow .14s ease;
      }
      .gift-inline-input:focus, .gift-field input:focus{
        outline:none; border-color:var(--color-azure,#0071e3); box-shadow:0 0 0 3px rgba(0,113,227,.14);
      }

      .gift-qr-row{ display:flex; align-items:center; gap:12px; }
      .gift-qr-row img{ border-radius:10px; border:1px solid rgba(232,232,237,.9); flex:none; }
      .gift-qr-empty{ width:72px; height:72px; border-radius:10px; background:var(--color-fog,#f5f5f7); flex:none; }
      .gift-qr-side{ display:grid; gap:7px; min-width:0; }
      .gift-qr-side code{ font-size:12px; font-weight:600; color:var(--color-slate,#474747); word-break:break-all; }
      .gift-qr-actions{ display:flex; gap:6px; }

      /* --- icon actions: one glyph instead of a row of labelled buttons --- */
      .gift-icon-btn{
        width:30px; height:30px; flex:none;
        display:inline-grid; place-items:center;
        border:1px solid rgba(232,232,237,.9); border-radius:9px;
        background:#fff; color:var(--color-slate,#474747); cursor:pointer; text-decoration:none;
        transition:background .14s ease, color .14s ease, border-color .14s ease,
                   transform .14s var(--ease-out, cubic-bezier(.23,1,.32,1));
      }
      .gift-icon-btn:hover{ background:var(--color-fog,#f5f5f7); color:var(--color-ink,#1d1d1f); }
      .gift-icon-btn:active{ transform:scale(.94); }
      .gift-icon-btn:focus-visible{ outline:2px solid rgba(0,113,227,.36); outline-offset:2px; }
      .gift-icon-btn.is-danger:hover{ background:rgba(180,35,24,.08); color:#b42318; border-color:rgba(180,35,24,.2); }
      .gift-actions{ display:inline-flex; gap:6px; }

      /* --- table --- */
      .gift-tab-bar{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .gift-count{ font-size:12.5px; font-weight:500; color:var(--color-graphite,#707070); }
      .gift-cell{ display:flex; align-items:center; gap:10px; min-width:0; }
      .gift-thumb{
        width:34px; height:34px; flex:none; border-radius:9px; overflow:hidden;
        background:var(--color-fog,#f5f5f7); display:grid; place-items:center;
        color:var(--color-graphite,#707070);
      }
      .gift-thumb img{ width:100%; height:100%; object-fit:cover; }
      .gift-names{ display:grid; gap:1px; min-width:0; }
      .gift-name{ font-weight:600; }
      .gift-name-ne{ font-size:12px; color:var(--color-graphite,#707070); }

      .gift-toggle{
        display:inline-flex; align-items:center; gap:6px;
        height:26px; padding:0 11px; border-radius:999px;
        border:0; background:rgba(29,29,31,.06); color:var(--color-slate,#474747);
        font:inherit; font-size:12px; font-weight:600; cursor:pointer;
        transition:background .14s ease, color .14s ease,
                   transform .14s var(--ease-out, cubic-bezier(.23,1,.32,1));
      }
      .gift-toggle-dot{
        width:6px; height:6px; border-radius:999px; background:currentColor; opacity:.45;
        transition:opacity .14s ease;
      }
      .gift-toggle.is-on{ background:rgba(21,128,61,.1); color:#15803d; }
      .gift-toggle.is-on .gift-toggle-dot{ opacity:1; }
      .gift-toggle:hover{ background:rgba(29,29,31,.1); }
      .gift-toggle.is-on:hover{ background:rgba(21,128,61,.16); }
      .gift-toggle:active{ transform:scale(.96); }
      .gift-toggle:focus-visible{ outline:2px solid rgba(0,113,227,.36); outline-offset:2px; }

      /* --- modal --- */
      .gift-modal-backdrop{
        position:fixed; inset:0; z-index:1400; display:grid; place-items:center; padding:24px;
        background:rgba(0,0,0,.4); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
      }
      .gift-modal-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .gift-modal-head h3{ margin:0; font-size:18px; font-weight:700; letter-spacing:-.015em; }
      .gift-form{ margin-top:16px; display:grid; gap:12px; }
      .gift-row-2{ display:grid; grid-template-columns:1fr 110px; gap:10px; }
      .gift-field{ display:grid; gap:5px; }
      .gift-field > span{
        font-size:11px; font-weight:700; letter-spacing:.02em; text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .gift-field input[type="file"]{ font:inherit; font-size:12.5px; }
      .gift-check{ display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:500; }
      .gift-check input{ width:16px; height:16px; accent-color:var(--color-azure,#0071e3); }
      .gift-modal-foot{ display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }

      .gift-toast{
        position:fixed; left:50%; bottom:24px; transform:translateX(-50%);
        z-index:1600; padding:10px 16px; border-radius:999px;
        background:rgba(29,29,31,.92); color:#fff; font-size:13px; font-weight:600;
        /* It confirms, it never blocks: a row under it stays clickable. */
        pointer-events:none;
        animation:giftToastIn .16s var(--ease-out, cubic-bezier(.23,1,.32,1));
      }
      @keyframes giftToastIn{ from{ opacity:0; transform:translate(-50%, 6px); } }

      @media (max-width: 760px){
        .gift-strip-divider{ display:none; }
        .gift-row-2{ grid-template-columns:1fr; }
      }
      @media (prefers-reduced-motion: reduce){
        .gift-toast{ animation:none; }
        .gift-icon-btn, .gift-toggle, .gift-inline-input, .gift-field input{ transition:none!important; }
      }
    `}</style>
  );
}
