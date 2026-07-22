import { useState } from "react";

const ROLE_LABEL = { ADMIN: "the Admin", DISPATCHER: "the Dispatcher", FACTORY: "the Factory" };

function actorPhrase(role) {
  return ROLE_LABEL[role] || "someone";
}

function relativeTime(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function absoluteTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function sumQuantities(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  return total > 0 ? total : null;
}

// Pure derivation, newest first - every row here corresponds to a real
// timestamp already persisted on the order, never a synthesized "N/A" row
// (§2.2: missing timestamps render nothing). Field names verified directly
// against Order.model.js - notably `dispatchPrep.proformaGeneratedAt` (not
// `fulfillment.*`) and `externalArchives.googleSheets.appendedAt` (not
// `googleSheetsArchive.*`).
function deriveEvents(order) {
  if (!order) return [];
  const events = [];

  if (order.createdAt) {
    const placedBy = order.dealerSnapshot?.companyName || order.dealerSnapshot?.contactName || "the dealer";
    events.push({ key: "created", at: order.createdAt, text: `Placed by ${placedBy}` });
  }

  for (const amendment of order.amendments || []) {
    if (!amendment?.amendedAt) continue;
    const detail = amendment.reason || amendment.note || "details updated";
    events.push({
      key: `amend-${amendment.amendedAt}-${amendment.amendedByUserId || ""}`,
      at: amendment.amendedAt,
      text: `Amended by ${actorPhrase(amendment.amendedByRole)} · ${detail}`,
    });
  }

  // A rejection also stamps review.* (same action) - render the more
  // specific rejection row only, never both for the same moment.
  if (order.rejection?.rejectedAt) {
    const reason = order.rejection.reason ? ` — ${order.rejection.reason}` : "";
    events.push({
      key: "rejected",
      at: order.rejection.rejectedAt,
      text: `Rejected by ${actorPhrase(order.rejection.rejectedByRole)}${reason}`,
    });
  } else if (order.review?.reviewedAt) {
    events.push({ key: "reviewed", at: order.review.reviewedAt, text: `Verified by ${actorPhrase(order.review.reviewedByRole)}` });
  }

  // Phase 6 fields - harmless no-op until the backend adds them.
  if (order.unverifiedAt) {
    events.push({ key: "unverified", at: order.unverifiedAt, text: "Verification reverted by the Admin" });
  }

  if (order.stockReservation?.reservedAt) {
    const qty = sumQuantities(order.stockReservation.items);
    events.push({ key: "reserved", at: order.stockReservation.reservedAt, text: qty ? `${qty} units reserved` : "Stock reserved" });
  }
  if (order.stockReservation?.releasedAt) {
    events.push({ key: "released", at: order.stockReservation.releasedAt, text: "Reserved stock released" });
  }
  if (order.stockReservation?.consumedAt) {
    events.push({ key: "consumed", at: order.stockReservation.consumedAt, text: "Reserved stock consumed" });
  }

  if (order.dispatchPrep?.proformaGeneratedAt) {
    events.push({ key: "proforma", at: order.dispatchPrep.proformaGeneratedAt, text: "Proforma Invoice generated" });
  }

  if (order.factory?.outForDeliveryAt) {
    // Used to say "Delivered" for dispatcher-mode orders (dispatch WAS
    // delivery, 3-stage lifecycle) - now that dispatch and delivery are
    // separate, owned stages for both fulfillment modes, this event means
    // the same thing either way: it left for the dealer, not yet confirmed
    // received (that's the separate factory.deliveredAt event below).
    const driver = order.factory.driverName ? ` — ${order.factory.driverName}${order.factory.vehicleNumber ? `, ${order.factory.vehicleNumber}` : ""}` : "";
    events.push({
      key: "dispatched",
      at: order.factory.outForDeliveryAt,
      text: `Dispatched${driver}`,
    });
  }
  if (order.factory?.deliveredAt) {
    events.push({ key: "delivered", at: order.factory.deliveredAt, text: "Marked delivered" });
  }

  if (order.closedAt) {
    events.push({ key: "closed", at: order.closedAt, text: "Closed for reconciliation" });
  }
  if (order.archivedAt) {
    events.push({ key: "archived", at: order.archivedAt, text: "Archived" });
  }
  if (order.externalArchives?.googleSheets?.appendedAt) {
    events.push({ key: "sheets", at: order.externalArchives.googleSheets.appendedAt, text: "Synced to records archive", muted: true });
  }

  return events
    .filter((event) => event.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function OrderEventFeed({ order, limit }) {
  const [expanded, setExpanded] = useState(false);
  const events = deriveEvents(order);
  if (events.length === 0) return null;

  const hasOverflow = Boolean(limit) && events.length > limit;
  const visible = hasOverflow ? events.slice(0, limit) : events;
  const overflow = hasOverflow ? events.slice(limit) : [];

  return (
    <div className="orderflow-feed">
      {visible.map((event) => (
        <EventRow key={event.key} event={event} />
      ))}
      {hasOverflow ? (
        <>
          <div className="orderflow-feed-collapse" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
            <div className="orderflow-feed-collapse-inner">
              {overflow.map((event) => (
                <EventRow key={event.key} event={event} />
              ))}
            </div>
          </div>
          <button type="button" className="orderflow-feed-toggle" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `Show full history (${events.length})`}
          </button>
        </>
      ) : null}
    </div>
  );
}

function EventRow({ event }) {
  return (
    <div className={`orderflow-feed-row ${event.muted ? "orderflow-feed-row-muted" : ""}`}>
      <span className="orderflow-feed-time" title={absoluteTime(event.at)}>
        {relativeTime(event.at)}
      </span>
      <span className="orderflow-feed-text">{event.text}</span>
    </div>
  );
}

export function OrderEventFeedStyles() {
  return (
    <style>{`
      .orderflow-feed{ display:flex; flex-direction:column; }
      .orderflow-feed-row{
        display:grid;
        grid-template-columns:64px 1fr;
        gap:12px;
        padding:8px 0;
        border-top:1px solid rgba(29,29,31,.06);
      }
      .orderflow-feed-row:first-child{ border-top:none; }
      .orderflow-feed-time{
        font-size:12px;
        color:var(--color-graphite, #707070);
        white-space:nowrap;
      }
      .orderflow-feed-text{ font-size:14px; color:var(--color-ink, #1d1d1f); line-height:1.4; }
      .orderflow-feed-row-muted .orderflow-feed-text{ color:var(--color-graphite, #707070); }

      .orderflow-feed-collapse{
        display:grid;
        transition:grid-template-rows 260ms var(--ease-in-out-strong, ease);
      }
      .orderflow-feed-collapse-inner{ overflow:hidden; min-height:0; }

      .orderflow-feed-toggle{
        margin-top:6px;
        align-self:flex-start;
        border:none;
        background:none;
        padding:4px 0;
        font-size:12.5px;
        font-weight:600;
        color:var(--color-azure, #0071e3);
        cursor:pointer;
      }

      @media (prefers-reduced-motion: reduce){
        .orderflow-feed-collapse{ transition:none; }
      }
    `}</style>
  );
}
