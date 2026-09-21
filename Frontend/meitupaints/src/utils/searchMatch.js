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

// ---------------------------------------------------------------------------
// Forgiving matcher
// ---------------------------------------------------------------------------
// rankBySearch above needs every query token to literally appear in the text,
// so a slip of the finger ("grase traders") or a shorthand nobody spelled out
// ("gfd", "raiptr") finds nothing. Pickers where the user is hunting for ONE
// known record out of a short list - the scheme-order recipient picker - want
// the opposite bias: always surface the closest few names and let the user's
// eye do the last step, rather than answering "no matches" to a near-miss.
//
// Kept separate from fuzzyScore/rankBySearch on purpose: those back six list
// pages whose behaviour shouldn't shift under them.

// How wrong a single word may be before it stops counting as the same word.
// Short words get no slack - at three characters an edit away is a different
// word ("red" -> "led"), and being generous there matches everything.
function typoBudget(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

// Levenshtein distance, abandoned as soon as it can't come in under `max`.
function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (current[j] < rowBest) rowBest = current[j];
    }
    // Nothing in this row is close enough, and rows only ever get worse.
    if (rowBest > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

// Do the characters of `token` appear in `text` in order (gaps allowed)?
// This is what makes "gfdealer" find "Grace Factory Dealer".
function isSubsequence(token, text) {
  let index = 0;
  for (const char of text) {
    if (char === token[index]) index += 1;
    if (index === token.length) return true;
  }
  return false;
}

// Best score for ONE query token against one candidate string. The ladder runs
// from "typed it exactly" down to "this is roughly the shape of it", so a
// precise match always outranks a lucky fuzzy one.
function looseTokenScore(token, normalizedText) {
  if (!token || !normalizedText) return 0;
  const words = normalizedText.split(" ").filter(Boolean);

  if (normalizedText === token) return 100;
  if (words.includes(token)) return 90;

  // Start of any word: "fact" -> "Grace FACTory Dealer".
  let best = 0;
  for (const word of words) {
    if (word.startsWith(token)) {
      // Covering more of the word is a stronger signal than clipping two letters
      // off a long one.
      best = Math.max(best, 70 + Math.round((token.length / word.length) * 15));
    }
  }
  if (best) return best;

  // Initials: "gfd" -> "Grace Factory Dealer", "rt" -> "RaiP Traders".
  const initials = words.map((word) => word[0]).join("");
  if (token.length > 1 && initials.startsWith(token)) return initials === token ? 80 : 68;

  // Anywhere inside a word: "rader" -> "Traders".
  if (normalizedText.includes(token)) return 55;

  // Misspelt word. Compared against each word and against that word's opening
  // run of the same length, so "grase" matches "grace" inside a longer name and
  // "dispacher" matches "dispatcher".
  const budget = typoBudget(token.length);
  if (budget > 0) {
    let bestDistance = budget + 1;
    for (const word of words) {
      bestDistance = Math.min(bestDistance, editDistance(token, word, budget));
      if (word.length > token.length) {
        bestDistance = Math.min(bestDistance, editDistance(token, word.slice(0, token.length), budget));
      }
      if (bestDistance === 0) break;
    }
    if (bestDistance <= budget) return 50 - bestDistance * 8;
  }

  // Last resort: the letters are all there, in order, somewhere.
  if (token.length >= 3 && isSubsequence(token, normalizedText)) return 25;

  return 0;
}

// Scores a whole query against one candidate's fields. Returns how many of the
// query's tokens landed, so the caller can prefer records that matched all of
// them without throwing away the ones that matched most.
function looseMatch(query, fields) {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return { matched: 0, total: 0, score: 0 };

  const normalizedFields = (fields || []).map((field) => normalize(field)).filter(Boolean);
  let matched = 0;
  let total = 0;

  for (const token of tokens) {
    let best = 0;
    for (const [index, field] of normalizedFields.entries()) {
      // Later fields are supporting detail (contact name, group label), so a hit
      // there counts for slightly less than one in the record's own name.
      const weight = index === 0 ? 1 : 0.75;
      best = Math.max(best, looseTokenScore(token, field) * weight);
    }
    if (best > 0) matched += 1;
    total += best;
  }

  return { matched, total: tokens.length, score: total / tokens.length };
}

// Ranks `items` best-first for a picker that would rather show a near-miss than
// an empty list. Records matching every token win; only if there are none does
// it fall back to those matching some, so a typo in one word still leaves the
// user looking at the right shortlist. A blank query returns `items` unchanged.
//
// `fallbackToPartial: false` drops that last courtesy. Use it where the same
// box accepts something other than a name - the coupon history searches codes
// too, and "GRN-002106" should return no people rather than the two whose
// names happen to share a few letters with it.
export function rankByLooseSearch(items, query, getFields, { fallbackToPartial = true } = {}) {
  if (!normalize(query)) return items;

  const full = [];
  const partial = [];
  for (const item of items) {
    const { matched, total, score } = looseMatch(query, getFields(item));
    if (matched === 0) continue;
    (matched === total ? full : partial).push({ item, matched, score });
  }

  const byScore = (a, b) => b.matched - a.matched || b.score - a.score;
  const pool = full.length || !fallbackToPartial ? full : partial;
  return pool.sort(byScore).map((entry) => entry.item);
}
