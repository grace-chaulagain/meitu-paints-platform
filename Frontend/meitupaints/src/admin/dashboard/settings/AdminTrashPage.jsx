import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

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
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function urgencyTone(daysRemaining) {
  const days = Number(daysRemaining ?? 0);
  if (days <= 7) return "critical";
  if (days <= 14) return "caution";
  return "neutral";
}

function TrashItem({ item, busy, onRestore }) {
  const meta = TYPE_META[item.type] || { label: item.type || "Item", icon: "trash" };
  const busyKey = `restore-${item.type}-${item.id}`;

  return (
    <Surface padding={18}>
      <div style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", gap: 14, alignItems: "start" }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "var(--color-fog, #f5f5f7)",
            color: "var(--color-graphite, #707070)",
          }}
        >
          <DashboardIcon name={meta.icon} size={16} strokeWidth={1.8} />
        </span>

        <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill tone="neutral" size="small">{meta.label}</Pill>
            <Pill tone={urgencyTone(item.daysRemaining)} size="small">
              {Number(item.daysRemaining ?? 0)} days left
            </Pill>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-ink, #1d1d1f)" }}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {item.subtitle}
            </div>
          ) : null}
          {item.reason ? (
            <div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Reason: {item.reason}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Deleted {formatDate(item.requestedAt)}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Permanent after {formatDate(item.deleteAfter)}
            </span>
          </div>
        </div>

        <GhostButton icon="history" onClick={() => onRestore(item)} disabled={busy === busyKey}>
          {busy === busyKey ? "Restoring…" : "Restore"}
        </GhostButton>
      </div>
    </Surface>
  );
}

export default function AdminTrashPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("ALL");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [restoreItem, setRestoreItem] = useState(null);
  const [restoreAllOpen, setRestoreAllOpen] = useState(false);
  const [clearTrashOpen, setClearTrashOpen] = useState(false);
  const [clearTrashConfirmText, setClearTrashConfirmText] = useState("");

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/settings/trash", {
        params: { type: filter },
      });
      setItems(res?.data?.items || []);
      setCounts(res?.data?.counts || {});
      setRetentionDays(res?.data?.retentionDays || 30);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load trash.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const activeFilterLabel = useMemo(() => {
    return FILTERS.find((item) => item.key === filter)?.label || "Trash";
  }, [filter]);

  async function restoreSingle(item) {
    try {
      setBusyAction(`restore-${item.type}-${item.id}`);
      setError("");
      setSuccess("");
      await api.post(`/api/admin/settings/trash/${item.type}/${item.id}/restore`);
      setRestoreItem(null);
      setSuccess(`${item.title} restored.`);
      await loadTrash();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to restore item.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function clearTrash() {
    try {
      setBusyAction("clear-trash");
      setError("");
      setSuccess("");
      const res = await api.post("/api/admin/settings/trash/clear", {
        type: filter,
        confirmation: clearTrashConfirmText,
      });
      setClearTrashOpen(false);
      setClearTrashConfirmText("");
      setSuccess(
        `${res?.data?.purgedCount || 0} item${
          Number(res?.data?.purgedCount || 0) === 1 ? "" : "s"
        } permanently deleted.`,
      );
      await loadTrash();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to clear trash.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function restoreAll() {
    try {
      setBusyAction("restore-all");
      setError("");
      setSuccess("");
      const res = await api.post("/api/admin/settings/trash/restore-all", {
        type: filter,
      });
      setRestoreAllOpen(false);
      setSuccess(
        `${res?.data?.restoredCount || 0} item${
          Number(res?.data?.restoredCount || 0) === 1 ? "" : "s"
        } restored.`,
      );
      await loadTrash();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to restore trash.",
      );
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Settings"
          icon="trash"
          title="Trash"
          subtitle={`Deleted admin records remain restorable for ${retentionDays} days before permanent database removal.`}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <GhostButton icon="gear" onClick={() => navigate("/admin/dashboard/settings")}>
                Settings
              </GhostButton>
              <GhostButton icon="refresh" onClick={loadTrash} disabled={loading}>
                Refresh
              </GhostButton>
              <GhostButton
                icon="trash"
                danger
                onClick={() => setClearTrashOpen(true)}
                disabled={!items.length || Boolean(busyAction)}
              >
                Clear Trash
              </GhostButton>
              <PrimaryButton
                icon="checkmark"
                onClick={() => setRestoreAllOpen(true)}
                disabled={!items.length || Boolean(busyAction)}
              >
                Restore All
              </PrimaryButton>
            </div>
          }
        />

        <div style={{ marginTop: 16 }}>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((option) => ({ ...option, count: counts[option.key] || 0 }))}
          />
        </div>

        {(error || success) ? (
          <div
            style={{
              marginTop: 14,
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

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Surface key={index} padding={18}>
              <div
                style={{
                  height: 76,
                  borderRadius: 12,
                  background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            </Surface>
          ))}
        </div>
      ) : items.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <TrashItem
              key={`${item.type}-${item.id}`}
              item={item}
              busy={busyAction}
              onRestore={setRestoreItem}
            />
          ))}
        </div>
      ) : (
        <Surface padding={28} style={{ textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              margin: "0 auto",
              display: "grid",
              placeItems: "center",
              background: "var(--color-fog, #f5f5f7)",
              color: "var(--color-graphite, #707070)",
            }}
          >
            <DashboardIcon name="checkmark" size={19} strokeWidth={1.8} />
          </div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            Trash is clear
          </div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            No deleted {activeFilterLabel.toLowerCase()} are currently awaiting permanent removal.
          </div>
        </Surface>
      )}

      <AdminDecisionModal
        open={Boolean(restoreItem)}
        title="Restore deleted item?"
        subtitle="This will return the item to its original workspace and remove it from Trash."
        confirmLabel="Restore Item"
        busy={restoreItem ? busyAction === `restore-${restoreItem.type}-${restoreItem.id}` : false}
        details={[
          { label: "Type", value: TYPE_META[restoreItem?.type]?.label || restoreItem?.type },
          { label: "Item", value: restoreItem?.title },
          { label: "Permanent after", value: formatDate(restoreItem?.deleteAfter) },
        ]}
        onClose={() => {
          if (!busyAction) setRestoreItem(null);
        }}
        onConfirm={() => restoreSingle(restoreItem)}
      />

      <AdminDecisionModal
        open={restoreAllOpen}
        title="Restore all visible trash?"
        subtitle={`This restores every item currently shown in the ${activeFilterLabel} trash view.`}
        confirmLabel="Restore All"
        busy={busyAction === "restore-all"}
        disabled={!items.length}
        details={[
          { label: "Scope", value: activeFilterLabel },
          { label: "Items", value: String(items.length) },
          { label: "Retention", value: `${retentionDays} days` },
        ]}
        onClose={() => {
          if (!busyAction) setRestoreAllOpen(false);
        }}
        onConfirm={restoreAll}
      />

      <AdminDecisionModal
        open={clearTrashOpen}
        tone="danger"
        title="Permanently clear trash?"
        subtitle={`This immediately and permanently deletes every item currently shown in the ${activeFilterLabel} trash view from the database. This cannot be undone — it does not wait for the ${retentionDays}-day recovery window.`}
        confirmLabel="Clear Trash Forever"
        requireText="CLEAR TRASH"
        confirmationText={clearTrashConfirmText}
        onConfirmationTextChange={setClearTrashConfirmText}
        busy={busyAction === "clear-trash"}
        disabled={!items.length}
        details={[
          { label: "Scope", value: activeFilterLabel },
          { label: "Items", value: String(items.length) },
        ]}
        onClose={() => {
          if (!busyAction) {
            setClearTrashOpen(false);
            setClearTrashConfirmText("");
          }
        }}
        onConfirm={clearTrash}
      />
    </div>
  );
}
