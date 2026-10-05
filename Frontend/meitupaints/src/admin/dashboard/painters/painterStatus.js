// The admin UI's reading of Painter.status - the same rule the server
// enforces in painter.service.js:isPainterBlocked. Only ACTIVE (or a legacy
// record with no status) can earn on coupons, use the painter portal or be
// issued an ID card.
export function isPainterBlocked(painter) {
  return Boolean(painter?.status) && painter.status !== "ACTIVE";
}

// "Suspended" is the only one an admin sets from here; the other two exist in
// the schema and are labelled honestly if a record ever carries them.
export function painterBlockedLabel(painter) {
  if (painter?.status === "BLACKLISTED") return "Blacklisted";
  if (painter?.status === "INACTIVE") return "Inactive";
  return "Suspended";
}
