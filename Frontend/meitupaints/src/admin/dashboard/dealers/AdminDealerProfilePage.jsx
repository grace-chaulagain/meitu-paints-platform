import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAssignDispatcherToDealerMutation,
  useGetAdminDealerAnalyticsQuery,
  useGetAdminDealerQuery,
  useGetVerifiedDispatchersQuery,
  useResendDealerSetupEmailMutation,
  useUnassignDispatcherFromDealerMutation,
  useUpdateAdminDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useUpdateAdminDealerStatusMutation,
} from "../../../redux/api/meituApi.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";

const ROUTING_MODES = [
  { value: "FACTORY", label: "Factory" },
  { value: "DISPATCHER", label: "Dispatcher" },
];

const HEALTH_SCORE_INFO = {
  title: "Dealer health score",
  summary:
    "A 0-100 operational health reading that helps admin judge whether a dealer is active, reliable, and growing.",
  sections: [
    {
      title: "What affects it",
      items: [
        "Approved order count raises the score as the dealer builds a verified order record.",
        "Recent ordering improves the score; long inactivity reduces it.",
        "Strong 30-day revenue growth improves it, while a sharp drop reduces it.",
        "High approval rate improves it; frequent rejection reduces it.",
        "Heavy dependence on one product slightly reduces it because the account is less balanced.",
      ],
    },
    {
      title: "Dealer tier",
      items: [
        "Platinum: NPR 1,000,000+ approved sales or 20+ approved orders.",
        "Gold: NPR 500,000+ approved sales or 12+ approved orders.",
        "Silver: NPR 150,000+ approved sales or 5+ approved orders.",
        "Developing: has approved orders but is below Silver volume.",
        "Unproven: no approved orders yet.",
      ],
    },
    {
      title: "How to use it",
      items: [
        "High score with Developing tier means the dealer is healthy but still growing in total volume.",
        "Low score means admin should review recent inactivity, rejections, or product concentration.",
      ],
    },
  ],
};

function GlassCard({ children, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, action = null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 950,
            letterSpacing: "-0.03em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 700,
              color: "rgba(15,23,42,.58)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, helper = "", accent = false, info = null }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const infoButtonRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePopoverPosition = useCallback(() => {
    const rect = infoButtonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 16;
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const rightSideLeft = rect.right + 12;
    const left =
      rightSideLeft + width <= window.innerWidth - viewportPadding
        ? rightSideLeft
        : Math.max(viewportPadding, rect.left - width - 12);
    const estimatedHeight = Math.min(460, window.innerHeight - viewportPadding * 2);
    const top = Math.max(
      viewportPadding,
      Math.min(rect.top - 8, window.innerHeight - viewportPadding - estimatedHeight),
    );
    const maxHeight = Math.max(
      180,
      Math.min(460, window.innerHeight - top - viewportPadding),
    );

    setPopoverPosition({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!infoOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      if (
        popoverRef.current?.contains(target) ||
        infoButtonRef.current?.contains(target)
      ) {
        return;
      }
      setInfoOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [infoOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!infoOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setInfoOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [infoOpen]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: "16px 18px",
        background: accent ? "rgba(180,35,24,.06)" : "rgba(248,250,252,.95)",
        border: accent
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "rgba(15,23,42,.46)",
          }}
        >
          {label}
        </div>
        {info ? (
          <button
            ref={infoButtonRef}
            type="button"
            aria-label={`About ${label}`}
            aria-expanded={infoOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoOpen((current) => {
                const next = !current;
                if (next) requestAnimationFrame(updatePopoverPosition);
                return next;
              });
            }}
            style={{
              width: 25,
              height: 25,
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,.12)",
              background: "#fff",
              color: accent ? "#b42318" : "#475569",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(15,23,42,.05)",
            }}
          >
            i
          </button>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
      {helper ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(15,23,42,.54)",
          }}
        >
          {helper}
        </div>
      ) : null}
      {info && infoOpen && popoverPosition && typeof document !== "undefined"
        ? createPortal(
              <div
                ref={popoverRef}
                role="dialog"
                aria-label={`${label} details`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: popoverPosition.top,
                  left: popoverPosition.left,
                  zIndex: 9999,
                  width: popoverPosition.width,
                  maxHeight: popoverPosition.maxHeight,
                  overflow: "auto",
                  overscrollBehavior: "contain",
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(15,23,42,.12)",
                  background: "#fff",
                  boxShadow: "0 22px 60px rgba(15,23,42,.22)",
                  color: "#0f172a",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 950 }}>
                      {info.title}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12,
                        lineHeight: 1.5,
                        fontWeight: 750,
                        color: "rgba(15,23,42,.62)",
                      }}
                    >
                      {info.summary}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close health score details"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInfoOpen(false);
                    }}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "rgba(15,23,42,.48)",
                      fontSize: 18,
                      lineHeight: 1,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {(info.sections || []).map((section) => (
                    <div key={section.title}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 950,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          color: "rgba(15,23,42,.48)",
                        }}
                      >
                        {section.title}
                      </div>
                      <ul
                        style={{
                          margin: "7px 0 0",
                          paddingLeft: 16,
                          display: "grid",
                          gap: 5,
                          fontSize: 12,
                          lineHeight: 1.42,
                          fontWeight: 750,
                          color: "rgba(15,23,42,.68)",
                        }}
                      >
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  subtle = false,
  danger = false,
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 14,
        border: danger
          ? "1px solid rgba(180,35,24,.14)"
          : "1px solid rgba(15,23,42,.08)",
        background: danger
          ? "rgba(180,35,24,.06)"
          : subtle
            ? "#fff"
            : "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)",
        color: danger ? "#b42318" : subtle ? "#0f172a" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();

  const tone =
    normalized === "ACTIVE" || normalized === "VERIFIED"
      ? {
          bg: "rgba(22,163,74,.08)",
          color: "#15803d",
          border: "1px solid rgba(22,163,74,.12)",
        }
      : normalized === "SUSPENDED"
        ? {
            bg: "rgba(180,35,24,.08)",
            color: "#b42318",
            border: "1px solid rgba(180,35,24,.12)",
          }
        : {
            bg: "rgba(15,23,42,.05)",
            color: "#475569",
            border: "1px solid rgba(15,23,42,.08)",
          };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: tone.border,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: ".04em",
      }}
    >
      {status || "—"}
    </span>
  );
}

function RoutingBadge({ mode }) {
  const isDispatcher = mode === "DISPATCHER";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: isDispatcher ? "rgba(180,35,24,.08)" : "rgba(15,23,42,.05)",
        color: isDispatcher ? "#b42318" : "#475569",
        border: isDispatcher
          ? "1px solid rgba(180,35,24,.12)"
          : "1px solid rgba(15,23,42,.08)",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {mode || "FACTORY"}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.44)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          fontWeight: 800,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(15,23,42,.44)",
      }}
    >
      {children}
    </div>
  );
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatRelativeDate(value) {
  if (!value) return "No approved order yet";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "No approved order yet";
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function inputStyle(disabled = false) {
  return {
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,.08)",
    background: disabled ? "rgba(248,250,252,.95)" : "#fff",
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    opacity: disabled ? 0.8 : 1,
  };
}

function textareaStyle(disabled = false) {
  return {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,.08)",
    background: disabled ? "rgba(248,250,252,.95)" : "#fff",
    padding: 14,
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    resize: "vertical",
    opacity: disabled ? 0.8 : 1,
  };
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 20 }}>
          <div
            style={{
              height: 140,
              borderRadius: 18,
              background:
                "linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9))",
            }}
          />
        </GlassCard>
      ))}
    </div>
  );
}

function EmptyState({ onBack }) {
  return (
    <GlassCard style={{ padding: 26 }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#0f172a",
        }}
      >
        Dealer not found
      </div>
      <div
        style={{
          marginTop: 8,
          maxWidth: 620,
          fontSize: 14,
          lineHeight: 1.7,
          fontWeight: 700,
          color: "rgba(15,23,42,.56)",
        }}
      >
        The requested dealer profile could not be located in the admin register.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onBack}>
          Back to Dealer Register
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function RoutingModal({ open, dealer, dispatchers, saving, onClose, onSave }) {
  const initialDispatcherId =
    dealer?.dispatcherId?._id ||
    dealer?.dispatcherId ||
    dealer?.dispatcher?._id ||
    "";
  const [fulfillmentMode, setFulfillmentMode] = useState(
    dealer?.fulfillmentMode || "FACTORY",
  );
  const [dispatcherId, setDispatcherId] = useState(initialDispatcherId);

  if (!open || !dealer) return null;

  const canSave =
    fulfillmentMode === "FACTORY" ||
    (fulfillmentMode === "DISPATCHER" && dispatcherId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15,23,42,.38)",
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
      <GlassCard
        style={{
          width: "min(680px, 100%)",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionHeader
          title="Dealer Routing"
          subtitle={`Update routing for ${dealer.companyName || "dealer"}.`}
          action={
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,.08)",
                background: "#fff",
                fontSize: 20,
                fontWeight: 900,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              ×
            </button>
          }
        />

        <div style={{ marginTop: 20, display: "grid", gap: 18 }}>
          <Field label="Fulfillment Mode">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ROUTING_MODES.map((option) => (
                <ActionButton
                  key={option.value}
                  subtle={fulfillmentMode !== option.value}
                  onClick={() => setFulfillmentMode(option.value)}
                >
                  {option.label}
                </ActionButton>
              ))}
            </div>
          </Field>

          {fulfillmentMode === "DISPATCHER" ? (
            <Field label="Assigned Dispatcher">
              <select
                value={dispatcherId}
                onChange={(e) => setDispatcherId(e.target.value)}
                style={inputStyle()}
              >
                <option value="">Select dispatcher</option>
                {dispatchers.map((dispatcher) => (
                  <option key={dispatcher._id} value={dispatcher._id}>
                    {dispatcher.name}
                    {dispatcher.companyName
                      ? ` · ${dispatcher.companyName}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <ActionButton subtle onClick={onClose} disabled={saving}>
            Cancel
          </ActionButton>
          <ActionButton
            onClick={() =>
              onSave({
                fulfillmentMode,
                dispatcherId:
                  fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
              })
            }
            disabled={!canSave || saving}
          >
            {saving ? "Saving..." : "Save Routing"}
          </ActionButton>
        </div>
      </GlassCard>
    </div>
  );
}

function getDealerFormValues(currentDealer = {}) {
  return {
    companyName: currentDealer.companyName || "",
    contactName: currentDealer.contactName || "",
    email: currentDealer.email || "",
    phone: currentDealer.phone || "",
    address: currentDealer.address || "",
    panVat: currentDealer.panVat || "",
    notes: currentDealer.notes || "",
  };
}

function getMutationErrorMessage(err, fallback = "Action failed.") {
  return (
    err?.data?.error ||
    err?.data?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export default function AdminDealerProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);

  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [routingDealer, setRoutingDealer] = useState(null);
  const [statusDecision, setStatusDecision] = useState(null);
  const [statusConfirmation, setStatusConfirmation] = useState("");
  const [formDealerId, setFormDealerId] = useState("");

  const [form, setForm] = useState(() => getDealerFormValues());

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const analyticsQuery = useGetAdminDealerAnalyticsQuery(dealerId, {
    skip: !dealerId,
  });
  const [updateDealer] = useUpdateAdminDealerMutation();
  const [updateDealerStatus] = useUpdateAdminDealerStatusMutation();
  const [updateDealerRouting] = useUpdateAdminDealerRoutingMutation();
  const [assignDispatcher] = useAssignDispatcherToDealerMutation();
  const [unassignDispatcher] = useUnassignDispatcherFromDealerMutation();
  const [resendDealerSetupEmail] = useResendDealerSetupEmailMutation();

  const dealer = dealerQuery.data || null;
  const dispatchers = dispatchersQuery.data?.items || [];
  const analytics = analyticsQuery.data || null;
  const loading =
    !dealer &&
    (dealerQuery.isLoading ||
      dispatchersQuery.isLoading ||
      analyticsQuery.isLoading);
  const refreshing =
    Boolean(dealer) &&
    (dealerQuery.isFetching ||
      dispatchersQuery.isFetching ||
      analyticsQuery.isFetching);
  const loadError =
    dealerQuery.error?.message ||
    dispatchersQuery.error?.message ||
    analyticsQuery.error?.message ||
    "";

  useEffect(() => {
    if (!dealer?._id || formDealerId === dealer._id) return;
    setForm(getDealerFormValues(dealer));
    setFormDealerId(dealer._id);
  }, [dealer, formDealerId]);

  function updateFormField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const metrics = useMemo(() => {
    return {
      status: dealer?.status || "—",
      routing: dealer?.fulfillmentMode || "FACTORY",
      dispatcher:
        dealer?.dispatcherId?.name || dealer?.dispatcher?.name || "Factory",
      email: dealer?.email || "—",
    };
  }, [dealer]);

  const dealerStats = analytics?.stats || {};
  const performanceSummary = analytics?.performanceSummary || dealerStats || {};
  const productIntelligence = analytics?.productIntelligence || {};
  const orderBehavior = analytics?.orderBehavior || {};
  const commercial = analytics?.commercial || {};
  const orderedProducts =
    productIntelligence.topProductsByRevenue || analytics?.products || [];
  const accessState = dealer?.accessState || {};

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setError("");
      setSuccess("");
      await request();
      return true;
    } catch (err) {
      setError(getMutationErrorMessage(err));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveProfile() {
    if (!dealer?._id) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateDealer({
        dealerId: dealer._id,
        payload: {
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          panVat: form.panVat.trim(),
          notes: form.notes.trim(),
        },
      }).unwrap();

      setFormDealerId(dealer._id);
      setSuccess("Dealer profile updated successfully.");
    } catch (err) {
      setError(getMutationErrorMessage(err, "Failed to update dealer profile."));
    } finally {
      setSaving(false);
    }
  }

  const handleToggleStatus = (targetDealer = dealer) => {
    if (!targetDealer?._id) return Promise.resolve(false);

    const nextStatus =
      targetDealer.status === "VERIFIED" ? "SUSPENDED" : "VERIFIED";

    return runAction(`status-${targetDealer._id}`, () =>
      updateDealerStatus({ dealerId: targetDealer._id, status: nextStatus }).unwrap(),
    ).then((ok) => {
      if (ok) {
        setSuccess(`Dealer status updated to ${nextStatus}.`);
      }
      return ok;
    });
  };

  const handleSaveRouting = async ({ fulfillmentMode, dispatcherId }) => {
    if (!routingDealer?._id) return;

    const success = await runAction(
      `routing-${routingDealer._id}`,
      async () => {
        try {
          await updateDealerRouting({
            dealerId: routingDealer._id,
            payload: { fulfillmentMode, dispatcherId },
          }).unwrap();
        } catch {
          if (fulfillmentMode === "DISPATCHER") {
            await assignDispatcher({
              dealerId: routingDealer._id,
              dispatcherId,
            }).unwrap();
          } else {
            await unassignDispatcher(routingDealer._id).unwrap();
          }
        }
      },
    );

    if (success) {
      setRoutingDealer(null);
      setSuccess("Dealer routing updated successfully.");
    }
  };

  const handleResendSetup = () => {
    const userId = accessState.userId;
    if (!userId) return;

    runAction(`setup-${dealer._id}`, () =>
      resendDealerSetupEmail(userId).unwrap(),
    ).then((ok) => {
      if (ok) {
        setSuccess("A fresh password setup link has been sent if eligible.");
      }
    });
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!dealer) {
    return <EmptyState onBack={() => navigate("/admin/dashboard/dealers")} />;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title={dealer.companyName || "Dealer Profile"}
          subtitle={refreshing ? "Updating cached dealer profile in the background." : "Review and manage the full dealer profile inside the admin workspace."}
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ActionButton subtle onClick={() => navigate(-1)}>
                Back
              </ActionButton>
              <ActionButton
                subtle
                onClick={() =>
                  navigate(`/admin/dashboard/dealers/${dealerId}/orders`)
                }
              >
                View Orders
              </ActionButton>
              <ActionButton
                subtle
                onClick={() => navigate("/admin/dashboard/dealers")}
              >
                Back to Register
              </ActionButton>
            </div>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <StatusBadge status={dealer.status} />
          <RoutingBadge mode={dealer.fulfillmentMode || "FACTORY"} />
        </div>
      </GlassCard>

      {(error || loadError || success) && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 16,
            fontWeight: 800,
            background: error || loadError ? "rgba(180,35,24,.08)" : "rgba(18,183,106,.10)",
            color: error || loadError ? "#b42318" : "#067647",
            border: error || loadError
              ? "1px solid rgba(180,35,24,.16)"
              : "1px solid rgba(18,183,106,.16)",
          }}
        >
          {error || loadError || success}
        </div>
      )}

      <GlassCard style={{ padding: 22, overflow: "visible" }}>
        <SectionHeader
          title="Dealer Intelligence"
          subtitle="Approved-order performance and product behavior for this dealer."
        />

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            label="Approved Orders"
            value={performanceSummary.totalApprovedOrders || 0}
            helper={dealerStats.repeatOrderBehavior || "Order pattern"}
            accent
          />
          <MetricCard
            label="Approved Sales"
            value={money(performanceSummary.totalSalesApproved)}
            helper="Verified order value"
          />
          <MetricCard
            label="Largest Order"
            value={money(performanceSummary.largestApprovedOrderValue)}
            helper="Single approved order"
          />
          <MetricCard
            label="Average Order"
            value={money(performanceSummary.averageApprovedOrderValue)}
            helper="Approved order average"
          />
          <MetricCard
            label="Last Order"
            value={formatRelativeDate(performanceSummary.lastOrderAt)}
            helper={performanceSummary.currentActivityStatus || "Activity"}
          />
          <MetricCard
            label="Health Score"
            value={
              commercial.businessHealthScore != null
                ? `${commercial.businessHealthScore}/100`
                : "—"
            }
            helper={
              commercial.dealerTier ||
              performanceSummary.fulfillmentMode ||
              metrics.routing
            }
            accent={commercial.businessHealthScore >= 70}
            info={HEALTH_SCORE_INFO}
          />
        </div>
      </GlassCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <GlassCard style={{ padding: 22 }}>
          <SectionHeader
            title="Activity & Performance"
            subtitle="Recent order movement and approval quality."
          />
          <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
            <DetailItem
              label="Recent 30d Orders"
              value={orderBehavior.recent30DayOrders}
            />
            <DetailItem
              label="Recent 30d Revenue"
              value={money(orderBehavior.recent30DayRevenue)}
            />
            <DetailItem
              label="Previous 30d Revenue"
              value={money(orderBehavior.previous30DayRevenue)}
            />
            <DetailItem
              label="Revenue Growth 30d"
              value={`${Number(orderBehavior.growthRateRevenue30d || 0).toFixed(1)}%`}
            />
            <DetailItem
              label="Average Days Between Orders"
              value={
                performanceSummary.averageDaysBetweenOrders == null
                  ? "Not enough history"
                  : `${Number(
                      performanceSummary.averageDaysBetweenOrders,
                    ).toFixed(1)} days`
              }
            />
            <DetailItem
              label="Approval / Rejection Rate"
              value={`${Number(orderBehavior.approvalRate || 0).toFixed(1)}% / ${Number(
                orderBehavior.rejectionRate || 0,
              ).toFixed(1)}%`}
            />
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 22 }}>
          <SectionHeader
            title="Order Behavior"
            subtitle="Buying pattern and routing context."
          />
          <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
            <DetailItem
              label="Common Payment Method"
              value={orderBehavior.mostCommonPaymentMethod}
            />
            <DetailItem
              label="Average Items / Order"
              value={Number(orderBehavior.averageItemsPerOrder || 0).toFixed(1)}
            />
            <DetailItem
              label="Unique Products / Order"
              value={Number(
                orderBehavior.averageUniqueProductsPerOrder || 0,
              ).toFixed(1)}
            />
            <DetailItem
              label="Common Day / Time"
              value={`${orderBehavior.mostCommonOrderDayOfWeek || "Unknown"} · ${
                orderBehavior.mostCommonOrderTimeWindow || "Unknown"
              }`}
            />
            <DetailItem
              label="Routing Pattern"
              value={`${performanceSummary.factoryOrderCount || 0} factory · ${
                performanceSummary.dispatcherOrderCount || 0
              } dispatcher`}
            />
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 22 }}>
          <SectionHeader
            title="Risk / Opportunity"
            subtitle="Operational signals for account decisions."
          />
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {[
              ...(commercial.riskFlags || []),
              ...(commercial.opportunityTags || []),
              ...(commercial.recommendations || []),
            ].length ? (
              [
                ...(commercial.riskFlags || []),
                ...(commercial.opportunityTags || []),
                ...(commercial.recommendations || []),
              ].map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 16,
                    background:
                      index < (commercial.riskFlags || []).length
                        ? "rgba(180,35,24,.06)"
                        : "rgba(248,250,252,.95)",
                    border:
                      index < (commercial.riskFlags || []).length
                        ? "1px solid rgba(180,35,24,.12)"
                        : "1px solid rgba(15,23,42,.06)",
                    color:
                      index < (commercial.riskFlags || []).length
                        ? "#b42318"
                        : "rgba(15,23,42,.66)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 800,
                  }}
                >
                  {item}
                </div>
              ))
            ) : (
              <DetailItem
                label="Signal"
                value="No material risk or opportunity flags yet"
              />
            )}
          </div>
        </GlassCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <GlassCard style={{ padding: 22 }}>
          <SectionHeader
            title="Profile Information"
            subtitle="Update dealer account details and maintain their operational profile."
          />

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
              gap: 16,
            }}
          >
            <Field label="Company Name">
              <input
                value={form.companyName}
                onChange={(e) =>
                  updateFormField("companyName", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>

            <Field label="Contact Name">
              <input
                value={form.contactName}
                onChange={(e) =>
                  updateFormField("contactName", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  updateFormField("email", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) =>
                  updateFormField("phone", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>

            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) =>
                  updateFormField("address", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>

            <Field label="PAN / VAT">
              <input
                value={form.panVat}
                onChange={(e) =>
                  updateFormField("panVat", e.target.value)
                }
                style={inputStyle()}
              />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Notes">
              <textarea
                rows={5}
                value={form.notes}
                onChange={(e) =>
                  updateFormField("notes", e.target.value)
                }
                style={textareaStyle()}
              />
            </Field>
          </div>

          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <ActionButton
              subtle
              onClick={() => {
                setForm(getDealerFormValues(dealer));
                setFormDealerId(dealer._id || "");
                setError("");
                setSuccess("");
              }}
              disabled={saving}
            >
              Reset
            </ActionButton>

            <ActionButton onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </ActionButton>
          </div>
        </GlassCard>

        <div style={{ display: "grid", gap: 20 }}>
          <GlassCard style={{ padding: 22 }}>
            <SectionHeader
              title="Operational Controls"
              subtitle="Manage status and routing for this dealer."
            />

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gap: 16,
              }}
            >
              <DetailItem label="Current Status" value={dealer.status} />
              <DetailItem
                label="Fulfillment Mode"
                value={dealer.fulfillmentMode || "FACTORY"}
              />
              <DetailItem
                label="Assigned Dispatcher"
                value={
                  dealer.dispatcherId?.name ||
                  dealer.dispatcher?.name ||
                  "Factory handled"
                }
              />
              <DetailItem
                label="Access State"
                value={accessState.accountStatus || "—"}
              />
              <DetailItem
                label="Password Set"
                value={accessState.passwordSet ? "Yes" : "No"}
              />
              <DetailItem
                label="Invitation Last Sent"
                value={
                  accessState.invitationLastSentAt
                    ? new Date(accessState.invitationLastSentAt).toLocaleString()
                    : "—"
                }
              />
              <DetailItem
                label="Invitation Expires"
                value={
                  accessState.invitationExpiresAt
                    ? new Date(accessState.invitationExpiresAt).toLocaleString()
                    : "—"
                }
              />
            </div>

            <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
              <ActionButton
                subtle
                onClick={() => {
                  setStatusConfirmation("");
                  setStatusDecision(dealer);
                }}
                disabled={busyAction === `status-${dealer._id}`}
                danger={dealer.status === "VERIFIED"}
              >
                {busyAction === `status-${dealer._id}`
                  ? "Saving..."
                  : dealer.status === "VERIFIED"
                    ? "Suspend Dealer"
                    : "Activate Dealer"}
              </ActionButton>

              <ActionButton
                subtle
                onClick={() => setRoutingDealer(dealer)}
                disabled={busyAction === `routing-${dealer._id}`}
              >
                Edit Routing
              </ActionButton>

              {accessState.canResendSetup ? (
                <ActionButton
                  subtle
                  onClick={handleResendSetup}
                  disabled={busyAction === `setup-${dealer._id}`}
                >
                  {busyAction === `setup-${dealer._id}`
                    ? "Sending..."
                    : "Resend Setup Link"}
                </ActionButton>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionHeader
              title="Reference Details"
              subtitle="Snapshot of the current dealer record."
            />

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gap: 14,
              }}
            >
              <DetailItem label="Dealer ID" value={dealer._id} />
              <DetailItem
                label="Created At"
                value={
                  dealer.createdAt
                    ? new Date(dealer.createdAt).toLocaleString()
                    : "—"
                }
              />
              <DetailItem
                label="Updated At"
                value={
                  dealer.updatedAt
                    ? new Date(dealer.updatedAt).toLocaleString()
                    : "—"
                }
              />
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard style={{ padding: 22 }}>
        <SectionHeader
          title="Ordered Product Intelligence"
          subtitle="Products ranked by approved value contribution for this dealer."
        />

        {orderedProducts.length ? (
          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {orderedProducts.slice(0, 12).map((product, index) => (
              <div
                key={`${product.sku || product.name}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "42px minmax(0,1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: index === 0 ? "rgba(180,35,24,.05)" : "#fff",
                  border: "1px solid rgba(15,23,42,.06)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(15,23,42,.05)",
                    color: index === 0 ? "#b42318" : "#0f172a",
                    fontWeight: 950,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 950,
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {product.name || product.sku || "Product"}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "rgba(15,23,42,.52)",
                    }}
                  >
                    {product.packLabel || product.sku || "Catalog item"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 950,
                      color: "#0f172a",
                    }}
                  >
                    {money(product.totalValue)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "rgba(15,23,42,.52)",
                    }}
                  >
                    Qty {Number(product.quantity || 0).toLocaleString()} ·{" "}
                    {product.orderFrequency || 0} orders
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 18,
              padding: "16px 18px",
              borderRadius: 18,
              background: "rgba(248,250,252,.95)",
              border: "1px solid rgba(15,23,42,.06)",
              color: "rgba(15,23,42,.58)",
              fontWeight: 800,
            }}
          >
            No approved product order history is available yet.
          </div>
        )}
      </GlassCard>

      <RoutingModal
        key={routingDealer?._id || "closed"}
        open={Boolean(routingDealer)}
        dealer={routingDealer}
        dispatchers={dispatchers}
        saving={busyAction === `routing-${routingDealer?._id}`}
        onClose={() => {
          if (!busyAction) setRoutingDealer(null);
        }}
        onSave={handleSaveRouting}
      />

      <AdminDecisionModal
        open={Boolean(statusDecision)}
        title={
          statusDecision?.status === "VERIFIED"
            ? "Suspend dealer access?"
            : "Activate dealer access?"
        }
        subtitle={
          statusDecision?.status === "VERIFIED"
            ? "This will suspend the dealer account, prevent new dealer activity, and revoke active refresh sessions for linked dealer users."
            : "This will restore linked dealer access and allow the dealer to use their portal again."
        }
        tone={statusDecision?.status === "VERIFIED" ? "danger" : "default"}
        confirmLabel={
          statusDecision?.status === "VERIFIED"
            ? "Suspend Dealer"
            : "Activate Dealer"
        }
        busy={busyAction === `status-${statusDecision?._id}`}
        details={[
          {
            label: "Dealer",
            value:
              statusDecision?.companyName ||
              statusDecision?.contactName ||
              statusDecision?.email ||
              "Dealer",
          },
          { label: "Current status", value: statusDecision?.status || "-" },
          {
            label: "New status",
            value:
              statusDecision?.status === "VERIFIED"
                ? "SUSPENDED"
                : "VERIFIED",
          },
          {
            label: "Access impact",
            value:
              statusDecision?.status === "VERIFIED"
                ? "Portal access is blocked and active sessions are revoked."
                : "Portal access is restored for linked dealer users.",
          },
        ]}
        requireText={
          statusDecision?.status === "VERIFIED"
            ? statusDecision?.companyName ||
              statusDecision?.contactName ||
              statusDecision?.email ||
              String(statusDecision?._id || "")
            : ""
        }
        confirmationText={statusConfirmation}
        onConfirmationTextChange={setStatusConfirmation}
        onClose={() => {
          if (busyAction === `status-${statusDecision?._id}`) return;
          setStatusDecision(null);
          setStatusConfirmation("");
        }}
        onConfirm={async () => {
          if (!statusDecision?._id) return;
          const targetDealer = statusDecision;
          const ok = await handleToggleStatus(targetDealer);
          if (ok) {
            setStatusDecision(null);
            setStatusConfirmation("");
          }
        }}
      />
    </div>
  );
}
