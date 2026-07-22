# Meitu Admin OS — Mobile Design Prompt (Dashboard + Catalog)

> Hand this file to the implementing agent as-is. Scope: **the Admin dashboard and Catalog on mobile (≤768px, target 390×844)**, built to the "Meitu Admin OS" vision. The dealer mobile app (`src/dealer/mobile/`) is the shipped reference implementation and the source of all shared primitives. Desktop admin must not regress; other roles are out of scope.
>
> **Invoke the `emil-design-eng` skill before writing any animation code.** The dealer V2 spec's animation constitution (`DEALER_MOBILE_DESIGN_PROMPT_V2.md` §3) is binding here too: easing tokens, transform/opacity only, transitions over keyframes, frequency-gated delight, reduced-motion fallbacks.

---

## 0. Reality check — vision vs. codebase (read before building anything)

The Admin OS vision is the design target, but four parts of it do not match this system. Build the corrected version, never the fictional one.

| Vision says | Reality in this codebase | What to build |
|---|---|---|
| Order tabs: Pending / Approved / **Mixing** / Dispatch / Delivered / Cancelled | `ORDER_STATUS` is exactly six values: `SUBMITTED → VERIFIED → DISPATCHED → COMPLETED`, plus `REJECTED`/`CANCELLED`. `CLAUDE.md` explicitly forbids inventing "mixing"/"packed"/"out for delivery" stages, and there is no `factoryStage` field. | Segments: **All · Submitted · Verified · Dispatched · Completed · Cancelled** (Cancelled bucket = `REJECTED` + `CANCELLED`). Order timeline has **4 nodes**, not 6. Reuse the dealer `StatusRail` component. |
| A **Finance** dashboard section | No finance route exists. The 12 real admin sections are: Overview, Draft Order, Applications, Orders, Sales, Coupons, Dealers, Dispatchers, Painters, Notifications, Insights, Settings. | Do **not** invent a Finance nav item. Revenue/AR-style content belongs in **Insights** (`AdminInsightsPage.jsx`) and **Sales**; coupon settlement already lives in the Coupons section. |
| **Dispatch Center** with live map, trucks, GPS routes | No vehicle, route, or geolocation data exists anywhere in the models. "Dispatchers" are a user role with regional stock and replenishment orders. | Build the **Dispatchers** section as stock + order operations (real data). No map, no truck cards — a fake live map is worse than none. |
| Home hero headline at **56px** | That's a desktop figure; at 390px it is ~4 words per line. | Mobile hero headline **32px**, desktop keeps its current large scale. |

Also note: `src/admin/catalog/components/` contains **five zero-byte orphan files** (`AdminCatalogToolbar.jsx`, `AdminFamilyCard.jsx`, `AdminFamilyFormModal.jsx`, `AdminProductFormModal.jsx`, `AdminVariantTable.jsx`) imported by nothing. Delete them as part of this pass.

**Audited mobile state**: `AdminInsightsPage.jsx` has **zero** media queries (784 lines, desktop-only). `AdminDashboardPage.jsx` has one width breakpoint for 884 lines. `AdminOrdersPage.jsx`, `AdminDealerOrdersPage.jsx`, `AdminDispatcherOrdersPage.jsx`, and `InsightsPrimitives.jsx` render `<table>` elements — horizontal scrolling on a phone. This is the same "responsive shrink, not mobile design" failure the public pages have.

---

## 1. Foundation — reuse, don't rebuild

Import from the shared mobile layer (promote out of `src/dealer/mobile/` into `src/components/mobile/` if not already done, re-exporting so the dealer app keeps working): `AppleSpinner`, `MobileToast` + `useToast`, `MobileSheet` (drag-to-dismiss + body scroll lock), `SegmentedControl`, `StatusRail`, `StatusChip`, `QuantityStepper`, `completionFeedback.js`, `useBodyScrollLock`, `useSwipeAction`, `useCountUp`, the easing tokens, and the `LargeTitleHeader` scroll-collapse pattern. **Any hand-rolled second copy of these in admin code is a defect.**

Admin mobile tokens (scope `.admin-m`, ≤768px):

```css
--am-gutter: 16px;
--am-radius: 20px;        /* mobile cards; desktop keeps 28px */
--am-gap: 12px;           /* between cards - never attached slabs */
--am-hero: 32px;          /* section hero headline */
--am-display: 24px;       /* big numbers */
--am-title: 17px;         /* card titles */
--am-body: 14px;
--am-meta: 12px;          /* eyebrows, metadata */
```

Rules: canvas `--color-fog`, cards `--color-snow`, no shadows, azure `#0071e3` is the only accent (plus the tab-bar tint), all money `tabular-nums`, inputs ≥16px, touch targets ≥44px, no horizontal overflow at 360px.

**Bottom tab bar** (mirror the dealer implementation, filled-glyph active state + azure tint): **Home · Orders · Catalog · Dealers · More**. "More" opens a drawer holding the remaining eight sections (Applications, Sales, Coupons, Dispatchers, Painters, Notifications, Insights, Settings) as Apple-Settings grouped rows. Exactly one tab is active on every admin route.

---

## 2. Admin Home — the Morning Brief (`AdminDashboardPage.jsx` overview)

Three layers, in this order — **what needs attention → what's happening → what I can manage**:

1. **Morning Brief hero** (no card): eyebrow `--am-meta` uppercase-tracked date → "Good morning" `--am-hero`/700 → one plain-language status line ("Business is operating normally." / "3 things need your attention."). Below it, a 3-up stat row on one line: Orders today · Revenue today · Fulfillment %, values `--am-display`/700 with `useCountUp` (once, reduced-motion jumps), each with a 11px delta line ("↑12% vs yesterday") in graphite — **never red/green pairs**, use ↑/↓ glyphs in ink.
2. **Needs attention** — the operational queue. A **snap shelf** (full-bleed, `scroll-snap-align: start`, ~62vw cards) of up to 5 cards, each: count `--am-display`/700 ink, label two lines `--am-body`, tap → the filtered destination. Cards: Orders awaiting review, Ready to dispatch, Inventory alerts, Dealer applications, Painter verifications. **Any card whose count is 0 is omitted entirely** — an empty queue should shrink the shelf, not display zeros. If all are 0, the whole section collapses to a single quiet line: "Nothing needs your attention." That silence is the premium signal.
3. **Revenue** — one chart, full-bleed card. Period `SegmentedControl` (Today · Week · Month · Year) above; chart height **220px on mobile** (the vision's 420px is desktop). Single azure line/area on fog gridlines, no legend, no axis clutter; the current value renders large above the chart and updates on scrub. **Load the `dataviz` skill before writing any chart code.** Period switch: crossfade the series (200ms), never a redraw flash.
4. **Operational feed** — Apple News style, detached cards (`--am-gap`), each: relative time `--am-meta` graphite, one-sentence event in `--am-body` ink with the entity name in 600 weight, and (only where an action is genuinely one-tap and safe) a trailing azure text action. Approve actions open a confirm `MobileSheet` — never fire destructively from the feed. Cap at 15 items with "See all activity →".
5. **Quick actions** — 2-col grid of compact cards (icon on fog circle, 15px/600 label): Create product, Add dealer, Generate painter IDs, View inventory. Not five stacked full-width blocks.

Loading: skeletons matching this layout, crossfading in. Refetch: 2px azure hairline under the header, never a blocking overlay.

---

## 3. Orders (`AdminOrdersPage.jsx`) — the most important page

- **Header**: `LargeTitleHeader` "Orders" with scroll-collapse; trailing circular search icon (icon-activated overlay, per the dealer V3 §2 pattern — no permanently pinned search field). Compact header shows the active filter + count while scrolled.
- **Segments**: `SegmentedControl` with the six real buckets from §0, counts in labels, sliding thumb. Full-bleed scroll if it overflows.
- **Order cards** — detached (`--am-gap` 12px), radius `--am-radius`, padding 16px. Anatomy: dealer/dispatcher name `--am-title`/600 ink; order number + relative time `--am-meta` graphite; amount `--am-display`/700 tabular right-aligned; item count; `StatusChip`. Live orders get a 3px azure left accent bar. **Delete the `<table>` rendering on mobile.**
- **Swipe actions** via `useSwipeAction`: swipe-left on a `SUBMITTED` card reveals **Verify** (azure); swipe-right reveals **Reject** (red — the one sanctioned red UI moment). Both open a confirm `MobileSheet` summarizing the order before committing; success → `toast()` + `playCompletion()` for verify. Never destructive-on-release without confirmation.
- **Order detail** (`AdminOrderDetailPage.jsx`): push header; hero = order number `--am-meta`, dealer name `--am-hero`, total `--am-display`; then the 4-node `StatusRail`; then payment/invoice chips (PDF links as azure text buttons); then items as detached cards with thumbnails; sticky footer holds the single stage-appropriate primary action (Verify / Mark dispatched / Complete). Admin notes and revision history collapse behind "Read more" style disclosure — not walls of text.

---

## 4. Catalog mobile (`AdminProductsPage.jsx` + `ProductEditorModal.jsx`) — the headline ask

This is where the vision's "Apple Store, not inventory software" applies hardest. The catalog is family-grouped (`ProductFamily` + per-SKU pack variants), so the mobile model is **family cards → family sheet → variant editor**.

### 4.1 Catalog browse

- Header: `LargeTitleHeader` "Catalog" + trailing search icon (same overlay pattern) + a trailing `+` circular button (create product).
- Category/status filter as `SegmentedControl` (All · Active · Inactive) plus a full-bleed category chip rail beneath.
- **Product family cards** — 2-column grid, 12px gaps (the vision's 4-col is desktop): square product image on fog with `--am-radius` corners, family name `--am-title`/600 clamped to 2 lines, `4 sizes · from NPR 1,450` in `--am-meta` graphite, and a status dot + word for inactive families. Press state scale 0.98. Stagger-reveal the first 8.
- Empty/zero-result state: centered glyph + "No products match" + azure "Clear filters".
- **Search must use the shared fuzzy ranker** (`src/utils/searchMatch.js` from the public prompt §4) — "eco friendly" must find "Meitu Eco-Friendly Paint". If that utility doesn't exist yet, build it here and wire the public/dealer surfaces to it too.

### 4.2 Family sheet (tap a card)

A `MobileSheet` (85%, drag-dismissable), Apple-product-page in miniature:

1. Image stage: swipeable gallery with dots, on white.
2. Identity: family name `--am-hero` scaled to 24px, category eyebrow, active/inactive `StatusChip`.
3. **Variant list** — one row per SKU (never the desktop `<table>`): pack label 15px/600 + SKU `--am-meta` graphite on the left; tier-1 price 15px/700 tabular on the right; a chevron. Rows are detached-ish (hairlines inside one card is fine here — this is a single object). Tapping a row opens the variant editor sheet.
4. Sticky footer: azure "Edit product" + a secondary "Add size".

### 4.3 Editor sheets (replace the 1199-line desktop modal on mobile)

`ProductEditorModal.jsx` is a desktop dialog; on mobile it must render as a **full-height (92%) `MobileSheet` with a segmented section switcher** — Overview · Pricing · Variants · Inventory · Analytics — one section visible at a time. Never one endless scrolling form.

- Fields: 48px tall, fog inset, 16px radius, ≥16px font; labels above in `--am-meta` graphite. Numeric fields set `inputMode="decimal"`.
- **Pricing tiers** get the most care: each tier is its own row-card (min/max/price), with an "Add tier" ghost row; validation is inline per field on blur (13px caution text), never a summary wall. Show a live one-line preview of what the tier ladder means ("60L+ → NPR 1,320/pack").
- Image upload: tap-to-pick tiles with progress via `AppleSpinner`, primary-image star toggle.
- Save: in-button spinner → sheet dismisses → `toast("Product saved", ✓)` + `playCompletion()`. Unsaved-changes guard on drag-dismiss: if the form is dirty, drag-down asks "Discard changes?" in a small confirm sheet.
- Destructive actions (deactivate/delete) live at the bottom of Overview as a plain red text row, always behind a typed/explicit confirm sheet.

---

## 5. Remaining sections (same language, less depth)

- **Dealers / Dispatchers**: Apple-Contacts-style detached cards (avatar initial circle, name `--am-title`, tier/region + monthly revenue `--am-meta`), searchable via the shared ranker, tap → profile. Profile: hero (name, "Since 2022", status chip) → 4-up stat row → `SegmentedControl` tabs (Overview · Orders · Stock · Payments · Documents) rendering card lists, never tables.
- **Painters**: photo-card gallery, 2-col — photo, name, `TTP`/`RTP` chip, ID `MP-…` in `--am-meta`. Profile: large hero photo, certification + license status (`licenseStatus` is real: VALID/EXPIRED/REVOKED), training status, points balance, ID-card actions. All real fields — don't invent project histories.
- **Insights** (`AdminInsightsPage.jsx`, currently 0 media queries): rebuild mobile-first — one metric hero, a `SegmentedControl` period switcher, then **one chart at a time** stacked in cards (220px each), and convert `InsightsPrimitives.jsx` tables into card lists on mobile. Load `dataviz` before touching chart code.
- **Notifications**: grouped by domain (Orders / Inventory / Dealers / Painters) with sticky group headers, unread as an azure dot (never red count badges), swipe-to-mark-read.
- **Applications / Sales / Coupons / Settings**: card lists + sheets, same tokens; no tables on mobile anywhere.

---

## 6. Motion, feedback, sound

- Sheets/pills/thumbs: `--ease-sheet`; entrances `--ease-out-strong`; exits faster than entrances. Nothing above 300ms except the staged success moment.
- `AppleSpinner` for in-flight actions only; skeletons for page loads; 2px azure hairline for background refetch.
- `MobileToast`: single visible toast, ink pill above the tab bar, swipe-down dismiss with velocity, **Undo** action on every reversible mutation (status changes, deactivations) — 5s timeout when it carries an action.
- `playCompletion()` **only** on: order verified/dispatched/completed, product saved, dealer/painter approved, coupon batch generated. Never on navigation, filtering, or list refresh.
- Every pressable element: `:active { transform: scale(0.97) }`, 120ms; hover styles gated behind `@media (hover: hover) and (pointer: fine)`.

---

## 7. Verification protocol (mandatory — a prior spec in this repo was reported done with zero file changes)

1. After each section, run `git diff --stat` and confirm the intended files changed. **A section claimed done whose file shows no diff did not happen.** Expected files: `src/admin/dashboard/AdminDashboardPage.jsx`, `dashboard/orders/AdminOrdersPage.jsx`, `dashboard/orders/AdminOrderDetailPage.jsx`, `catalog/AdminProductsPage.jsx`, `catalog/components/ProductEditorModal.jsx`, `dashboard/dealers/AdminDealersPage.jsx`, `dashboard/painters/AdminPaintersPage.jsx`, `dashboard/insights/AdminInsightsPage.jsx` + `InsightsPrimitives.jsx`, plus new `src/admin/mobile/` components and `src/components/mobile/` promotions.
2. View every screen at 390×844 in the browser before moving on; check the §8 checklist items for that screen.
3. Delete the five zero-byte orphan files (§0) and confirm the build still passes.
4. Finish with `npm run lint` and a final `git diff --stat`.

## 8. Acceptance checklist

- [ ] Zero `<table>` elements render at ≤768px anywhere in admin; zero horizontal overflow at 360px.
- [ ] Order segments use the six **real** statuses; every order timeline has 4 nodes; no "Mixing"/"Packed" anywhere.
- [ ] No Finance nav item and no fake dispatch map were created.
- [ ] Home: zero-count attention cards are omitted; an all-clear state shows the single quiet line.
- [ ] Catalog: 2-col family grid → family sheet → sectioned editor sheet; no desktop modal appears on mobile; dirty-form drag-dismiss asks before discarding.
- [ ] Search anywhere in admin finds "Meitu Eco-Friendly Paint" from "eco friendly" via the shared ranker.
- [ ] Exactly one tab active on every admin route; filled-glyph azure active state.
- [ ] Every destructive/status-changing swipe goes through a confirm sheet; every reversible mutation offers Undo.
- [ ] Completion sound fires only on the §6 list; charts built after loading `dataviz`; all animation follows the constitution with reduced-motion fallbacks.
- [ ] Desktop admin screenshots before/after are identical.
