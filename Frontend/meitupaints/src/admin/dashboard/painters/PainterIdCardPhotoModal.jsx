import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { GhostButton, PrimaryButton, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import {
  useLazyGetPainterIdCardTemplateQuery,
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink,#1d1d1f)" }}>Choose a photo</div>
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
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite,#707070)" }}>
          Zoom
        </span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

function PreviewStep({ templateSvgUrl, croppedPhotoUrl }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }}>
        {templateSvgUrl ? <img src={templateSvgUrl} alt="ID card template" style={{ display: "block", width: "100%" }} /> : null}
        <div style={OVERLAY_STYLE}>
          <img src={croppedPhotoUrl} alt="Painter headshot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--color-graphite,#707070)" }}>
        This is exactly how the printed card will look - the Painter ID, name, phone, and issue date are added the same way behind the scenes.
      </div>
    </div>
  );
}

// Facebook/DP-style "pick -> adjust -> preview" flow for compositing a
// headshot into a TTP painter's ID card. The photo is never uploaded or
// stored on its own - only the final generated PDF is (see
// painter.service.js:regeneratePainterIdCardWithPhoto) - so re-opening this
// modal always starts from "no photo on file", by design. The parent only
// mounts this component while open (`{photoModalOpen && <...>}`, not an
// `open` prop it renders null for) so every open is a fresh instance with
// fresh state - no reset-on-close effect needed.
export default function PainterIdCardPhotoModal({ painter, onClose, onGenerated }) {
  const [step, setStep] = useState("pick");
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPhotoUrl, setCroppedPhotoUrl] = useState("");
  const [croppedPhotoBlob, setCroppedPhotoBlob] = useState(null);
  const [error, setError] = useState("");

  const [fetchTemplate, templateQuery] = useLazyGetPainterIdCardTemplateQuery();
  const [regenerate, { isLoading: generating }] = useRegeneratePainterIdCardWithPhotoMutation();

  const templateSvgUrl = useTemplateObjectUrl(templateQuery.data);

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
      if (!templateQuery.data) fetchTemplate();
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
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to generate the ID card."));
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
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)" }} padding={22}>
        <SectionHeader
          title="ID Card Photo"
          subtitle={painter?.name || ""}
          action={
            <GhostButton onClick={onClose} icon="reject" disabled={generating}>
              Close
            </GhostButton>
          }
        />

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

        {step === "preview" ? <PreviewStep templateSvgUrl={templateSvgUrl} croppedPhotoUrl={croppedPhotoUrl} /> : null}

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
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
                {generating ? "Generating…" : "Generate ID Card"}
              </PrimaryButton>
            </>
          ) : null}
        </div>
      </Surface>
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
