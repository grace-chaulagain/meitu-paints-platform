import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreatePainterMutation,
  useDeletePainterMutation,
  useGetAdminPaintersQuery,
  useUpdatePainterMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  ListRow,
  Pill,
  PrimaryButton,
  SearchField,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import ConfirmActionModal from "../../catalog/components/ConfirmActionModal.jsx";
import PainterFormModal from "./PainterFormModal.jsx";

const SORT_OPTIONS = [
  { key: "name-desc", label: "Name Z–A" },
  { key: "recent", label: "Recently added" },
];

const TYPE_FILTER_OPTIONS = [
  { key: "ALL", label: "All types" },
  { key: "TTP", label: "TTP only" },
  { key: "RTP", label: "RTP only" },
  { key: "UNCLASSIFIED", label: "Unclassified" },
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

const VIEW_STORAGE_KEY = "meitu.admin.painters.view";

function getInitialView() {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "list";
  } catch {
    return "list";
  }
}

// Same hash-based avatar palette as AdminDealersPage.jsx's DealersCard, so
// the grid view here reads as the same design language.
const AVATAR_PALETTE = [
  { bg: "rgba(220,38,38,.12)", fg: "#dc2626" },
  { bg: "rgba(124,58,237,.12)", fg: "#7c3aed" },
  { bg: "rgba(234,88,12,.12)", fg: "#ea580c" },
  { bg: "rgba(22,163,74,.12)", fg: "#16a34a" },
  { bg: "rgba(0,113,227,.12)", fg: "#0071e3" },
  { bg: "rgba(219,39,119,.12)", fg: "#db2777" },
  { bg: "rgba(13,148,136,.12)", fg: "#0d9488" },
  { bg: "rgba(75,85,99,.12)", fg: "#4b5563" },
];

function hashString(value) {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function painterPalette(painter) {
  const key = painter._id || painter.name || "painter";
  return AVATAR_PALETTE[hashString(key) % AVATAR_PALETTE.length];
}

function painterInitials(painter) {
  const name = String(painter.name || "Painter").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatPhones(phones) {
  return Array.isArray(phones) && phones.length ? phones.join(", ") : "No phone on file";
}

function PainterListRow({ painter, onOpen, onEdit, onDelete }) {
  return (
    <ListRow onClick={() => onOpen(painter)}>
      <Avatar label={painterInitials(painter)} size={34} />

      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink,#1d1d1f)" }}>
            {painter.name || "Unnamed Painter"}
          </span>
          <Pill tone={painterTypeTone(painter.type)} size="small">{painterTypeLabel(painter.type)}</Pill>
        </div>
        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
          {formatPhones(painter.phones)}
        </div>
      </div>

      <div style={{ flex: "1 1 200px", fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite,#707070)" }}>
        {painter.address || "No address on file"}
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6 }} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="painter-row-action-btn" onClick={() => onEdit(painter)} aria-label="Edit painter" title="Edit">
          <DashboardIcon name="edit" size={14} strokeWidth={1.8} />
        </button>
        <button type="button" className="painter-row-action-btn" onClick={() => onDelete(painter)} aria-label="Delete painter" title="Delete">
          <DashboardIcon name="trash" size={14} strokeWidth={1.8} />
        </button>
      </div>
    </ListRow>
  );
}

function PaintersGridCard({ painter, onOpen, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const palette = painterPalette(painter);

  return (
    <article className="painter-grid-card" onClick={() => onOpen(painter)}>
      <div className="painter-grid-card-top">
        <div className="painter-grid-avatar" style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}>
          {painterInitials(painter)}
        </div>

        <div className="painter-grid-menu-wrap" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="painter-grid-menu-btn"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <DashboardIcon name="moreHorizontal" size={16} strokeWidth={2} />
          </button>
          {menuOpen ? (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div className="painter-grid-menu dash-modal-surface-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen(painter);
                  }}
                >
                  View profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(painter);
                  }}
                >
                  Edit painter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(painter);
                  }}
                >
                  Delete painter
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="painter-grid-copy">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <h3 style={{ minWidth: 0 }}>{painter.name || "Unnamed Painter"}</h3>
          <Pill tone={painterTypeTone(painter.type)} size="small">{painterTypeLabel(painter.type)}</Pill>
        </div>
        <div className="painter-grid-location">
          <span className="painter-grid-dot" style={{ "--dot-color": palette.fg }} aria-hidden="true" />
          {painter.address || "No address on file"}
        </div>
        <div className="painter-grid-phones">{formatPhones(painter.phones)}</div>
      </div>

      <div className="painter-grid-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="painter-grid-action-btn" onClick={() => onEdit(painter)} aria-label="Edit painter" title="Edit">
          <DashboardIcon name="edit" size={15} strokeWidth={1.8} />
        </button>
        <button type="button" className="painter-grid-action-btn" onClick={() => onDelete(painter)} aria-label="Delete painter" title="Delete">
          <DashboardIcon name="trash" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </article>
  );
}

export default function AdminPaintersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [type, setType] = useState("ALL");
  const [view, setView] = useState(getInitialView);
  const [formPainter, setFormPainter] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  const paintersQuery = useGetAdminPaintersQuery({ q: search, sort, type, limit: 1000 });
  const [createPainter, { isLoading: creating }] = useCreatePainterMutation();
  const [updatePainter, { isLoading: updating }] = useUpdatePainterMutation();
  const [deletePainter, { isLoading: deleting }] = useDeletePainterMutation();

  const painters = useMemo(() => paintersQuery.data?.items || [], [paintersQuery.data]);
  const loading = paintersQuery.isLoading && painters.length === 0;
  const isRefreshing = !loading && paintersQuery.isFetching;
  const error = actionError || (paintersQuery.error ? getQueryErrorMessage(paintersQuery.error, "Failed to load painters.") : "");

  function openAddForm() {
    setFormPainter(null);
    setActionError("");
    setFormOpen(true);
  }
  function openEditForm(painter) {
    setFormPainter(painter);
    setActionError("");
    setFormOpen(true);
  }
  function openProfile(painter) {
    navigate(`/admin/dashboard/painters/${painter._id}`);
  }

  async function handleSave(payload) {
    try {
      setActionError("");
      if (formPainter?._id) {
        await updatePainter({ painterId: formPainter._id, payload }).unwrap();
      } else {
        await createPainter(payload).unwrap();
      }
      setFormOpen(false);
      setFormPainter(null);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to save painter."));
    }
  }

  async function handleDelete() {
    if (!deleteTarget?._id) return;
    try {
      await deletePainter(deleteTarget._id).unwrap();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to delete painter."));
      setDeleteTarget(null);
    }
  }

  function handleExport() {
    exportToCsv(
      "painters",
      [
        { key: "name", label: "Name" },
        { key: "phones", label: "Phones", value: (p) => (p.phones || []).join(" / ") },
        { key: "address", label: "Address" },
        { key: "notes", label: "Notes" },
      ],
      painters,
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />
      <Surface padding={0} className="painter-nav-panel dash-fade-up">
        <div className="painter-nav-top">
          <div className="painter-nav-heading">
            <h1>Painters</h1>
            <p>Contact directory for painters and contractors Meitu Paints works with.</p>
          </div>

          <div className="painter-nav-actions">
            <div className="painter-nav-search">
              <SearchField value={search} onChange={setSearch} placeholder="Search painters…" />
            </div>
            <button type="button" className="painter-nav-icon-btn" onClick={handleExport} aria-label="Export painters">
              <DashboardIcon name="download" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`painter-nav-icon-btn ${view === "list" ? "active" : ""}`}
              onClick={() => updateView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <DashboardIcon name="list" size={16} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={`painter-nav-icon-btn ${view === "grid" ? "active" : ""}`}
              onClick={() => updateView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <DashboardIcon name="overview" size={16} strokeWidth={1.9} />
            </button>
            <PrimaryButton icon="plus" onClick={openAddForm}>
              Add Painter
            </PrimaryButton>
          </div>
        </div>

        <div className="painter-nav-filters">
          <div className="painter-nav-filters-left">
            <AppleDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} style={{ width: 176 }} />
            <AppleDropdown value={type} options={TYPE_FILTER_OPTIONS} onChange={setType} style={{ width: 160 }} />
          </div>
          <div className="painter-nav-filters-right">
            <span className="painter-nav-count">
              {painters.length.toLocaleString()} Painter{painters.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {error ? <div className="painter-nav-error">{error}</div> : null}
        {isRefreshing ? <div className="painter-nav-updating">Updating painters…</div> : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ display: "grid", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: 60,
                  borderRadius: 12,
                  background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            ))}
          </div>
        </Surface>
      ) : painters.length === 0 ? (
        <EmptyState icon="user" title="No painters found" subtitle="Try adjusting the search, or add a new painter to the directory." />
      ) : view === "list" ? (
        <Surface padding={0} className="dash-fade-up">
          {painters.map((painter) => (
            <PainterListRow key={painter._id} painter={painter} onOpen={openProfile} onEdit={openEditForm} onDelete={setDeleteTarget} />
          ))}
        </Surface>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 264px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
          className="dash-fade-up"
        >
          {painters.map((painter) => (
            <PaintersGridCard key={painter._id} painter={painter} onOpen={openProfile} onEdit={openEditForm} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <PainterFormModal
        key={formPainter?._id || "new"}
        open={formOpen}
        painter={formPainter}
        saving={creating || updating}
        error={actionError}
        onClose={() => {
          if (!creating && !updating) {
            setFormOpen(false);
            setFormPainter(null);
          }
        }}
        onSave={handleSave}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete painter?"
        description={`This will remove ${deleteTarget?.name || "this painter"} from the directory. This cannot be undone.`}
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <style>{`
        .painter-nav-panel{
          overflow:visible;
          border-radius:20px !important;
          background:#fff !important;
        }
        .painter-nav-top{
          padding:20px 24px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:18px;
          flex-wrap:wrap;
        }
        .painter-nav-heading{
          min-width:0;
        }
        .painter-nav-heading h1{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:30px;
          line-height:1.1;
          font-weight:800;
          letter-spacing:-.03em;
        }
        .painter-nav-heading p{
          margin:4px 0 0;
          color:var(--color-graphite,#707070);
          font-size:13.5px;
          line-height:1.45;
          font-weight:500;
        }
        .painter-nav-actions{
          flex:0 0 auto;
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .painter-nav-search{
          width:200px;
        }
        .painter-nav-icon-btn{
          width:38px;
          height:38px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:11px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, border-color .14s ease, transform .14s var(--ease-out, ease);
        }
        .painter-nav-icon-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .painter-nav-icon-btn:active{
          transform:scale(.93);
        }
        .painter-nav-icon-btn.active{
          border-color:rgba(0,113,227,.24);
          background:rgba(0,113,227,.08);
          color:var(--color-azure,#0071e3);
        }
        .painter-nav-filters{
          padding:14px 24px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
        }
        .painter-nav-filters-left{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .painter-nav-filters-right{
          display:flex;
          align-items:center;
          gap:14px;
          flex:0 0 auto;
        }
        .painter-nav-count{
          color:var(--color-graphite,#707070);
          font-size:13px;
          font-weight:600;
          white-space:nowrap;
        }
        .painter-nav-error{
          margin:0 24px 16px;
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          border:1px solid rgba(180,35,24,.14);
          font-size:13px;
          font-weight:600;
        }
        .painter-nav-updating{
          padding:0 24px 14px;
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite,#707070);
        }
        .painter-row-action-btn{
          width:30px;
          height:30px;
          border:0;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease;
        }
        .painter-row-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .painter-grid-card{
          position:relative;
          min-height:208px;
          display:flex;
          flex-direction:column;
          border-radius:20px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
          padding:18px;
          cursor:pointer;
          transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .painter-grid-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.16);
          box-shadow:0 14px 30px rgba(0,0,0,.06);
        }
        .painter-grid-card.selected{
          border-color:rgba(0,113,227,.3);
          background:rgba(0,113,227,.04);
        }
        .painter-grid-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .painter-grid-avatar{
          width:44px;
          height:44px;
          border-radius:13px;
          flex:0 0 44px;
          display:grid;
          place-items:center;
          color:var(--avatar-fg, var(--color-azure,#0071e3));
          background:var(--avatar-bg, rgba(0,113,227,.08));
          font-size:15px;
          font-weight:800;
          letter-spacing:-.01em;
        }
        .painter-grid-menu-wrap{
          position:relative;
          flex:0 0 auto;
        }
        .painter-grid-menu-btn{
          width:28px;
          height:28px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:transparent;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .painter-grid-menu-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .painter-grid-menu-btn:active{
          transform:scale(.9);
        }
        .painter-grid-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:160px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .painter-grid-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .painter-grid-menu button:hover{
          background:rgba(0,113,227,.08);
        }
        .painter-grid-copy{
          min-width:0;
          margin-top:14px;
          flex:1 1 auto;
          display:grid;
          align-content:start;
          gap:6px;
        }
        .painter-grid-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:15.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.02em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .painter-grid-location{
          display:flex;
          align-items:center;
          gap:7px;
          color:var(--color-graphite,#707070);
          font-size:12.5px;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .painter-grid-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--dot-color, var(--color-azure,#0071e3));
        }
        .painter-grid-phones{
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite,#707070);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .painter-grid-actions{
          margin-top:16px;
          padding-top:14px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .painter-grid-action-btn{
          width:34px;
          height:34px;
          border:0;
          border-radius:11px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .painter-grid-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .painter-grid-action-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .painter-grid-menu-btn,
          .painter-grid-action-btn,
          .painter-nav-icon-btn{
            transition:none!important;
          }
        }
        @media (max-width:900px){
          .painter-nav-top{
            flex-direction:column;
            align-items:stretch;
          }
          .painter-nav-actions{
            justify-content:space-between;
          }
          .painter-nav-search{
            width:100%;
            flex:1 1 auto;
          }
        }
        @media (max-width:760px){
          .painter-nav-top{
            padding:16px 18px;
          }
          .painter-nav-filters{
            padding:12px 18px;
          }
        }
      `}</style>
    </div>
  );
}
