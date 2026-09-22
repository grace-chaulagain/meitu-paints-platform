import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { Pill, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField } from "../../../components/dashboard/ApplePickers.jsx";
import { dateRangeLabel, formatFilterDate, formatMoney, formatQty, isoDateKey, orderStatusTone } from "./salesPurchasesFormat.js";

// The pieces the dealer and dispatcher Sales & Purchases pages are built
// from. Both pages render these, so they look and behave the same; each page
// only supplies its own data. Lifted unchanged from the dealer page.

export function SalesPurchasesBackButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="admin-sp-back">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {children}
    </button>
  );
}

// A full-width, high-contrast section divider for DataTable's
// renderGroupHeader - the shared component's own default group-row styling
// (12px muted-gray caption text on a transparent background) reads as a
// footnote, not a section break, which is exactly why grouping by category
// was unreadable with more than a couple of groups on screen. Scoped to these
// pages via the .admin-sp-datatable wrapper class in SalesPurchasesStyles,
// rather than changing DataTable's shared CSS, since other pages already use
// that component's default grouping successfully for lower-group-count cases.
export function GroupHeaderRow({ label, count, countLabel }) {
  return (
    <div className="admin-sp-group-header">
      <span>{label}</span>
      {count ? <span className="admin-sp-group-count">{count} {countLabel}{count === 1 ? "" : "s"}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range control - the applied range is always the control's own visible
// label (never hidden behind an icon-only trigger), with a one-tap clear and
// a set of one-click presets for the common cases. Custom start/end dates
// remain available in the same popover for anything else.
//
// Rendered through a portal into document.body (position computed from the
// trigger's own getBoundingClientRect) rather than as a plain absolutely-
// positioned descendant. Every "dash-fade-up" card on these pages keeps a
// non-"none" `transform` after its entrance animation finishes (animation-
// fill-mode: both holding the final keyframe), and a transform other than
// none always creates a new CSS stacking context - so a plain z-index on a
// popover nested inside the header card could never out-rank a sibling card
// lower in the DOM. Escaping to document.body sidesteps that entirely.
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
];

export function DateRangeControl({ from, to, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [position, setPosition] = useState(null);
  const active = Boolean(from || to);
  const triggerRef = useRef(null);
  // Plain string comparison is safe here - both are "YYYY-MM-DD" keys, which
  // sort lexicographically the same as chronologically.
  const invalidRange = Boolean(draftFrom && draftTo && draftTo < draftFrom);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const viewportPadding = 12;
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    setPosition({ left, top: rect.bottom + 8, width });
  }, []);

  function closePopover() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPopover() {
    setDraftFrom(from);
    setDraftTo(to);
    updatePosition();
    setOpen(true);
  }

  function applyCustom() {
    onApply(draftFrom, draftTo);
    closePopover();
  }

  function applyPreset(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    onApply(isoDateKey(start), isoDateKey(end));
    closePopover();
  }

  function clear() {
    setDraftFrom("");
    setDraftTo("");
    onClear();
    closePopover();
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePopover();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div className="admin-sp-daterange">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : openPopover())}
        aria-label="Filter by date range"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`admin-sp-daterange-trigger ${active ? "is-active" : ""}`}
      >
        <DashboardIcon name="calendar" size={14} strokeWidth={1.9} />
        <span>{active ? dateRangeLabel(from, to) : "All time"}</span>
      </button>

      {active ? (
        <button
          type="button"
          className="admin-sp-daterange-clear"
          aria-label="Clear date filter"
          onClick={(event) => {
            event.stopPropagation();
            clear();
          }}
        >
          <DashboardIcon name="close" size={11} strokeWidth={2.6} />
        </button>
      ) : null}

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={closePopover} />
              <div
                className="admin-sp-filter-pop"
                role="dialog"
                aria-label="Filter by date range"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-sp-filter-presets">
                  {DATE_PRESETS.map((preset) => (
                    <button key={preset.key} type="button" onClick={() => applyPreset(preset.days)}>
                      {preset.label}
                    </button>
                  ))}
                  <button type="button" onClick={clear}>
                    All Time
                  </button>
                </div>

                <div className="admin-sp-filter-pop-title">Or pick a custom range</div>

                <label className="admin-sp-filter-field">
                  <span>Start date</span>
                  <AppleDateField value={draftFrom || ""} onChange={setDraftFrom} />
                </label>
                <label className="admin-sp-filter-field">
                  <span>End date</span>
                  <AppleDateField value={draftTo || ""} onChange={setDraftTo} />
                </label>
                {invalidRange ? (
                  <div className="admin-sp-filter-pop-error">End date can&apos;t be before the start date.</div>
                ) : null}

                <div className="admin-sp-filter-pop-actions">
                  <PrimaryButton
                    onClick={applyCustom}
                    disabled={!draftFrom || !draftTo || invalidRange}
                    style={{ height: 34, padding: "0 14px", fontSize: 12.5, width: "100%" }}
                  >
                    Apply Range
                  </PrimaryButton>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History preview modals - a lightweight read-only look at one entry without
// leaving the page. Kept, since navigating away just to check what was in an
// order is real friction on a page whose entire point is quick review.
// ---------------------------------------------------------------------------

export function HistoryModalShell({ children, onClose, width = 560 }) {
  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: `min(${width}px, 100%)`, maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        {children}
      </Surface>
    </div>
  );
}

export function HistoryCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

// `party` names the other side of the order where it isn't obvious - the
// dispatcher pages use it for "From the Factory" / "To <dealer>".
export function HistoryOrderPreviewModal({ order, party = "", onClose }) {
  if (!order) return null;
  return (
    <HistoryModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={order.orderNumber} icon="orders" title="Order Preview" />
        <HistoryCloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pill tone={orderStatusTone(order.status)} size="small">{order.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatFilterDate((order.createdAt || "").slice(0, 10))}</span>
        {party ? <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>· {party}</span> : null}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(order.items || []).map((item, index) => (
          <div key={`${item.productId || item.sku || index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name}{item.packLabel ? ` (${item.packLabel})` : ""} × {formatQty(item.quantity)}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(order.totals?.total)}</span>
      </div>

      {order.dealerNote ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>Dealer note: {order.dealerNote}</div>
      ) : null}
    </HistoryModalShell>
  );
}

export function HistorySaleDetailModal({ sale, onClose }) {
  if (!sale) return null;
  return (
    <HistoryModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={sale.saleNumber} icon="orders" title={sale.billId ? `Bill ${sale.billId}` : "Sale"} />
        <HistoryCloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">{sale.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatFilterDate((sale.saleDate || "").slice(0, 10))}</span>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(sale.items || []).map((item, index) => (
          <div key={`${item.productId || index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name}{item.packLabel ? ` (${item.packLabel})` : ""} × {formatQty(item.quantity)}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(sale.totals?.total)}</span>
      </div>

      {sale.status === "VOIDED" ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#b42318" }}>Voided: {sale.voidReason}</div>
      ) : null}
    </HistoryModalShell>
  );
}

export function SalesPurchasesStyles() {
  return (
    <style>{`
      .admin-sp-back{
        display:inline-flex;
        align-items:center;
        gap:4px;
        border:none;
        background:transparent;
        padding:0;
        cursor:pointer;
        color:var(--color-azure, #0071e3);
        font-size:14.5px;
        font-weight:600;
        width:fit-content;
      }

      .admin-sp-daterange{
        position:relative;
        display:flex;
        align-items:center;
      }
      .admin-sp-daterange-trigger{
        display:inline-flex;
        align-items:center;
        gap:7px;
        height:38px;
        padding:0 14px;
        border-radius:999px;
        border:1px solid rgba(29,29,31,.1);
        background:rgba(255,255,255,.88);
        color:var(--color-ink, #1d1d1f);
        font-size:12.5px;
        font-weight:600;
        white-space:nowrap;
        cursor:pointer;
        transition:transform .14s var(--ease-out, cubic-bezier(.23,1,.32,1)), background .14s ease, border-color .14s ease, color .14s ease;
      }
      .admin-sp-daterange-trigger:hover{
        background:rgba(29,29,31,.05);
      }
      .admin-sp-daterange-trigger:active{
        transform:scale(.97);
      }
      .admin-sp-daterange-trigger.is-active{
        border-color:rgba(0,113,227,.32);
        background:rgba(0,113,227,.08);
        color:var(--color-azure, #0071e3);
        padding-right:30px;
      }
      .admin-sp-daterange-clear{
        position:absolute;
        right:6px;
        top:50%;
        transform:translateY(-50%);
        width:22px;
        height:22px;
        border-radius:999px;
        border:none;
        background:rgba(0,113,227,.14);
        color:var(--color-azure, #0071e3);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:background .12s ease, transform .12s var(--ease-out, ease);
      }
      .admin-sp-daterange-clear:hover{
        background:rgba(0,113,227,.24);
      }
      .admin-sp-daterange-clear:active{
        transform:translateY(-50%) scale(.88);
      }

      .admin-sp-filter-pop{
        z-index:1401;
        padding:14px;
        border-radius:16px;
        background:#fff;
        border:1px solid rgba(0,0,0,.06);
        box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
        transform-origin:top left;
        animation:adminSpFilterPopIn .16s var(--ease-out, cubic-bezier(.16,1,.3,1)) both;
      }
      @keyframes adminSpFilterPopIn{
        from{ opacity:0; transform:scale(.96) translateY(-4px); }
        to{ opacity:1; transform:scale(1) translateY(0); }
      }
      .admin-sp-filter-presets{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-bottom:12px;
      }
      .admin-sp-filter-presets button{
        height:30px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(29,29,31,.1);
        background:var(--color-fog, #f5f5f7);
        color:var(--color-ink, #1d1d1f);
        font-size:12px;
        font-weight:600;
        cursor:pointer;
        transition:background .12s ease, transform .1s ease;
      }
      .admin-sp-filter-presets button:hover{
        background:rgba(0,113,227,.1);
        color:var(--color-azure, #0071e3);
      }
      .admin-sp-filter-presets button:active{
        transform:scale(.95);
      }
      .admin-sp-filter-pop-title{
        font-size:10.5px;
        font-weight:700;
        letter-spacing:.03em;
        text-transform:uppercase;
        color:var(--color-graphite, #707070);
        margin-bottom:10px;
        padding-top:10px;
        border-top:1px solid rgba(0,0,0,.06);
      }
      .admin-sp-filter-field{
        display:grid;
        gap:4px;
        margin-bottom:10px;
      }
      .admin-sp-filter-field span{
        font-size:10.5px;
        font-weight:700;
        letter-spacing:.03em;
        text-transform:uppercase;
        color:var(--color-graphite, #707070);
      }
      .admin-sp-filter-pop-error{
        margin:-2px 0 10px;
        font-size:11px;
        font-weight:600;
        color:#b42318;
      }
      .admin-sp-filter-pop-actions{
        margin-top:4px;
      }

      @media (prefers-reduced-motion: reduce){
        .admin-sp-daterange-trigger{ transition:none!important; }
        .admin-sp-filter-pop{ animation:none!important; }
      }

      /* ---- Section (category/day) headers inside the data tables ----
         DataTable's own default group-row styling (small muted-gray
         caption text, transparent background) reads as a footnote, not a
         section break - fine for a handful of groups, unreadable once a
         catalog spans many categories. This overrides it with a
         full-width shaded band, bold ink-colored label, and a clear count
         badge - scoped to .admin-sp-datatable so no other page's tables
         are affected. */
      .admin-sp-datatable .dash-table-group-row td{
        padding:0 !important;
        background:transparent;
      }
      .admin-sp-group-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:11px 16px;
        margin-top:14px;
        background:var(--color-fog, #f5f5f7);
        border-top:1px solid rgba(0,0,0,.06);
        border-bottom:1px solid rgba(0,0,0,.06);
        font-size:12.5px;
        font-weight:800;
        letter-spacing:-.005em;
        color:var(--color-ink, #1d1d1f);
      }
      .admin-sp-datatable .dash-table-group-row:first-child .admin-sp-group-header{
        margin-top:0;
        border-top:none;
      }
      .admin-sp-group-count{
        flex-shrink:0;
        padding:2px 9px;
        border-radius:999px;
        background:rgba(0,113,227,.1);
        color:var(--color-azure, #0071e3);
        font-size:11px;
        font-weight:700;
        letter-spacing:0;
      }
    `}</style>
  );
}
