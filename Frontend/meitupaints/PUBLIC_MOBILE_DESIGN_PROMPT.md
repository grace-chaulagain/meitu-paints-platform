# Public Site Mobile Experience — UI Design Prompt

> Hand this file to the implementing agent as-is. It covers the **public/marketing pages + the authenticated Profile page on mobile (≤768px, design target 390×844)**: Home, Products (+ all category/detail pages), Rate Calculator, Dealership, Horoscope (+ zodiac detail), About, Support, and Profile. The dealer dashboard mobile app (`src/dealer/mobile/`, specs `DEALER_MOBILE_DESIGN_PROMPT*.md`) is the completed reference implementation — this prompt extends that quality bar to the rest of the site. Desktop layouts must not regress; other dashboard roles are out of scope.
>
> **Invoke the `emil-design-eng` skill before writing any animation code.** The V2 dealer spec's "animation constitution" (`DEALER_MOBILE_DESIGN_PROMPT_V2.md` §3: easing tokens, transform/opacity only, transitions-over-keyframes, frequency-gated delight, reduced-motion fallbacks) applies verbatim to every motion in this document.

---

## 1. The diagnosed problem (from a code audit — this is what you are fixing)

Every public page already has an Apple-style **desktop** design (see `DESIGN.md`) with 2–4 media queries. But the mobile treatment is *responsive shrink*, not mobile design. The audited pattern, consistent across all eight pages:

- Grids collapse to `1fr` stacks (`Home.jsx` `.triad-grid`/`.method-grid`, `RateCalculator.jsx` `.rate-product-grid`…) — desktop cards, now full-width and enormous, in a long undifferentiated column.
- Decorative layers are simply hidden (`Home.jsx` hides `.parallax-hero-images` under 560px) — leaving heroes that are still `min-height: 690px` but now mostly empty fog.
- Display type barely shrinks (52px h1 at 560px; RateCalculator clamps to 70px) — one word per line, three scrolls of headline.
- Desktop interaction models survive where they can't work: the rate calculator's sticky estimate side-panel becomes a card you scroll *away from* while adjusting inputs; product "groups" render as vertical walls.

The fix philosophy, per surface: **marketing pages get the Apple product-page treatment at phone scale** (confident but compact type, full-bleed imagery shelves, one CTA per viewport-height); **tool pages (Rate Calculator, forms, Profile, Support) get the dealer-app treatment** (Stripe/Uber-Eats utility patterns: docked summary bars, sheets, segmented controls, toasts).

---

## 2. Shared mobile foundation (build first — every page section below depends on it)

### 2.1 Promote the dealer-mobile primitives to shared components

Move (or re-export from) `src/dealer/mobile/` → `src/components/mobile/`: `AppleSpinner`, `MobileToast` + `useToast`, `MobileSheet` (with its V3 drag-to-dismiss/scroll-lock behavior), `SegmentedControl`, `completionFeedback.js` (the Apple-Pay-style two-note chime + haptic), `useBodyScrollLock`, `useSwipeAction`, and the four easing tokens. The dealer app keeps working via re-exports — do not fork the code. Public pages import from the shared location. One `MobileToast` renderer mounts at the router-layout level so any page can `toast()`.

### 2.2 Public mobile layout + type tokens (marketing scale ≠ dashboard scale)

Define on a `.public-mobile` root scope (applies ≤768px):

```css
--pm-gutter: 20px;         /* marketing breathes more than the 16px dealer app */
--pm-section-gap: 64px;    /* vertical rhythm between sections */
--pm-hero: 38px;           /* page h1 - was 44-52px; still confident, fits 3-4 words/line */
--pm-display: 30px;        /* section h2 */
--pm-title: 22px;          /* card titles */
--pm-body-lg: 17px;        /* lead paragraphs */
--pm-body: 15px;           /* body copy */
--pm-caption: 13px;        /* eyebrows, metadata - uppercase-tracked eyebrows stay 12px */
```

Rules: negative letter-spacing (−0.02em) above 22px; body copy line-height 1.5, max ~28 words per paragraph on mobile (cut copy, don't shrink it); every `<input>`/`<select>`/`<textarea>` ≥16px font-size (iOS zoom trap); touch targets ≥44px; no horizontal overflow at 360px except designed snap-rails.

### 2.3 The three shared motion patterns

1. **Scroll reveal**: sections fade+rise 12px into view (400ms, `--ease-out-strong`), once, via one `useScrollReveal` hook (IntersectionObserver, `margin: -80px`, `once: true`); children may stagger 50ms (first 4 max). This replaces any desktop parallax on mobile. Disabled under `prefers-reduced-motion`.
2. **Snap shelf**: the App Store horizontal rail — full-bleed (`margin-inline: calc(var(--pm-gutter) * -1)`), `scroll-snap-type: x mandatory`, cards `scroll-snap-align: start` with the first card aligned to the text grid, `-webkit-overflow-scrolling: touch`, no visible scrollbar, optional page dots. This is the single biggest tool for converting desktop grids: **a 3-up desktop grid becomes a shelf, not a stack.**
3. **Docked action bar**: a bottom-fixed bar (white, blur backdrop `saturate(180%) blur(20px)`, 0.5px top hairline, safe-area padded) holding the page's one primary action and/or live summary. Appears with a 250ms rise once the user scrolls past the hero CTA (so the CTA is never on screen twice).

### 2.4 Feedback: spinners, toasts, sound

- Every form submit button: in-button `AppleSpinner` (width unchanged), disable during flight.
- Success = `toast("Message sent", ✓)` **+ `playCompletion()`** for the rare, meaningful completions only: inquiry sent, dealership application submitted, support message sent, profile saved. Failures: inline error text near the field + a toast only if the error is non-local (network). Never a browser `alert()` — grep the target pages and remove any.
- Page-level loading (profile fetch): skeletons matching final layout, crossfading to content (V3 §5.5 pattern). Static-JSON-driven pages (products, colors) render instantly — no fake spinners.

---

## 3. Page-by-page specifications

### 3.1 Home — `src/Home.jsx`

The mobile Home is an Apple product page at phone scale: a sequence of full-width "moments," each one idea + one visual + at most one link.

1. **Hero**: cut `min-height` to `~78svh`. Eyebrow 12px uppercase-tracked graphite → h1 at `--pm-hero` (rewrite to a ≤6-word line if needed) → one line of `--pm-body-lg` → single azure pill CTA + one text link. Below the copy, **do not hide the parallax cards** — replace them with one composed visual: a static cluster of 2 product-image cards (large + small overlapping, 20px radius, slight rotation ±3°) that drifts up 8px on scroll reveal. The hero must fit copy + visual + CTA in the first viewport.
2. **Product triad** (`.home-product-triad`): 3-up grid → **snap shelf** of 3 cards (~78vw wide, image-on-fog top, title `--pm-title`, one-line description, "Learn more" text link). Page dots beneath.
3. **System showcase / method sections**: keep single-column but redesign the cards compact (icon 28px on fog circle, title 17px, 2-line copy max); stagger-reveal.
4. **Color stage** (`.home-color-stage` / `.color-matrix`): the matrix becomes a full-bleed **swipeable color strip** — two staggered rows of 44px rounded swatches in a snap-free horizontal scroll (overflow is the invitation), tapping any swatch deep-links to `/colors` with that shade preselected if the route supports it, else just `/colors`. Copy above: h2 + one line.
5. **Dealer band** (`.dealer-band`): the one dark moment on mobile Home — ink card, white copy, azure pill "Become a dealer". Keep it to one screen-height max.
6. **Final CTA** (`.final-home-cta`): h2 at `--pm-display` (not 52px), one pill. Delete redundant links.
7. Section rhythm: `--pm-section-gap` between all bands; total page height should drop by ~40% vs. the current stacked mobile render.

### 3.2 Products hub — `src/pages/Products.jsx` (+ category pages `src/productsPages/*.jsx`, detail `ProductDetails.jsx`)

The App Store storefront model: browse by shelf, drill into a category, land on a product page with one action.

- **Hub**: compact header (title "Products" `--pm-hero`, one-line subtitle). The category controls become a **sticky pill rail** under the blur header (horizontal scroll, fog pills, active = ink/white — same component family as the dealer catalog chips). Each category group (`.group-head` + grid) becomes: group header row (kicker 12px, title `--pm-title`, "See all →" 15px azure trailing) + a **snap shelf** of product tiles (~40vw wide: square image on fog 16px radius, name 15px/600 2-line clamp, sizes count 13px graphite). The "all products" grid (`.products-all-grid`), where kept, is 2-col with 12px gaps — never 1-col walls.
- **Category pages** (Regular/Granite/Primer/Specialty/Putting/Utilities × 2 variants each): shared treatment via their common structure — hero shrinks to title + one line (no 400px+ stage), then a 2-col tile grid with stagger-reveal. These six page pairs are siblings; fix them with one shared CSS/pattern pass, not six bespoke ones.
- **Product detail** (`ProductDetails.jsx`): gallery becomes an edge-to-edge snap carousel with dots (images on white); below: name `--pm-display`, category eyebrow, price/size info as a clean spec list (label graphite / value ink rows, hairline-separated); long description collapses behind "Read more" (0fr/1fr expand). **Docked action bar** (§2.3) with the page's primary action ("Enquire about this product" → `/inquiry` prefilled) — the Apple buy-bar, and the only azure on screen once docked.

### 3.3 Rate Calculator — `src/pages/RateCalculator.jsx` (the flagship tool conversion)

Desktop is a two-panel workspace with a sticky estimate card — on mobile the estimate must never leave the screen. Convert to the **Uber-Eats-basket model**:

1. **Hero**: collapse to title + one line + metrics as a 3-up compact stat row (the dealer-Home stats card pattern, `tabular-nums`); kill the orbiting stage cards entirely on mobile (`.rate-stage-*`) — they are decoration the tool doesn't need.
2. **Workspace**: single column, in task order: product picker (2-col tile grid, selected = azure border + check, the dealer pack-selector language) → segments/size inputs (48px fields, `inputMode="decimal"` on every numeric input so phones show the number pad, unit suffixes inside the field) → area/coats controls as `SegmentedControl`s where the options are enumerable.
3. **The estimate becomes a docked bar** (§2.3): always-visible bottom bar showing `Estimate · NPR 42,500` (live, blur-crossfade on change, tabular). Tapping it expands a **MobileSheet** with the full breakdown (`.rate-result-card` content: line items, coverage math, disclaimers) + "Send as inquiry" azure pill. This is Stripe's checkout-summary confidence: the number is always one glance away while inputs are being edited.
4. Estimate changes: never animate on every keystroke — debounce visual updates ~250ms; the bar's number blur-crossfades (2px, 150ms).
5. Empty state (nothing selected): docked bar reads "Select a product to estimate" in graphite, sheet disabled.

### 3.4 Dealership — `src/pages/Dealership.jsx` (+ `DealershipRegistration.jsx`)

A pitch page that ends in a form — Apple narrative up top, Stripe form below.

- **Pitch**: hero → `--pm-hero` + one paragraph + azure "Apply now" (anchors to the form/registration route). `.dealer-portal-card` (the portal preview) becomes a framed screenshot card with a subtle 3° tilt flattening to 0° on scroll reveal — one card, not the orbit composition. `.dealer-process`/`.dealer-step-grid`: a **vertical timeline** (numbered 28px circles, connecting hairline, step title 17px + 2-line copy, sequential reveal — the order-status-rail language applied to a narrative). `.dealer-value-grid`: 2-col compact benefit cards. Docked "Apply now" bar appears after the hero (§2.3).
- **Registration form**: single column, grouped into white cards by topic (Business / Contact / Location) with 13px uppercase group labels; 48px fields, floating or top-aligned labels (pick the codebase's existing convention), inline validation on blur (field-level 13px caution text — never a summary wall at the top); submit with in-button spinner → full-screen success moment (the dealer-app order-placed pattern: drawn checkmark, "Application received", what-happens-next line, `playCompletion()`).

### 3.5 Horoscope — `src/pages/Horoscope.jsx` + `src/pages/ZodiacDetails.jsx`

The playful surface — it earns slightly more motion, still inside the constitution.

- **Index**: hero collapses to title + line. The zodiac grid becomes a **2-col card grid** (12px gaps): each card = sign glyph, name 17px/600, date range 13px graphite, and its 3 color swatches as 16px dots; stagger-reveal in 2s and 4s. `.horo-orbit` (the orbit composition) is desktop-only.
- **Detail** (`ZodiacDetails.jsx`): the `room-console` preview is the hero — make it **full-bleed at the top** (edge-to-edge, ~46svh), with the recommended color chips as a horizontal snap rail beneath; tapping a chip repaints the room (existing logic) with a 300ms crossfade — add a 2px blur during the swap (the emil blur-mask trick) so wall recolors feel physical. Copy cards single-column below. **Prev/next sign navigation**: sticky footer row with `‹ Gemini` / `Leo ›` text buttons (14px azure) — cheap, native-feeling lateral travel; full swipe-navigation between signs is optional polish, only via the shared `useSwipeAction` mechanics if added.
- Sound: none on this page (browsing, not completing).

### 3.6 About — `src/pages/About.jsx`

Pure editorial, the easiest conversion: single column, `--pm-section-gap` rhythm. Hero statement at `--pm-hero`; `.about-metrics` → 3-up compact stat row with the shared count-up hook (`useCountUp`, once, on reveal); `.about-card-grid` → stacked cards with staggered reveal; `.about-dark-band` keeps its dark moment but at ~1 viewport max; final CTA one pill. No shelves needed — About should read like an Apple Newsroom piece: fast, confident, done in 4 scrolls.

### 3.7 Support — `src/pages/Support.jsx`

Uber-Eats help-center clarity:

- **Contact paths first** (`.support-path-grid`): 2-col action cards — Call (tel: link), Email (mailto:), Message (scrolls to form) — icon on fog circle, 15px/600 label. These are the 80% case; they go above the FAQ.
- **FAQ** (`.support-faq*`): native **accordions** — white cards, 15px/600 question rows (44px+ targets), chevron rotating 180° (200ms), answer expanding via `grid-template-rows: 0fr→1fr` + fade (250ms, `--ease-in-out-strong`); one open at a time. This replaces any grid of always-open Q&A cards.
- **Message form**: same form language as §3.4; success = existing `.support-toast` replaced by the shared `MobileToast` + `playCompletion()`.

### 3.8 Profile — `src/profile/ProfilePage.jsx`

The Apple-ID settings pattern (this is an authenticated utility — dealer-app rules, not marketing rules):

- **Hero**: centered 72px avatar (ring, edit badge), name 20px/700, role/email 14px graphite. No card.
- **Details** (`.profile-detail-row`s): grouped white cards of 52px rows — 13px graphite label / 15px ink value, hairline-separated *within* a card, 12px gaps *between* topic cards (Account / Security / Preferences). Rows that open editors get chevrons.
- **Editing**: field edits open a **MobileSheet** (shared, drag-dismissable) with the single field focused + Save `PrimaryButton` — never inline-morphing forms on the settings list (the iOS Settings drill-in feel, one field at a time). Save: in-button spinner → sheet dismisses → `toast("Saved", ✓)` + `playCompletion()`.
- Password/security actions follow the same sheet pattern. Logout: full-width plain row, ink text, at the bottom — no red.
- Skeleton on first load (avatar circle + row bars), crossfade in.

### 3.9 NavBar — `src/components/NavBar.jsx` (light touch only)

The mobile menu panel already exists and is Apple-styled. This pass only: ① verify the open panel uses `useBodyScrollLock` (background must not scroll — same defect class as the V3 sheet fix); ② panel items get stagger-in (30ms) and `:active` scale 0.97; ③ the bar gains its blur + hairline only when scrolled (scroll-edge effect, matching the dealer app's `LargeTitleHeader`); ④ safe-area top padding on notched devices. Do not restructure the menu.

---

## 4. Search intelligence — sitewide fuzzy matching (confirmed defect, fix with one shared utility)

**Defect**: every search on the site is a naive whole-string `String.includes()` — `DealerCatalogPage.jsx` (~line 592-599), `productsPages/meituColors.jsx` (341, 544), `productsPages/meituTextures.jsx` (55), `productsPages/ProductCollectionPage.jsx` (89), and `NavBar.jsx`'s site search scorer (357-360). Concrete failure: searching **"Eco friendly"** does not find **"Meitu Eco-Friendly Paint"** — the hyphen defeats the substring. Punctuation, word order, partial words, and small typos all break matching.

**Fix — one shared ranked matcher, `src/utils/searchMatch.js`, used by every search box:**

- **Normalization** (applied to both query and item fields): lowercase → Unicode NFD + strip diacritics → replace `[-_/&+.,()]` with spaces → collapse whitespace. After this, "Eco-Friendly" and "eco friendly" are identical token streams.
- **API**: `buildSearchIndex(items, fields)` precomputes per-item normalized token arrays + a fully-joined string per field (compute once per catalog via `useMemo` — catalogs here are static/small, no worker needed); `searchRank(index, query)` returns items with `score > 0`, sorted by score descending (stable by name).
- **Matching (AND across query tokens, best-field scoring per token)** — each query token must match *somewhere*; per token take the best of:
  - exact token match — 3.0
  - token prefix ("prim" → "primer") — 2.5
  - token substring — 1.5
  - joined-string substring ("ecofriendly" → "…ecofriendlypaint…") — 1.5 (catches users who drop the space entirely)
  - fuzzy: edit distance ≤1 for query tokens ≥4 chars, ≤2 for ≥7 chars ("freindly" → "friendly") — 1.0
  - any token failing all of these → item score 0 (no noise from partial-token junk)
- **Field weights**: name ×3, code/sku ×2, category/pack-label ×1; plus a +2 bonus when the *whole* normalized query appears in the normalized name (keeps literal matches on top).
- **Wire-in** (replace, don't wrap, the existing filters): dealer catalog search; colors + textures search; `ProductCollectionPage` haystack; NavBar site search (its hand-rolled 2/1/0.5 scorer is replaced by the shared ranker — its result *ordering* now comes from `searchRank`). Category filters still apply as hard pre-filters before ranking.
- **UX of ranked results**: results render in score order (not catalog order) whenever a query is active; empty-result states keep their existing designs. Debounce ranking at ~150ms on keystroke; never show a spinner for local search.
- **Acceptance tests** (add as comments or a tiny test block the agent must actually run in the browser): "Eco friendly", "eco-friendly", "ecofriendly", and "eco freindly" all surface "Meitu Eco-Friendly Paint" first; "20L silk" finds the Silk family; "prim" surfaces Primers; a nonsense query ("xqzw") returns the empty state.

## 5. Engineering constraints

- No new dependencies. All motion CSS/WAAPI per the constitution; snap shelves are pure CSS scroll-snap.
- Shared primitives from §2.1 only — if a page hand-rolls a second toast/spinner/sheet, that is a defect.
- Each page keeps its existing data flow (static JSON catalogs, RTK Query where present); this is a presentation pass.
- Work page-by-page in this order (risk-ascending): About → Support → Profile → Horoscope → Dealership → Products → Home → Rate Calculator. Verify each at 390×844 and 360×780 in the browser before moving on; `npm run lint` clean at the end.
- Desktop (>768px) renders must be pixel-unchanged — all new rules scoped under mobile media queries or the `.public-mobile` scope.

## 6. Verification protocol (mandatory — the previous attempt at this spec produced zero file changes)

This spec is not done until each item below is *demonstrated*, not claimed:

1. After each page in the §5 build order, run `git diff --stat` and confirm the page's file (and only intended files) changed. **If a page section is "done" but its file shows no diff, the work did not happen.** Target files: `src/Home.jsx`, `src/pages/Products.jsx`, `src/pages/RateCalculator.jsx`, `src/pages/Dealership.jsx`, `src/pages/DealershipRegistration.jsx`, `src/pages/Horoscope.jsx`, `src/pages/ZodiacDetails.jsx`, `src/pages/About.jsx`, `src/pages/Support.jsx`, `src/profile/ProfilePage.jsx`, `src/components/NavBar.jsx`, plus the new `src/components/mobile/` and `src/utils/searchMatch.js`.
2. View every page in a browser at 390×844 (dev server + responsive mode) and check its §3 spec points visually before moving to the next page.
3. Run the §4 search acceptance queries live in the dealer catalog and one public search surface.
4. Finish with `npm run lint` and a final `git diff --stat` summary listing every touched file against the target list above.

## 7. Acceptance checklist

- [ ] No page shows a >45svh hero, a >40px headline, or an empty region where desktop decoration was hidden (Home hero ~78svh with its composed visual is the sanctioned exception).
- [ ] Every desktop 3-up+ grid is a snap shelf or a 2-col grid on mobile — zero full-width card stacks of 3+ identical cards.
- [ ] Rate calculator: estimate visible 100% of the time via the docked bar; breakdown opens as a drag-dismissable sheet; numeric inputs raise the number keyboard.
- [ ] Product detail, Dealership, and (post-hero) Home show exactly one docked/visible azure action.
- [ ] All forms: ≥16px inputs, inline validation, in-button spinner, toast + completion sound on success; zero `alert()` calls remain.
- [ ] Support FAQ accordions animate via 0fr/1fr; one open at a time; chevrons rotate.
- [ ] Profile edits happen in shared MobileSheets with drag-to-dismiss and body scroll lock; NavBar panel also locks background scroll.
- [ ] Scroll reveals fire once, stagger ≤4 items, and vanish under `prefers-reduced-motion`.
- [ ] Search: "Eco friendly", "eco-friendly", "ecofriendly", and "eco freindly" all rank "Meitu Eco-Friendly Paint" first in every search surface; all `.includes()`-only filters are gone; results are score-ordered.
- [ ] 360px wide: no horizontal overflow anywhere except designed snap rails; all targets ≥44px.
- [ ] Desktop screenshots before/after are identical for all eight pages.
