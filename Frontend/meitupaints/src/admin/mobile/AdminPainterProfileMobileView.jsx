import { useState } from "react";
import { MobilePushHeader } from "../../dealer/mobile/MobilePushHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { toast } from "../../dealer/mobile/useToast.js";
import { useLazyGetPainterIdCardUrlQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { isPainterBlocked, painterBlockedLabel } from "../dashboard/painters/painterStatus.js";

function money(value, currency = "NPR") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

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

function painterCardFilename(painter) {
  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, "") || "Painter";
  const words = String(painter?.name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Painter-PainterCard.pdf";
  if (words.length === 1) return `${safe(words[0])}-PainterCard.pdf`;
  return `${safe(words[0])}-${safe(words[words.length - 1])}-PainterCard.pdf`;
}

// Read-only profile + two real one-tap actions (Promote to TTP, Download ID
// Card when ready) - matches "less depth" from the just-completed Dealers/
// Dispatchers phase. Explicitly out of scope: Edit/Delete (destructive,
// low-frequency), the Points tab's paginated ledger (lifetime/yearly/monthly
// totals shown instead), Recent Purchases list (summary totals only), and
// PainterIdCardModal's photo-crop flow for painters still "Photo Needed" -
// this view surfaces that state honestly rather than reimplementing the
// cropper, with a note pointing back to desktop.
//
// Suspend/Reinstate is here as well, unlike Edit/Delete: it is the one
// action an admin may need the moment a problem is reported, wherever they
// are, and it is fully reversible.
export function AdminPainterProfileMobileView({
  painter,
  salesSummary,
  loading,
  loadError,
  onBack,
  onPromote,
  promoting,
  onSuspend,
  suspending,
  onReinstate,
  reinstating,
}) {
  const [promoteSheetOpen, setPromoteSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [fetchIdCardUrl] = useLazyGetPainterIdCardUrlQuery();

  if (!loading && (loadError || !painter)) {
    return (
      <div className="dealer-m-order-detail">
        <MobilePushHeader title="Painter" onBack={onBack} />
        <div className="dealer-m-error-card" style={{ marginTop: 16 }}>
          <div className="dealer-m-error-title">{loadError || "This painter could not be found."}</div>
          <button type="button" className="dealer-m-error-retry" onClick={onBack}>
            Back to painters
          </button>
        </div>
      </div>
    );
  }

  const isTtp = painter?.type === "TTP";
  const idReady = isTtp && Boolean(painter?.idCardPhotoAddedAt);
  const blocked = isPainterBlocked(painter);
  const suspended = painter?.status === "SUSPENDED";
  const changingStatus = suspending || reinstating;

  async function handleStatusChange() {
    try {
      if (suspended) {
        await onReinstate();
        toast(`${painter?.name || "Painter"} reinstated`);
      } else {
        await onSuspend(suspendReason.trim());
        setSuspendReason("");
        toast(`${painter?.name || "Painter"} suspended`);
      }
      setStatusSheetOpen(false);
    } catch (err) {
      toast(getQueryErrorMessage(err, suspended ? "Failed to reinstate painter." : "Failed to suspend painter."));
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const { url } = await fetchIdCardUrl(painter._id).unwrap();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download the ID card.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = painterCardFilename(painter);
      link.click();
      URL.revokeObjectURL(objectUrl);
      toast("ID card downloaded");
    } catch (err) {
      toast(getQueryErrorMessage(err, "Failed to download the ID card."));
    } finally {
      setDownloading(false);
    }
  }

  async function handlePromote() {
    try {
      await onPromote();
      setPromoteSheetOpen(false);
      toast(`${painter?.name || "Painter"} promoted to TTP`);
    } catch (err) {
      toast(getQueryErrorMessage(err, "Failed to promote painter."));
    }
  }

  return (
    <div className="dealer-m-order-detail">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <MobilePushHeader title="Painter" onBack={onBack} />
            <div className="dealer-m-skel" style={{ height: 140, marginTop: 16, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 200, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        {painter ? (
          <>
            <MobilePushHeader title={painter.name || "Painter"} onBack={onBack} />

            <div className="dealer-m-order-hero">
              <div className="dealer-m-order-hero-headline">{painter.name || "Unnamed Painter"}</div>
            </div>

            <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusChip tone={typeTone(painter.type)}>{typeLabel(painter.type)}</StatusChip>
              {isTtp ? <StatusChip tone={idReady ? "positive" : "caution"}>{idReady ? "ID Ready" : "Photo Needed"}</StatusChip> : null}
              {blocked ? <StatusChip tone="critical">{painterBlockedLabel(painter)}</StatusChip> : null}
            </div>

            {blocked ? (
              <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: "#b42318" }}>
                Cannot earn points, use the painter portal or be issued an ID card.
                {painter.suspensionReason ? ` Reason: ${painter.suspensionReason}` : ""}
              </div>
            ) : null}

            <div className="admin-m-card" style={{ marginTop: 16 }}>
              <div className="admin-m-section-title">Painter Information</div>
              <div className="admin-m-kv-row" style={{ paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Phone</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>
                  {painter.phones?.length ? painter.phones.join(", ") : "—"}
                </span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Address</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", wordBreak: "break-word" }}>{painter.address || "—"}</span>
              </div>
              <div className="admin-m-kv-row">
                <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Citizenship / Official ID</span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{painter.citizenshipNumber || "—"}</span>
              </div>
              {painter.notes ? (
                <div className="admin-m-kv-row" style={{ display: "block" }}>
                  <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Notes</span>
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>{painter.notes}</div>
                </div>
              ) : null}
              {isTtp ? (
                <>
                  <div className="admin-m-kv-row">
                    <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Painter ID</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{painter.licenseId || "—"}</span>
                  </div>
                  <div className="admin-m-kv-row">
                    <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>License Status</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{painter.licenseStatus || "—"}</span>
                  </div>
                  <div className="admin-m-kv-row">
                    <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>License Issued</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{formatDate(painter.licenseIssuedAt)}</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Reward Points</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>
                    {(painter.totalPoints || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Points</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{money(painter.totalCashReceived)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Cash Received</div>
                </div>
              </div>
            </div>

            <div className="admin-m-card">
              <div className="admin-m-section-title">Purchase Summary</div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{salesSummary.totalCount || 0}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Purchases</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink, #1d1d1f)" }}>{money(salesSummary.totalRevenue)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>Total Spent</div>
                </div>
              </div>
            </div>

            {blocked ? null : !isTtp ? (
              <button type="button" className="dealer-m-newsale-ghost" style={{ marginTop: 8 }} onClick={() => setPromoteSheetOpen(true)}>
                Promote to TTP
              </button>
            ) : idReady ? (
              <PrimaryButton loading={downloading} onClick={handleDownload}>
                Download ID Card
              </PrimaryButton>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", textAlign: "center", padding: "8px 0" }}>
                Add a photo on desktop to finish this painter's ID card.
              </div>
            )}

            {suspended || !blocked ? (
              <button type="button" className="dealer-m-newsale-ghost" style={{ marginTop: 8 }} onClick={() => setStatusSheetOpen(true)}>
                {suspended ? "Reinstate painter" : "Suspend painter"}
              </button>
            ) : null}
          </>
        ) : null}
      </SkeletonSwap>

      <MobileSheet
        open={statusSheetOpen}
        onClose={() => {
          if (!changingStatus) setStatusSheetOpen(false);
        }}
        ariaLabel={suspended ? "Reinstate painter" : "Suspend painter"}
        footer={
          <PrimaryButton loading={changingStatus} onClick={handleStatusChange}>
            {suspended ? "Reinstate" : "Suspend"}
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">
          {suspended ? "Reinstate" : "Suspend"} {painter?.name}?
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          {suspended
            ? "They will be able to earn points and use the painter portal again."
            : "They will not be able to earn points on coupons, use the painter portal or be issued an ID card until reinstated. Points already earned are kept."}
        </div>
        {suspended ? null : (
          <input
            className="dealer-m-newsale-input"
            value={suspendReason}
            onChange={(event) => setSuspendReason(event.target.value)}
            placeholder="Reason (optional, only admins see this)"
            aria-label="Reason for suspension"
            maxLength={300}
          />
        )}
      </MobileSheet>

      <MobileSheet
        open={promoteSheetOpen}
        onClose={() => {
          if (!promoting) setPromoteSheetOpen(false);
        }}
        ariaLabel="Promote to TTP"
        footer={
          <PrimaryButton loading={promoting} onClick={handlePromote}>
            Promote to TTP
          </PrimaryButton>
        }
      >
        <div className="dealer-m-newsale-title">Promote {painter?.name} to TTP?</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          A permanent Painter ID and a blank ID card are generated automatically. A photo can be added on desktop afterward to finish the card.
        </div>
      </MobileSheet>
    </div>
  );
}
