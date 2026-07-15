import { useState } from "react";
import { useLazySearchPaintersQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { PrimaryButton } from "../../components/dashboard/DashboardUI.jsx";
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

export default function TtpPainterSearchStep({ onSelect, onBack }) {
  const [licenseId, setLicenseId] = useState("");
  const [searched, setSearched] = useState(false);
  const [triggerSearch, searchState] = useLazySearchPaintersQuery();

  async function handleSearch() {
    const trimmed = licenseId.trim();
    if (!trimmed) return;
    setSearched(true);
    await triggerSearch({ type: "TTP", licenseId: trimmed });
  }

  const results = searchState.data?.items || [];
  const errorMessage = searchState.error ? getQueryErrorMessage(searchState.error, "Could not search painters.") : "";

  return (
    <div>
      <StepHeader title="Find the TTP painter" onBack={onBack} />
      <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Ask the painter for their Painter ID, printed on their Golden License Card.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={licenseId}
          onChange={(event) => setLicenseId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
          placeholder="Painter ID"
          style={INPUT_STYLE}
          autoFocus
        />
        <PrimaryButton onClick={handleSearch} disabled={!licenseId.trim() || searchState.isFetching} style={{ height: 44, flexShrink: 0 }}>
          {searchState.isFetching ? "…" : "Search"}
        </PrimaryButton>
      </div>

      {errorMessage ? (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: "#b42318" }}>{errorMessage}</div>
      ) : null}

      {searched && !searchState.isFetching && !errorMessage ? (
        results.length === 0 ? (
          <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--color-graphite, #707070)", textAlign: "center" }}>
            No TTP painter found with this Painter ID.
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {results.map((painter) => (
              <PainterResultRow
                key={painter._id}
                painter={painter}
                maskedIdLabel={`Painter ID ${painter.licenseIdMasked || "—"}`}
                onClick={() => onSelect(painter)}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
