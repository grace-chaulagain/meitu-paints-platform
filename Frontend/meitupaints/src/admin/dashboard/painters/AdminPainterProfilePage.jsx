import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useDeletePainterMutation,
  useGetAdminPainterQuery,
  useGetPainterPointsQuery,
  useGetPainterSalesQuery,
  useLazyGetPainterIdCardUrlQuery,
  usePromotePainterToTtpMutation,
  useUpdatePainterMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import {
  Avatar,
  EmptyState,
  GhostButton,
  ListRow,
  MetricTile,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../../utils/scrollResultsToTop.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import ConfirmActionModal from "../../catalog/components/ConfirmActionModal.jsx";
import PainterFormModal from "./PainterFormModal.jsx";
import PainterIdCardPhotoModal from "./PainterIdCardPhotoModal.jsx";

const OVERVIEW_PREVIEW_SIZE = 5;
const POINTS_PAGE_SIZE = 10;

const TAB_OPTIONS = [
  { key: "overview", label: "Overview" },
  { key: "points", label: "Points" },
];

function painterTypeTone(type) {
  if (type === "TTP") return "caution";
  if (type === "RTP") return "positive";
  return "neutral";
}

function painterTypeLabel(type) {
  if (type === "TTP") return "TTP";
  if (type === "RTP") return "RTP";
  return "Unclassified";
}

function PainterPointRow({ row }) {
  return (
    <ListRow>
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
          {row.dealerId?.companyName || "Unknown dealer"}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {row.couponId?.couponCode || "—"} · {formatDate(row.createdAt)}
        </div>
      </div>
      <div style={{ flex: "0 0 90px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>
        +{row.points} pts
      </div>
      <div style={{ flex: "0 0 110px", textAlign: "right", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>
        {money(row.cashAmount)}
      </div>
    </ListRow>
  );
}

function painterInitials(painter) {
  const name = String(painter?.name || "Painter").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

// "FirstName-LastName-PainterCard.pdf" - first word + last word of the
// painter's free-text name (middle names dropped), sanitized so the
// filename is safe on every OS regardless of what's in the name field.
function painterCardFilename(painter) {
  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, "") || "Painter";
  const words = String(painter?.name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Painter-PainterCard.pdf";
  if (words.length === 1) return `${safe(words[0])}-PainterCard.pdf`;
  return `${safe(words[0])}-${safe(words[words.length - 1])}-PainterCard.pdf`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PainterSaleRow({ sale }) {
  return (
    <ListRow>
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
          {sale.dealerId?.companyName || "Unknown dealer"}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {sale.saleNumber} · {formatDate(sale.saleDate)}
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">
          {sale.status === "VOIDED" ? "Voided" : "Completed"}
        </Pill>
      </div>
      <div style={{ flex: "0 0 90px", textAlign: "right", fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
        {Array.isArray(sale.items) ? `${sale.items.length} item${sale.items.length === 1 ? "" : "s"}` : "—"}
      </div>
      <div style={{ flex: "0 0 110px", textAlign: "right", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>
        {money(sale.totals?.total, sale.totals?.currency)}
      </div>
    </ListRow>
  );
}

function TabBar({ options, value, onChange }) {
  return (
    <div className="painter-profile-tabs" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`painter-profile-tab ${active ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-ink, #1d1d1f)", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function AdminPainterProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const painterId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/painters\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pointsPage, setPointsPage] = useState(1);

  const painterQuery = useGetAdminPainterQuery(painterId, { skip: !painterId });
  const isPointsTab = activeTab === "points";
  const salesQuery = useGetPainterSalesQuery(
    {
      painterId,
      page: 1,
      limit: OVERVIEW_PREVIEW_SIZE,
    },
    { skip: !painterId },
  );
  const pointsQuery = useGetPainterPointsQuery(
    { painterId, page: pointsPage, limit: POINTS_PAGE_SIZE },
    { skip: !painterId || !isPointsTab },
  );
  const [updatePainter, { isLoading: saving }] = useUpdatePainterMutation();
  const [deletePainter, { isLoading: deleting }] = useDeletePainterMutation();
  const [promotePainter, { isLoading: promoting }] = usePromotePainterToTtpMutation();
  const [fetchIdCardUrl, { isFetching: downloadingIdCard }] = useLazyGetPainterIdCardUrlQuery();

  async function handlePromote() {
    try {
      setActionError("");
      await promotePainter({ painterId, payload: {} }).unwrap();
      setPromoteOpen(false);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to promote painter."));
      setPromoteOpen(false);
    }
  }

  async function handleDownloadIdCard() {
    try {
      setActionError("");
      const { url } = await fetchIdCardUrl(painterId).unwrap();
      // Fetched as a blob (rather than a plain window.open) so the browser
      // uses our own filename - Cloudinary's Content-Disposition otherwise
      // just says "file.pdf". Cloudinary's response allows CORS from any
      // origin, so this fetch isn't blocked.
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download the ID card.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = painterCardFilename(painter);
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to fetch the ID card."));
    }
  }

  const painter = painterQuery.data?.item || null;
  const loading = painterQuery.isLoading;
  const error = actionError || (painterQuery.error ? getQueryErrorMessage(painterQuery.error, "Failed to load painter.") : "");

  async function handleSave(payload) {
    try {
      setActionError("");
      await updatePainter({ painterId, payload }).unwrap();
      setEditOpen(false);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to save painter."));
    }
  }

  async function handleDelete() {
    try {
      await deletePainter(painterId).unwrap();
      navigate("/admin/dashboard/painters");
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to delete painter."));
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <Surface padding={18}>
        <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
      </Surface>
    );
  }

  const backButton = (
    <div className="painter-profile-breadcrumb">
      <button
        type="button"
        className="painter-profile-back-btn"
        onClick={() => navigate("/admin/dashboard/painters")}
        aria-label="Back to painters"
      >
        <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button type="button" className="painter-profile-crumb-link" onClick={() => navigate("/admin/dashboard/painters")}>
        Painters
      </button>
      <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
      <span className="painter-profile-crumb-current">Painter Profile</span>
    </div>
  );

  if (!painter) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {backButton}
        <EmptyState icon="user" title="Painter not found" subtitle={error || "This painter may have been removed."} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {backButton}

      <Surface padding={22} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar label={painterInitials(painter)} size={52} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-ink,#1d1d1f)" }}>
                {painter.name || "Unnamed Painter"}
              </div>
              <div style={{ marginTop: 4 }}>
                <Pill tone={painterTypeTone(painter.type)} size="small">{painterTypeLabel(painter.type)}</Pill>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {painter.type !== "TTP" ? (
              <GhostButton icon="checkmark" onClick={() => setPromoteOpen(true)}>
                Promote to TTP
              </GhostButton>
            ) : null}
            {painter.type === "TTP" ? (
              <GhostButton icon="user" onClick={() => setPhotoModalOpen(true)}>
                Add Photo to ID Card
              </GhostButton>
            ) : null}
            {painter.type === "TTP" && painter.idCardGeneratedAt ? (
              <GhostButton icon="download" disabled={downloadingIdCard} onClick={handleDownloadIdCard}>
                {downloadingIdCard ? "Preparing…" : "Download ID Card"}
              </GhostButton>
            ) : null}
            <GhostButton icon="edit" onClick={() => setEditOpen(true)}>
              Edit
            </GhostButton>
            <GhostButton danger icon="trash" onClick={() => setDeleteOpen(true)}>
              Delete
            </GhostButton>
          </div>
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      <TabBar options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <div className="painter-profile-overview-grid">
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="user" title="Painter Information" />
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
                <DetailItem label="Phone Numbers" value={painter.phones?.length ? painter.phones.join(", ") : ""} />
                <DetailItem label="Address" value={painter.address} />
                <DetailItem label="Citizenship / Official ID" value={painter.citizenshipNumber} />
                <DetailItem label="Notes" value={painter.notes} />
                {painter.type === "TTP" ? (
                  <>
                    <DetailItem label="Painter ID" value={painter.licenseId} />
                    <DetailItem label="License Status" value={painter.licenseStatus} />
                    <DetailItem label="License Issued" value={formatDate(painter.licenseIssuedAt)} />
                  </>
                ) : null}
              </div>
            </Surface>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Surface padding={22} className="dash-fade-up">
              <SectionHeader
                icon="trend"
                title="Reward Points"
                action={<GhostButton onClick={() => setActiveTab("points")}>View All</GhostButton>}
              />
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetricTile icon="checkmark" label="Total Points" value={(painter.totalPoints || 0).toLocaleString()} tone="accent" />
                <MetricTile icon="invoice" label="Total Cash Received" value={money(painter.totalCashReceived)} />
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader icon="chart" title="Purchase Summary" action={<Pill tone="neutral" size="small">Lifetime</Pill>} />
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetricTile icon="orders" label="Total Purchases" value={salesQuery.data?.summary?.totalCount || 0} tone="accent" />
                <MetricTile icon="trend" label="Total Spent" value={money(salesQuery.data?.summary?.totalRevenue)} />
              </div>
            </Surface>

            <Surface padding={22} className="dash-fade-up">
              <SectionHeader
                icon="history"
                title="Recent Purchases"
              />
              <div style={{ marginTop: 10 }}>
                {salesQuery.isLoading ? (
                  <div style={{ height: 120, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
                ) : !salesQuery.data?.items?.length ? (
                  <div style={{ padding: "14px 4px", fontSize: 12.5, color: "var(--color-graphite,#707070)" }}>No purchases yet.</div>
                ) : (
                  <Surface padding={0}>
                    {salesQuery.data.items.map((sale) => (
                      <PainterSaleRow key={sale._id} sale={sale} />
                    ))}
                  </Surface>
                )}
              </div>
            </Surface>
          </div>
        </div>
      ) : null}

      {activeTab === "points" ? (
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader
            icon="trend"
            title="Points Earned"
            subtitle="Every coupon redemption that credited this painter."
          />

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <MetricTile icon="checkmark" label="Lifetime" value={`${(pointsQuery.data?.summary?.lifetime?.points || 0).toLocaleString()} pts`} tone="accent" />
            <MetricTile icon="calendar" label="This Year" value={`${(pointsQuery.data?.summary?.yearly?.points || 0).toLocaleString()} pts`} />
            <MetricTile icon="calendar" label="This Month" value={`${(pointsQuery.data?.summary?.monthly?.points || 0).toLocaleString()} pts`} />
          </div>

          <div style={{ marginTop: 18 }}>
            {pointsQuery.isLoading ? (
              <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
            ) : !pointsQuery.data?.items?.length ? (
              <EmptyState icon="trend" title="No points earned yet" subtitle="Coupon redemptions credited to this painter will show up here." />
            ) : (
              <>
                <Surface padding={0}>
                  {pointsQuery.data.items.map((row) => (
                    <PainterPointRow key={row._id} row={row} />
                  ))}
                </Surface>

                {pointsQuery.data.pagination?.pages > 1 ? (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
                      Page {pointsQuery.data.pagination.page} of {pointsQuery.data.pagination.pages}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <GhostButton
                        onClick={() => {
                          setPointsPage((p) => Math.max(1, p - 1));
                          scrollResultsToTop();
                        }}
                        disabled={pointsPage <= 1}
                      >
                        Previous
                      </GhostButton>
                      <GhostButton
                        onClick={() => {
                          setPointsPage((p) => Math.min(pointsQuery.data.pagination.pages, p + 1));
                          scrollResultsToTop();
                        }}
                        disabled={pointsPage >= pointsQuery.data.pagination.pages}
                      >
                        Next
                      </GhostButton>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Surface>
      ) : null}

      <ConfirmActionModal
        open={promoteOpen}
        title="Promote to TTP?"
        description="A permanent Painter ID will be generated automatically and cannot be changed later."
        confirmText={promoting ? "Promoting…" : "Promote to TTP"}
        loading={promoting}
        onClose={() => setPromoteOpen(false)}
        onConfirm={handlePromote}
      />

      {photoModalOpen ? (
        <PainterIdCardPhotoModal painter={painter} onClose={() => setPhotoModalOpen(false)} />
      ) : null}

      <PainterFormModal
        open={editOpen}
        painter={painter}
        saving={saving}
        error={editOpen ? actionError : ""}
        onClose={() => {
          if (!saving) {
            setEditOpen(false);
            setActionError("");
          }
        }}
        onSave={handleSave}
      />

      <ConfirmActionModal
        open={deleteOpen}
        title="Delete painter?"
        description={`This will remove ${painter.name || "this painter"} from the directory. This cannot be undone.`}
        danger
        loading={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <style>{`
        .painter-profile-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .painter-profile-back-btn{
          width:32px;
          height:32px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:10px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .painter-profile-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .painter-profile-back-btn:active{
          transform:scale(.92);
        }
        .painter-profile-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .painter-profile-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .painter-profile-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .painter-profile-tabs{
          display:flex;
          align-items:center;
          gap:22px;
          border-bottom:1px solid rgba(29,29,31,.08);
          overflow-x:auto;
          scrollbar-width:none;
        }
        .painter-profile-tabs::-webkit-scrollbar{
          display:none;
        }
        .painter-profile-tab{
          flex:0 0 auto;
          padding:12px 2px 13px;
          border:none;
          background:transparent;
          border-bottom:2px solid transparent;
          margin-bottom:-1px;
          font-size:13.5px;
          font-weight:650;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          white-space:nowrap;
        }
        .painter-profile-tab.is-active{
          color:var(--color-ink,#1d1d1f);
          font-weight:700;
          border-bottom-color:#dc2626;
        }
        .painter-profile-overview-grid{
          display:grid;
          grid-template-columns:1.1fr 1fr;
          gap:16px;
          align-items:start;
        }
        @media (max-width:900px){
          .painter-profile-overview-grid{
            grid-template-columns:1fr;
          }
        }
        @media (prefers-reduced-motion: reduce){
          .painter-profile-back-btn{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
