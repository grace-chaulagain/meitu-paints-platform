import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { toast } from "../../dealer/mobile/useToast.js";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "DEALER", label: "Dealers" },
  { key: "DISPATCHER", label: "Dispatchers" },
  { key: "ORDER", label: "Orders" },
  { key: "APPLICATION", label: "Applications" },
];

const TYPE_META = {
  DEALER: { label: "Dealer", icon: "store" },
  DISPATCHER: { label: "Dispatcher", icon: "handshake" },
  ORDER: { label: "Order", icon: "orders" },
  DEALER_APPLICATION: { label: "Dealer Application", icon: "inbox" },
  DISPATCHER_APPLICATION: { label: "Dispatcher Application", icon: "inbox" },
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function urgencyTone(daysRemaining) {
  const days = Number(daysRemaining ?? 0);
  if (days <= 7) return "critical";
  if (days <= 14) return "caution";
  return "neutral";
}

export function AdminTrashMobileView({ onBack }) {
  const [filter, setFilter] = useState("ALL");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [restoreItem, setRestoreItem] = useState(null);
  const [restoreAllOpen, setRestoreAllOpen] = useState(false);
  const [clearTrashOpen, setClearTrashOpen] = useState(false);
  const [clearTrashConfirmText, setClearTrashConfirmText] = useState("");

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/settings/trash", { params: { type: filter } });
      setItems(res?.data?.items || []);
      setCounts(res?.data?.counts || {});
      setRetentionDays(res?.data?.retentionDays || 30);
    } catch (err) {
      toast(err?.response?.data?.error || err?.message || "Failed to load trash.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  async function restoreSingle(item) {
    setBusyAction(`restore-${item.type}-${item.id}`);
    try {
      await api.post(`/api/admin/settings/trash/${item.type}/${item.id}/restore`);
      setRestoreItem(null);
      toast(`${item.title} restored`);
      await loadTrash();
    } catch (err) {
      toast(err?.response?.data?.error || err?.message || "Failed to restore item.");
    } finally {
      setBusyAction("");
    }
  }

  async function restoreAll() {
    setBusyAction("restore-all");
    try {
      const res = await api.post("/api/admin/settings/trash/restore-all", { type: filter });
      setRestoreAllOpen(false);
      toast(`${res?.data?.restoredCount || 0} item(s) restored`);
      await loadTrash();
    } catch (err) {
      toast(err?.response?.data?.error || err?.message || "Failed to restore trash.");
    } finally {
      setBusyAction("");
    }
  }

  async function clearTrash() {
    setBusyAction("clear-trash");
    try {
      const res = await api.post("/api/admin/settings/trash/clear", {
        type: filter,
        confirmation: clearTrashConfirmText,
      });
      setClearTrashOpen(false);
      setClearTrashConfirmText("");
      toast(`${res?.data?.purgedCount || 0} item(s) permanently deleted`);
      await loadTrash();
    } catch (err) {
      toast(err?.response?.data?.error || err?.message || "Failed to clear trash.");
    } finally {
      setBusyAction("");
    }
  }

  const clearTrashBlocked = clearTrashConfirmText.trim() !== "CLEAR TRASH";

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Trash</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
          </>
        }
      >
        <MobilePushHeader title="Trash" onBack={onBack} />

        <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
          Deleted records remain restorable for {retentionDays} days.
        </div>

        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={FILTERS.map((f) => ({ ...f, count: counts[f.key] || 0 }))} value={filter} onChange={setFilter} />
        </div>

        {items.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <PrimaryButton variant="secondary" onClick={() => setRestoreAllOpen(true)} disabled={Boolean(busyAction)}>
              Restore All Visible
            </PrimaryButton>
            <PrimaryButton variant="danger" onClick={() => setClearTrashOpen(true)} disabled={Boolean(busyAction)}>
              Clear Trash
            </PrimaryButton>
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="checkmark" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">Trash is clear</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {items.map((item) => {
              const meta = TYPE_META[item.type] || { label: item.type || "Item", icon: "trash" };
              const busyKey = `restore-${item.type}-${item.id}`;
              return (
                <div key={busyKey} className="admin-m-card">
                  <div style={{ display: "flex", gap: 10 }}>
                    <span className="admin-m-feed-icon">
                      <DashboardIcon name={meta.icon} size={16} strokeWidth={1.8} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <StatusChip tone="neutral">{meta.label}</StatusChip>
                        <StatusChip tone={urgencyTone(item.daysRemaining)}>{Number(item.daysRemaining ?? 0)} days left</StatusChip>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{item.title}</div>
                      {item.subtitle ? (
                        <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{item.subtitle}</div>
                      ) : null}
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--color-graphite, #707070)" }}>
                        Deleted {formatDate(item.requestedAt)} · Permanent after {formatDate(item.deleteAfter)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-m-image-btn"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => setRestoreItem(item)}
                    disabled={busyAction === busyKey}
                  >
                    {busyAction === busyKey ? "Restoring…" : "Restore"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SkeletonSwap>

      <MobileSheet
        open={Boolean(restoreItem)}
        onClose={() => {
          if (!busyAction) setRestoreItem(null);
        }}
        ariaLabel="Restore item"
        footer={
          <PrimaryButton loading={busyAction === `restore-${restoreItem?.type}-${restoreItem?.id}`} onClick={() => restoreSingle(restoreItem)}>
            Restore Item
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Restore this item?</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          {restoreItem?.title} will return to its original workspace and leave Trash.
        </div>
      </MobileSheet>

      <MobileSheet
        open={restoreAllOpen}
        onClose={() => {
          if (!busyAction) setRestoreAllOpen(false);
        }}
        ariaLabel="Restore all"
        footer={
          <PrimaryButton loading={busyAction === "restore-all"} onClick={restoreAll}>
            Restore All
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Restore all visible trash?</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          This restores all {items.length} item(s) currently shown in this filter.
        </div>
      </MobileSheet>

      <MobileSheet
        open={clearTrashOpen}
        onClose={() => {
          if (!busyAction) {
            setClearTrashOpen(false);
            setClearTrashConfirmText("");
          }
        }}
        ariaLabel="Clear trash"
        footer={
          <PrimaryButton
            variant="danger"
            loading={busyAction === "clear-trash"}
            disabled={clearTrashBlocked}
            onClick={clearTrash}
          >
            Clear Trash Forever
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Permanently clear trash?</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          This immediately and permanently deletes all {items.length} item(s) currently shown in this
          filter from the database. This cannot be undone — it does not wait for the {retentionDays}-day
          recovery window.
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
            Type <strong style={{ color: "var(--color-ink, #1d1d1f)" }}>CLEAR TRASH</strong> to confirm.
          </div>
          <input
            value={clearTrashConfirmText}
            onChange={(e) => setClearTrashConfirmText(e.target.value)}
            disabled={busyAction === "clear-trash"}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(29,29,31,.1)",
              background: "var(--color-fog, #f5f5f7)",
              padding: "0 14px",
              outline: "none",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-ink, #1d1d1f)",
            }}
          />
        </div>
      </MobileSheet>
    </div>
  );
}
