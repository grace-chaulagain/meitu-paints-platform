// Shared fuzzy search ranker (ADMIN_MOBILE_DESIGN_PROMPT.md §4.1: "eco
// friendly" must find "Meitu Eco-Friendly Paint"). Token-based rather than
// a single substring test, so word order and punctuation in the query never
// matter - every query token just needs to appear somewhere in the
// candidate text for a match, scored by how good that appearance is.
function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreToken(token, normalizedText) {
  if (!token) return 0;
  if (normalizedText === token) return 4;
  const wordBoundaryStart = normalizedText.startsWith(`${token} `) || normalizedText.startsWith(token) && normalizedText[token.length] === undefined;
  if (normalizedText.startsWith(token)) return wordBoundaryStart ? 3.5 : 3;
  if (normalizedText.includes(` ${token}`)) return 2.5; // matches the start of some later word
  if (normalizedText.includes(token)) return 1.5;
  return 0;
}

// Scores `query` against `text` (both raw strings) - 0 means no match, higher
// is better. Every whitespace-separated token in the query must match
// somewhere in the text (AND, not OR) or the whole thing scores 0, so
// "eco friendly primer" doesn't match a product missing "primer".
export function fuzzyScore(query, text) {
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);
  if (!normalizedQuery) return 0;
  if (!normalizedText) return 0;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let total = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, normalizedText);
    if (tokenScore === 0) return 0;
    total += tokenScore;
  }
  return total / tokens.length;
}

// Ranks `items` against `query` using one or more text fields per item.
// `getFields(item)` returns an array of strings to check (e.g. name, SKU,
// category) - the item's score is the best score across its own fields, so
// a SKU-only match still surfaces even if the name doesn't match at all.
// Returns items sorted best-first; ties keep their original relative order
// (Array.prototype.sort is stable). Empty/blank query returns `items`
// unchanged (nothing to rank against - callers decide what "no query"
// should show).
export function rankBySearch(items, query, getFields) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return items;

  const scored = [];
  for (const item of items) {
    const fields = getFields(item) || [];
    let best = 0;
    for (const field of fields) {
      const score = fuzzyScore(query, field);
      if (score > best) best = score;
    }
    if (best > 0) scored.push({ item, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.item);
}
