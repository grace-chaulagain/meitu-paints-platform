// Masks a sensitive identifier (TTP license ID, RTP citizenship number) for
// dealer-facing display - only the last 4 characters are shown. Admin-facing
// endpoints must never call this; they return the raw stored value.
export function maskId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 4) return "•".repeat(raw.length);
  return `${"•".repeat(raw.length - 4)}${raw.slice(-4)}`;
}
