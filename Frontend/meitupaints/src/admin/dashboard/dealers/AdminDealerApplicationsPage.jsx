import { useMemo, useState } from "react";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import {
  useApproveDealerApplicationMutation,
  useDeleteDealerApplicationMutation,
  useGetAdminDealerApplicationsQuery,
  useGetVerifiedDispatchersQuery,
  useRejectDealerApplicationMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
];

const ROUTING_MODES = [
  { value: "FACTORY", label: "Factory" },
  { value: "DISPATCHER", label: "Dispatcher" },
];

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
        alignItems: "flex-end",
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

function SearchInput({ value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 50,
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        padding: "0 14px",
      }}
    >
      <span style={{ fontWeight: 900, color: "rgba(15,23,42,.42)" }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search company, contact, phone, email..."
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
        }}
      />
    </div>
  );
}

function FilterPill({ active, children, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(180,35,24,.16)"
          : "1px solid rgba(15,23,42,.08)",
        background: active
          ? "linear-gradient(135deg, #b91c1c 0%, #dd5127 100%)"
          : "#fff",
        color: active ? "#fff" : "#0f172a",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.06)",
            color: active ? "#fff" : "#0f172a",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  subtle = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      style={{
        minHeight: 42,
        padding: "10px 14px",
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
        boxShadow: subtle
          ? "inset 0 1px 0 rgba(255,255,255,.72)"
          : "0 12px 22px rgba(180,35,24,.16)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        whiteSpace: "normal",
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === "VERIFIED"
      ? {
          bg: "rgba(22,163,74,.08)",
          color: "#15803d",
          border: "1px solid rgba(22,163,74,.12)",
        }
      : status === "REJECTED"
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

function ApplicationCard({
  application,
  busyAction,
  onApprove,
  onReject,
  onDelete,
}) {
  const companyInitial = String(
    application.companyName || application.contactName || "A",
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <GlassCard
      style={{
        padding: 0,
        background:
          "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(250,250,252,.96) 100%)",
        border: "1px solid rgba(15,23,42,.07)",
        boxShadow:
          "0 24px 60px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.92)",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: 20,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              application.status === "VERIFIED"
                ? "linear-gradient(90deg, #16a34a 0%, rgba(22,163,74,.32) 100%)"
                : application.status === "REJECTED"
                  ? "linear-gradient(90deg, #b91c1c 0%, #dd5127 100%)"
                  : "linear-gradient(90deg, #b91c1c 0%, #dd5127 100%)",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "56px minmax(0,1fr) auto",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(15,23,42,.96) 0%, rgba(51,65,85,.92) 100%)",
              color: "#fff",
              fontSize: 20,
              fontWeight: 950,
              boxShadow: "0 16px 28px rgba(15,23,42,.14)",
            }}
          >
            {companyInitial}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 19,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                color: "#0f172a",
                lineHeight: 1.15,
              }}
            >
              {application.companyName || "Unnamed Application"}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 700,
                color: "rgba(15,23,42,.56)",
              }}
            >
              {application.contactName || "No contact name"}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                lineHeight: 1.5,
                fontWeight: 800,
                color: "rgba(15,23,42,.48)",
                letterSpacing: ".02em",
              }}
            >
              {application.email || "No email"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <StatusBadge status={application.status} />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,.05)",
                color: "#475569",
                border: "1px solid rgba(15,23,42,.08)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {application.createdAt
                ? new Date(application.createdAt).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            padding: 14,
            borderRadius: 18,
            background: "rgba(248,250,252,.86)",
            border: "1px solid rgba(15,23,42,.06)",
          }}
        >
          <DetailItem label="Phone" value={application.phone} />
          <DetailItem label="PAN / VAT" value={application.panVat} />
          <DetailItem label="Address" value={application.address} />
          <DetailItem
            label="Submitted"
            value={
              application.createdAt
                ? new Date(application.createdAt).toLocaleString()
                : "—"
            }
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <DetailItem label="Applicant Notes" value={application.notes} />
          </div>
          {application.reviewNote ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <DetailItem label="Review Note" value={application.reviewNote} />
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          {application.status === "PENDING" ? (
            <>
              <ActionButton onClick={onApprove}>Configure Approval</ActionButton>

              <ActionButton
                danger
                onClick={onReject}
                disabled={busyAction === `reject-${application._id}`}
              >
                {busyAction === `reject-${application._id}`
                  ? "Rejecting..."
                  : "Reject"}
              </ActionButton>
            </>
          ) : null}

          <ActionButton
            danger
            onClick={onDelete}
            disabled={busyAction === `delete-${application._id}`}
          >
            {busyAction === `delete-${application._id}`
              ? "Moving..."
              : "Delete"}
          </ActionButton>
        </div>
      </div>
    </GlassCard>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <GlassCard key={index} style={{ padding: 18 }}>
          <div
            style={{
              height: 180,
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

function EmptyState({ onReset }) {
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
        No applications found
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
        Try adjusting the search or status filters to view incoming dealer
        applications.
      </div>
      <div style={{ marginTop: 18 }}>
        <ActionButton subtle onClick={onReset}>
          Clear filters
        </ActionButton>
      </div>
    </GlassCard>
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

function RoutingChoiceCard({ active, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 16,
        borderRadius: 18,
        border: active
          ? "1px solid rgba(180,35,24,.18)"
          : "1px solid rgba(15,23,42,.08)",
        background: active ? "rgba(180,35,24,.05)" : "#fff",
        cursor: "pointer",
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: active ? "#b42318" : "#0f172a",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          fontWeight: 700,
          color: "rgba(15,23,42,.58)",
        }}
      >
        {desc}
      </div>
    </button>
  );
}

function ApproveModal({
  open,
  application,
  dispatchers,
  saving,
  onClose,
  onSave,
}) {
  const [fulfillmentMode, setFulfillmentMode] = useState("FACTORY");
  const [dispatcherId, setDispatcherId] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  if (!open || !application) return null;

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
          width: "min(760px, 100%)",
          padding: 22,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SectionHeader
          title="Approve Application"
          subtitle={`Configure onboarding for ${application.companyName || "dealer application"}.`}
          action={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
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

        <div style={{ marginTop: 20, display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Label>Fulfillment Mode</Label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <RoutingChoiceCard
                active={fulfillmentMode === "FACTORY"}
                title="Factory"
                desc="The admin and factory workflow will handle this dealer’s orders directly."
                onClick={() => {
                  setFulfillmentMode("FACTORY");
                  setDispatcherId("");
                }}
              />
              <RoutingChoiceCard
                active={fulfillmentMode === "DISPATCHER"}
                title="Dispatcher"
                desc="Assign this dealer to a dispatcher so their routed orders are handled through that dispatcher."
                onClick={() => setFulfillmentMode("DISPATCHER")}
              />
            </div>
          </div>

          {fulfillmentMode === "DISPATCHER" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <Label>Assigned Dispatcher</Label>
              <select
                value={dispatcherId}
                onChange={(e) => setDispatcherId(e.target.value)}
                style={{
                  width: "100%",
                  height: 50,
                  borderRadius: 16,
                  border: "1px solid rgba(15,23,42,.08)",
                  background: "#fff",
                  padding: "0 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  outline: "none",
                }}
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

              {dispatchers.length === 0 ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(180,35,24,.06)",
                    border: "1px solid rgba(180,35,24,.12)",
                    color: "#b42318",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  No verified dispatchers are currently available. Add or verify
                  a dispatcher first.
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <Label>Review Note</Label>
            <textarea
              rows={4}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Optional internal note for this approval..."
              style={{
                width: "100%",
                borderRadius: 16,
                border: "1px solid rgba(15,23,42,.08)",
                background: "#fff",
                padding: 14,
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave({
                fulfillmentMode,
                dispatcherId:
                  fulfillmentMode === "DISPATCHER" ? dispatcherId : null,
                reviewNote: reviewNote.trim(),
              });
            }}
            disabled={!canSave || saving}
          >
            {saving ? "Approving..." : "Approve Dealer"}
          </ActionButton>
        </div>
      </GlassCard>
    </div>
  );
}

export default function AdminDealerApplicationsPage() {
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [approvingApplication, setApprovingApplication] = useState(null);
  const [rejectingApplication, setRejectingApplication] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [deletingApplication, setDeletingApplication] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const applicationParams = useMemo(() => {
    const params = {};
    if (statusFilter !== "ALL") params.status = statusFilter;
    return params;
  }, [statusFilter]);

  const applicationsQuery = useGetAdminDealerApplicationsQuery(applicationParams);
  const dispatchersQuery = useGetVerifiedDispatchersQuery();
  const [approveDealerApplication] = useApproveDealerApplicationMutation();
  const [rejectDealerApplication] = useRejectDealerApplicationMutation();
  const [deleteDealerApplication] = useDeleteDealerApplicationMutation();

  const applications = useMemo(
    () => applicationsQuery.data?.items || [],
    [applicationsQuery.data],
  );
  const dispatchers = useMemo(
    () => dispatchersQuery.data?.items || [],
    [dispatchersQuery.data],
  );

  const loading = applicationsQuery.isLoading && applications.length === 0;
  const isRefreshing =
    !loading && (applicationsQuery.isFetching || dispatchersQuery.isFetching);
  const queryError = applicationsQuery.error || dispatchersQuery.error;
  const error =
    actionError ||
    (queryError
      ? getQueryErrorMessage(queryError, "Failed to load dealer applications.")
      : "");

  function refetchPageData() {
    applicationsQuery.refetch();
    dispatchersQuery.refetch();
  }

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;

    return applications.filter((item) =>
      [
        item.companyName,
        item.contactName,
        item.phone,
        item.email,
        item.address,
        item.panVat,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [applications, search]);

  const countsByFilter = useMemo(() => {
    return {
      ALL: applications.length,
      PENDING: applications.filter((d) => d.status === "PENDING").length,
      VERIFIED: applications.filter((d) => d.status === "VERIFIED").length,
      REJECTED: applications.filter((d) => d.status === "REJECTED").length,
    };
  }, [applications]);

  async function runAction(actionKey, request) {
    try {
      setBusyAction(actionKey);
      setActionError("");
      await request();
      return true;
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Action failed."));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  const handleApprove = async (payload) => {
    if (!approvingApplication?._id) return;

    const success = await runAction(`approve-${approvingApplication._id}`, () =>
      approveDealerApplication({
        applicationId: approvingApplication._id,
        payload,
      }).unwrap(),
    );

    if (success) {
      setApprovingApplication(null);
    }
  };

  const handleReject = (application, reviewNote) => {
    return runAction(`reject-${application._id}`, () =>
      rejectDealerApplication({
        applicationId: application._id,
        payload: { reviewNote: reviewNote.trim() },
      }).unwrap(),
    );
  };

  const handleDelete = (application) => {
    return runAction(`delete-${application._id}`, () =>
      deleteDealerApplication({
        applicationId: application._id,
        payload: {
          confirmation: deleteConfirmation,
          reason: "Admin moved dealer application to trash",
        },
      }).unwrap(),
    );
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Application Register"
          subtitle="Search, inspect, and process dealer applications."
          action={
            <ActionButton subtle onClick={refetchPageData}>
              Refresh
            </ActionButton>
          }
        />

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "minmax(280px, 1fr) auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <SearchInput value={search} onChange={setSearch} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((filter) => (
              <FilterPill
                key={filter.key}
                active={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
                count={countsByFilter[filter.key]}
              >
                {filter.label}
              </FilterPill>
            ))}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(180,35,24,.08)",
              color: "#b42318",
              border: "1px solid rgba(180,35,24,.14)",
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        ) : null}

        {isRefreshing ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(15,23,42,.46)",
            }}
          >
            Updating applications...
          </div>
        ) : null}
      </GlassCard>

      {loading ? (
        <LoadingState />
      ) : filteredApplications.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 18,
            alignItems: "start",
          }}
        >
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application._id}
              application={application}
              busyAction={busyAction}
              onApprove={() => setApprovingApplication(application)}
              onReject={() => {
                setRejectingApplication(application);
                setRejectNote("");
              }}
              onDelete={() => {
                setDeletingApplication(application);
                setDeleteConfirmation("");
              }}
            />
          ))}
        </div>
      )}

      <ApproveModal
        key={approvingApplication?._id || "closed"}
        open={Boolean(approvingApplication)}
        application={approvingApplication}
        dispatchers={dispatchers}
        saving={busyAction === `approve-${approvingApplication?._id}`}
        onClose={() => {
          if (!busyAction) setApprovingApplication(null);
        }}
        onSave={handleApprove}
      />

      <AdminDecisionModal
        open={Boolean(rejectingApplication)}
        title="Reject Dealer Application"
        subtitle="This records an admin review decision and prevents this application from becoming a dealer account."
        tone="danger"
        confirmLabel="Reject Application"
        busy={busyAction === `reject-${rejectingApplication?._id}`}
        disabled={!rejectNote.trim()}
        details={[
          { label: "Company", value: rejectingApplication?.companyName },
          { label: "Contact", value: rejectingApplication?.contactName },
          { label: "Email", value: rejectingApplication?.email },
          { label: "Phone", value: rejectingApplication?.phone },
        ]}
        onClose={() => {
          if (!busyAction) {
            setRejectingApplication(null);
            setRejectNote("");
          }
        }}
        onConfirm={async () => {
          if (!rejectingApplication) return;
          const success = await handleReject(rejectingApplication, rejectNote);
          if (success) {
            setRejectingApplication(null);
            setRejectNote("");
          }
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(15,23,42,.44)",
            }}
          >
            Required Review Note
          </div>
          <textarea
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Document the reason for rejecting this application..."
            disabled={busyAction === `reject-${rejectingApplication?._id}`}
            style={{
              width: "100%",
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,.10)",
              background: "#fff",
              padding: 14,
              outline: "none",
              resize: "vertical",
              fontSize: 14,
              lineHeight: 1.55,
              fontWeight: 700,
              color: "#0f172a",
            }}
          />
        </div>
      </AdminDecisionModal>

      <AdminDecisionModal
        open={Boolean(deletingApplication)}
        title="Delete Dealer Application"
        subtitle="This moves the application to Settings Trash for 30 days before permanent database deletion."
        tone="danger"
        confirmLabel="Move to Trash"
        busy={busyAction === `delete-${deletingApplication?._id}`}
        details={[
          { label: "Company", value: deletingApplication?.companyName },
          { label: "Contact", value: deletingApplication?.contactName },
          { label: "Email", value: deletingApplication?.email },
          { label: "Retention", value: "30 days in Settings Trash" },
        ]}
        requireText={deletingApplication?.companyName || ""}
        confirmationText={deleteConfirmation}
        onConfirmationTextChange={setDeleteConfirmation}
        onClose={() => {
          if (!busyAction) {
            setDeletingApplication(null);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={async () => {
          if (!deletingApplication) return;
          const success = await handleDelete(deletingApplication);
          if (success) {
            setDeletingApplication(null);
            setDeleteConfirmation("");
          }
        }}
      />
    </div>
  );
}
