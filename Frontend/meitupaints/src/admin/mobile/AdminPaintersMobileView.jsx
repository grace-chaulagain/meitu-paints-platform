import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminPaintersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";

const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "TTP", label: "TTP" },
  { key: "RTP", label: "RTP" },
];

function typeTone(type) {
  if (type === "TTP") return "caution";
  if (type === "RTP") return "positive";
  return "neutral";
}

function typeLabel(type) {
  if (type === "TTP") return "TTP";
  if (type === "RTP") return "RTP";
  return "Unclassified";
}

// ID cards only exist for TTP painters, auto-generated (blank) on promotion
// - idCardPhotoAddedAt is the one real signal for a downloadable card, same
// helper AdminPaintersPage.jsx already uses (painterIdStatusKey), copied
// here since it isn't exported.
function idStatus(painter) {
  if (painter.type !== "TTP") return null;
  return painter.idCardPhotoAddedAt
    ? { tone: "positive", label: "ID Ready" }
    : { tone: "caution", label: "Photo Needed" };
}

// Client-side fuzzy search + type filter over one {limit:1000} fetch -
// ~150 painters total, same "fetch everything, filter locally" pattern as
// Catalog/Dealers/Dispatchers mobile this phase, rather than desktop's
// per-keystroke server search.
export function AdminPaintersMobileView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");

  const paintersQuery = useGetAdminPaintersQuery({ limit: 1000 });
  const painters = useMemo(() => paintersQuery.data?.items || [], [paintersQuery.data]);

  const byType = useMemo(() => {
    if (type === "ALL") return painters;
    return painters.filter((painter) => painter.type === type);
  }, [painters, type]);

  const visible = useMemo(
    () => rankBySearch(byType, query, (painter) => [painter.name, ...(painter.phones || [])]),
    [byType, query],
  );

  const loading = paintersQuery.isLoading && painters.length === 0;
  const loadError = paintersQuery.error ? getQueryErrorMessage(paintersQuery.error, "Failed to load painters.") : "";

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => paintersQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Painters</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Painters" contextLabel={`${visible.length} of ${painters.length}`} />

        <div style={{ marginTop: 6 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone…"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={SEGMENTS} value={type} onChange={setType} />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="user" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No painters found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((painter) => {
              const card = idStatus(painter);
              return (
                <button
                  key={painter._id}
                  type="button"
                  className="admin-m-card admin-m-feed-row"
                  onClick={() => navigate(`/admin/dashboard/painters/${painter._id}`)}
                >
                  <span className="admin-m-feed-icon">
                    <DashboardIcon name="user" size={16} strokeWidth={1.8} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="admin-m-feed-title">{painter.name || "Unnamed Painter"}</span>
                    <span className="admin-m-feed-detail">
                      {painter.phones?.length ? painter.phones.join(", ") : "No phone on file"}
                    </span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <StatusChip tone={typeTone(painter.type)}>{typeLabel(painter.type)}</StatusChip>
                    {card ? <StatusChip tone={card.tone}>{card.label}</StatusChip> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
