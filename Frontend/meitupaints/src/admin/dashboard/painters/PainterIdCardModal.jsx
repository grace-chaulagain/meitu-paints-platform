import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { GhostButton, PrimaryButton, SectionHeader, Spinner, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import {
  useLazyGetPainterIdCardPhotoUrlQuery,
  useLazyGetPainterIdCardTemplateQuery,
  useLazyGetPainterIdCardUrlQuery,
  useRegeneratePainterIdCardWithPhotoMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";

// The template's own photo-placeholder geometry (painterIdCardTemplate.svg,
// the <path fill="#D9D9D9">, 1560x1000 viewBox) - kept in sync with the
// identical constants in Server/src/services/painterIdCard.service.js. If
// the template artwork ever changes, re-derive both from the new file.
const PHOTO_BBOX_SVG = { x: 98, y: 395, width: 311, height: 373 };
const CROP_ASPECT = PHOTO_BBOX_SVG.width / PHOTO_BBOX_SVG.height;
const OUTPUT_WIDTH = PHOTO_BBOX_SVG.width * 2;
const OUTPUT_HEIGHT = PHOTO_BBOX_SVG.height * 2;
const OVERLAY_STYLE = {
  position: "absolute",
  left: `${(PHOTO_BBOX_SVG.x / 1560) * 100}%`,
  top: `${(PHOTO_BBOX_SVG.y / 1000) * 100}%`,
  width: `${(PHOTO_BBOX_SVG.width / 1560) * 100}%`,
  height: `${(PHOTO_BBOX_SVG.height / 1000) * 100}%`,
  borderRadius: `${(22 / PHOTO_BBOX_SVG.width) * 100}% / ${(22 / PHOTO_BBOX_SVG.height) * 100}%`,
  overflow: "hidden",
};

// "FirstName-LastName-PainterCard.pdf" - mirrors
// AdminPainterProfilePage.jsx's own filename helper exactly (kept as a
// local copy rather than a shared import - this is the only other call site).
function painterCardFilename(painter) {
  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, "") || "Painter";
  const words = String(painter?.name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Painter-PainterCard.pdf";
  if (words.length === 1) return `${safe(words[0])}-PainterCard.pdf`;
  return `${safe(words[0])}-${safe(words[words.length - 1])}-PainterCard.pdf`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getCroppedPhotoBlob(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
      );
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo."))), "image/jpeg", 0.92);
    };
    image.onerror = () => reject(new Error("Could not load the selected photo."));
    image.src = imageSrc;
  });
}

// The template artwork with the photo slot either showing the real photo
// (croppedPhotoUrl set) or a quiet placeholder glyph - the one preview
// surface reused across every step so the card never looks like a
// different component mid-flow.
function CardPreview({ templateSvgUrl, photoUrl, placeholderIcon, placeholderTone }) {
  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.08)", background: "var(--color-fog,#f5f5f7)" }}>
      {templateSvgUrl ? (
        <img src={templateSvgUrl} alt="ID card template" style={{ display: "block", width: "100%" }} />
      ) : (
        <div style={{ width: "100%", paddingTop: `${(1000 / 1560) * 100}%` }} />
      )}
      <div
        style={{
          ...OVERLAY_STYLE,
          display: "grid",
          placeItems: "center",
          background: photoUrl ? "transparent" : "rgba(29,29,31,.05)",
        }}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="Painter headshot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <DashboardIcon name={placeholderIcon} size={26} strokeWidth={1.6} style={{ color: placeholderTone }} />
        )}
      </div>
    </div>
  );
}

function PickStep({ onPick }) {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
      style={{
        marginTop: 16,
        height: 220,
        borderRadius: 14,
        border: "1.5px dashed rgba(29,29,31,.18)",
        background: "var(--color-fog,#f5f5f7)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        textAlign: "center",
        padding: 20,
      }}
    >
      <div>
        <DashboardIcon name="camera" size={26} strokeWidth={1.5} style={{ color: "var(--color-graphite,#707070)" }} />
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>Choose a photo</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--color-graphite,#707070)" }}>
          Click to browse or drag an image here
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function AdjustStep({ imageSrc, crop, zoom, onCropChange, onZoomChange, onCropComplete }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: "relative", width: "100%", height: 340, borderRadius: 14, overflow: "hidden", background: "#1d1d1f" }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={CROP_ASPECT}
          cropShape="rect"
          showGrid={false}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
        />
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <DashboardIcon name="camera" size={13} strokeWidth={1.8} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          style={{ flex: 1 }}
          aria-label="Zoom"
        />
      </div>
    </div>
  );
}

// Facebook/DP-style "pick -> adjust -> preview -> ready" flow, entered
// exclusively from the single "Download ID Card" action. The photo is
// never uploaded or stored on its own - only the final generated PDF is
// (see painter.service.js:regeneratePainterIdCardWithPhoto) - so the entry
// step can only ever show a placeholder glyph in the photo slot for an
// already-existing card, never the real photo, by design. The parent only
// mounts this component while open, so every open is a fresh instance -
// no reset-on-close effect needed.
export default function PainterIdCardModal({ painter, onClose, onGenerated }) {
  // idCardGeneratedAt alone is NOT proof a photo exists - it's also set by
  // the blank-photo card auto-generated on TTP promotion. idCardPhotoAddedAt
  // is only ever set by a successful photo upload (see
  // painter.service.js:regeneratePainterIdCardWithPhoto), so it's the one
  // true signal for "there's a real card to download."
  const hasPhoto = Boolean(painter?.idCardPhotoAddedAt);
  const [step, setStep] = useState("entry");
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPhotoUrl, setCroppedPhotoUrl] = useState("");
  const [croppedPhotoBlob, setCroppedPhotoBlob] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [fetchTemplate, templateQuery] = useLazyGetPainterIdCardTemplateQuery();
  const [regenerate, { isLoading: generating }] = useRegeneratePainterIdCardWithPhotoMutation();
  const [fetchIdCardUrl, { isFetching: downloading }] = useLazyGetPainterIdCardUrlQuery();
  const [fetchPhotoUrl, photoUrlQuery] = useLazyGetPainterIdCardPhotoUrlQuery();

  const templateSvgUrl = useTemplateObjectUrl(templateQuery.data);
  const existingPhotoUrl = photoUrlQuery.data?.url || "";

  // The entry step's preview needs the template immediately, unlike the
  // old photo-only modal which could wait until the first crop completed.
  // The saved headshot is fetched the same way, but only when there's
  // actually one on file - fetching it for a photo-less card would just 404.
  useEffect(() => {
    fetchTemplate();
    if (hasPhoto) fetchPhotoUrl(painter._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = generating || downloading;

  async function handlePick(file) {
    setError("");
    const dataUrl = await readFileAsDataUrl(file);
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep("adjust");
  }

  async function handleGoToPreview() {
    try {
      setError("");
      if (!croppedAreaPixels) return;
      const blob = await getCroppedPhotoBlob(imageSrc, croppedAreaPixels);
      setCroppedPhotoBlob(blob);
      setCroppedPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setStep("preview");
    } catch (err) {
      setError(err?.message || "Could not process the photo.");
    }
  }

  async function handleGenerate() {
    try {
      setError("");
      await regenerate({ painterId: painter._id, photoBlob: croppedPhotoBlob }).unwrap();
      onGenerated?.();
      setStep("ready");
      setToast({ tone: "success", title: "ID card generated", description: `${painter?.name || "Painter"}'s card is ready to download.` });
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to generate the ID card."));
    }
  }

  async function handleDownload() {
    try {
      setError("");
      const { url } = await fetchIdCardUrl(painter._id).unwrap();
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
      setToast({ tone: "success", title: "ID card downloaded", description: painterCardFilename(painter) });
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to fetch the ID card."));
    }
  }

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 28,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)" }} padding={22}>
        <SectionHeader
          icon="user"
          title="Painter ID Card"
          subtitle={painter?.name || ""}
          action={
            <GhostButton onClick={onClose} icon="close" disabled={busy}>
              Close
            </GhostButton>
          }
        />

        {step === "entry" ? (
          <div style={{ marginTop: 16 }}>
            <CardPreview
              templateSvgUrl={templateSvgUrl}
              photoUrl={existingPhotoUrl}
              placeholderIcon={hasPhoto ? "checkmark" : "camera"}
              placeholderTone={hasPhoto ? "#15803d" : "var(--color-graphite,#707070)"}
            />
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>
              {hasPhoto ? "This painter's ID card is ready" : "Add a photo to generate this ID card"}
            </div>
            <div style={{ marginTop: 4, textAlign: "center", fontSize: 12, color: "var(--color-graphite,#707070)" }}>
              {hasPhoto
                ? "Download the existing card, or generate a brand new one."
                : "A photo is required before this card can be downloaded."}
            </div>
          </div>
        ) : null}

        {step === "pick" ? <PickStep onPick={handlePick} /> : null}

        {step === "adjust" ? (
          <AdjustStep
            imageSrc={imageSrc}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
          />
        ) : null}

        {step === "preview" ? (
          <div style={{ marginTop: 16 }}>
            <CardPreview templateSvgUrl={templateSvgUrl} photoUrl={croppedPhotoUrl} placeholderIcon="camera" placeholderTone="var(--color-graphite,#707070)" />
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-graphite,#707070)", textAlign: "center" }}>
              This is exactly how the printed card will look.
            </div>
          </div>
        ) : null}

        {step === "ready" ? (
          <div style={{ marginTop: 16 }}>
            <CardPreview templateSvgUrl={templateSvgUrl} photoUrl={croppedPhotoUrl} placeholderIcon="checkmark" placeholderTone="#15803d" />
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <DashboardIcon name="checkmark" size={13} strokeWidth={2.6} style={{ color: "#15803d" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>ID card generated</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {step === "entry" ? (
            hasPhoto ? (
              <>
                <GhostButton icon="camera" onClick={() => setStep("pick")}>
                  Generate New Card
                </GhostButton>
                <PrimaryButton onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Spinner size={13} /> : <DashboardIcon name="download" size={15} />}
                  {downloading ? "Preparing…" : "Download ID Card"}
                </PrimaryButton>
              </>
            ) : (
              <PrimaryButton icon="camera" onClick={() => setStep("pick")}>
                Add Photo
              </PrimaryButton>
            )
          ) : null}

          {step === "pick" ? <GhostButton onClick={() => setStep("entry")}>Cancel</GhostButton> : null}

          {step === "adjust" ? (
            <>
              <GhostButton onClick={() => setStep("pick")}>Choose a different photo</GhostButton>
              <PrimaryButton onClick={handleGoToPreview} disabled={!croppedAreaPixels}>
                Preview
              </PrimaryButton>
            </>
          ) : null}

          {step === "preview" ? (
            <>
              <GhostButton onClick={() => setStep("adjust")} disabled={generating}>
                Back to adjust
              </GhostButton>
              <PrimaryButton onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Spinner size={13} /> Generating…
                  </>
                ) : (
                  "Generate ID Card"
                )}
              </PrimaryButton>
            </>
          ) : null}

          {step === "ready" ? (
            <>
              <GhostButton icon="camera" onClick={() => setStep("pick")} disabled={downloading}>
                Choose different photo
              </GhostButton>
              <PrimaryButton onClick={handleDownload} disabled={downloading}>
                {downloading ? <Spinner size={13} /> : <DashboardIcon name="download" size={15} />}
                {downloading ? "Preparing…" : "Download ID Card"}
              </PrimaryButton>
            </>
          ) : null}
        </div>
      </Surface>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// The template endpoint returns raw SVG markup (not JSON) - wrap it as a
// blob URL once per fetch so <img src> can render it. Creating the URL is a
// pure-enough computation from svgText to belong in useMemo (no setState in
// an effect body); the effect's only job is revoking the previous URL.
function useTemplateObjectUrl(svgText) {
  const url = useMemo(() => {
    if (!svgText) return "";
    return URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  }, [svgText]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
