// "Which of this record's details were never filled in?" - shared by the dealer
// and dispatcher profiles, which each supply their own list of fields.

export function isDetailMissing(value) {
  return !String(value ?? "").trim();
}

// `fields` is [{ key, label }]; returns the ones empty on `record`.
export function findMissingDetails(record, fields) {
  if (!record) return [];
  return fields.filter((field) => isDetailMissing(record[field.key]));
}

// "Phone", "Phone and Email", "Phone, Email and Address".
export function joinDetailLabels(fields) {
  const labels = fields.map((field) => field.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
