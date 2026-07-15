import { useState } from "react";
import { useLazySearchPaintersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { GhostButton, PrimaryButton } from "../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { PainterResultRow, StepHeader } from "./wizardUI.jsx";

const INPUT_STYLE = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,.1)",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
};

export default function RtpPainterSearchStep({ onSelect, onRegisterNew, onBack }) {
  const [citizenshipNumber, setCitizenshipNumber] = useState("");
  const [searched, setSearched] = useState(false);
  const [triggerSearch, searchState] = useLazySearchPaintersQuery();

  async function handleSearch() {
    const trimmed = citizenshipNumber.trim();
    if (!trimmed) return;
    setSearched(true);
    await triggerSearch({ type: "RTP", citizenshipNumber: trimmed });
  }

  const results = searchState.data?.items || [];
  const errorMessage = searchState.error ? getQueryErrorMessage(searchState.error, "Could not search painters.") : "";

  return (
    <div>
      <StepHeader title="Find the painter" onBack={onBack} />
      <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Ask for their citizenship number or official ID to check if they're already registered.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={citizenshipNumber}
          onChange={(event) => setCitizenshipNumber(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
          placeholder="Citizenship number / official ID"
          style={INPUT_STYLE}
          autoFocus
        />
        <PrimaryButton onClick={handleSearch} disabled={!citizenshipNumber.trim() || searchState.isFetching} style={{ height: 44, flexShrink: 0 }}>
          {searchState.isFetching ? "…" : "Search"}
        </PrimaryButton>
      </div>

      {errorMessage ? (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: "#b42318" }}>{errorMessage}</div>
      ) : null}

      {searched && !searchState.isFetching && !errorMessage && results.length > 0 ? (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {results.map((painter) => (
            <PainterResultRow
              key={painter._id}
              painter={painter}
              maskedIdLabel={`ID ${painter.citizenshipNumberMasked || "—"}`}
              onClick={() => onSelect(painter)}
            />
          ))}
        </div>
      ) : null}

      {searched && !searchState.isFetching && !errorMessage && results.length === 0 ? (
        <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--color-graphite, #707070)", textAlign: "center" }}>
          No painter found with this ID.
        </div>
      ) : null}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.06)" }}>
        <GhostButton onClick={onRegisterNew} style={{ width: "100%", justifyContent: "center" }}>
          <DashboardIcon name="plus" size={13} strokeWidth={2.4} />
          Can't find them? Register new painter
        </GhostButton>
      </div>
    </div>
  );
}
