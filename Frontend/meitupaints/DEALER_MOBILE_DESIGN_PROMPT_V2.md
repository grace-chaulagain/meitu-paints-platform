# Dealer Mobile Experience — V2 Refinement Prompt

> Hand this file to the implementing agent as-is. It builds **on top of the shipped V1 implementation** (spec: `DEALER_MOBILE_DESIGN_PROMPT.md`, code: `src/dealer/mobile/*`, `src/dealer/DealerHomePage.jsx`, styles in `src/dealer/mobile/DealerMobileStyles.jsx`). V1's foundations (bottom tab bar, cart pill, product sheet, status rail, draft system) stay. This pass fixes audited UX defects, raises the animation craft to Apple-native level, and extends the design language to the "More" sections (Sales Register, Inventory).
>
> **Before writing any animation code, invoke the `emil-design-eng` skill** and hold every transition in this document to its rules. The non-negotiables are restated in §3, but the skill is the authority on easing, duration, interruptibility, and performance.

Scope: dealer role, ≤768px, design target 390×844. Desktop dealer views and Admin/Dispatcher/Factory must not regress. All colors via tokens from `src/index.css` / `DESIGN.md`.

---

## 1. Audited defects to fix (each is a confirmed issue in the current code)

### 1.1 Page width — kill the double gutter (the "congested margins" bug)

**Defect**: `DashboardShell` applies its own main-area padding at mobile widths (14px/side at ≤640px, 18px at ≤1100px) and every `dealer-m-*` page then adds `padding: 0 20px` — ~34px per side, leaving ~322px of usable width on a 390px screen. Cards look truncated and cramped.

**Fix — single-gutter system, Apple compact-width margins:**

- When the dealer-mobile experience is active (`useIsMobileDealer`), the shell's main content area must drop its horizontal padding to **0** for dealer routes (scope via a class on the shell container, e.g. `.dashboard-shell.dealer-mobile-bleed .dashboard-main { padding-left: 0; padding-right: 0; }` — do not touch other roles or desktop).
- Define one token in the mobile styles: `--dealer-m-gutter: 16px` (Apple's compact-size-class layout margin). Every page container uses exactly `padding-inline: var(--dealer-m-gutter)` and nothing else adds horizontal padding.
- Net result: content width goes from ~322px → **358px on a 390px screen**. Cards get visibly wider; interior card padding stays 16–20px so content breathes _inside_ the card instead of the canvas eating the width.
- Full-bleed exceptions (edge-to-edge, no gutter): the category chip row and any horizontal thumbnail rail — give them `margin-inline: calc(var(--dealer-m-gutter) * -1); padding-inline: var(--dealer-m-gutter)` so the first item aligns to the text grid but the scroll region reaches the screen edge (this is exactly how the App Store does horizontal shelves).
- Audit every `dealer-m-*` class after the change: no element may cause horizontal overflow at 360px.

### 1.2 Bottom tab bar — real Apple active states

**Defect**: active state is only `color: ink` + label `font-weight: 600` — visually near-identical to inactive graphite. Apple tab bars make the selected tab unmistakable: the glyph _fills_ and _tints_.

**Fix — filled symbol + azure tint, per Apple HIG:**

- Add **filled variants** of the four tab glyphs (home, browse/grid, orders/receipt, more) to `DashboardIcons.jsx` (or an adjacent `TabBarIcons.jsx`): same 24px geometry, solid fill instead of 1.8px stroke. SF Symbols behavior: outline when idle, `.fill` when selected.
- Active tab: filled glyph + label in `--color-azure`. Inactive: outlined glyph + label in `--color-graphite`. This is the sanctioned navigation use of azure (DESIGN.md allows blue for "important navigation links") and it makes the active tab readable at a glance, exactly like the App Store/Photos tab bars. The one-azure-per-screen rule from V1 is amended: **one azure CTA + the active tab tint**.
- Selection transition: crossfade outline→fill (opacity, 150ms ease-out) with a compressed bounce on the icon: scale 1 → 0.85 → 1, ~300ms, `cubic-bezier(0.34, 1.56, 0.64, 1)` (subtle overshoot, iOS-tab-tap energy). Never animate the tab _switch_ itself (screen content) — only the glyph. Label does not move; no layout shift between weights (pre-reserve width or keep the same weight and rely on color).
- **Route coverage defect**: on `/dealer/inventory`, `/dealer/sales`, and coupon routes, _no_ tab is currently active (More only lights while the drawer is open). Fix: the More tab is active whenever `location.pathname` is a dealer route not owned by Home/Browse/Orders — so the bar always shows exactly one active tab.
- Add `transform: scale(0.96)` on `:active` for the whole tab button (120ms ease-out) — every pressable element in this app must acknowledge touch (§3).

### 1.3 Product sheet — professional size + quantity presentation

**Defect**: pack rows show only label + price; the lone stepper floats beneath the tier ladder with no visual tie to the selected pack; quantities already in the draft are invisible until you tap each row; "Add to order" overwrites silently even when editing an existing line.

**Fix — Apple buy-flow accordion (the iPhone storage-picker pattern):**

- Each pack row becomes a **selectable card that expands when selected** (height + opacity transition, 250ms `cubic-bezier(0.32, 0.72, 0, 1)`; animate `grid-template-rows: 0fr → 1fr` on an inner wrapper — never animate `height: auto`):
  - **Collapsed (unselected)** row: left — pack label 17px/600 ink ("20 Litre") with, _below it in 13px graphite, the per-pack tier price_ ("NPR 1,320/pack"); right — if that SKU is already in the draft, a quantity chip: fog pill, 12px/600 ink, `×3`. The chip is how a dealer scans "what have I already got in this order" without tapping anything.
  - **Selected** row: 1.5px azure border + azure-at-4% fill + a 20px azure checkmark circle on the right (SF-style ✓, draw-in 200ms). The row expands to reveal an inline bottom section: left — "Quantity" 13px graphite label over the **stepper** (36px buttons, moved _inside_ the selected card; delete the orphaned stepper row); right — live line math in 13px graphite: `3 × NPR 1,320` over the line total 17px/700 tabular. Struck-through base price still shows before the tier price when a deeper tier applies.
- Only one row expanded at a time; switching packs collapses the old row and expands the new one in the same 250ms motion (transitions, not keyframes — must retarget smoothly if tapped rapidly).
- Footer button becomes state-aware: `Add to order — NPR 3,960` when the SKU is new; **`Update order — NPR 5,280`** when the SKU already had a draft quantity; stepping the selected pack to 0 turns it into `Remove from order` (still one button, still azure — except Remove, which is a plain ink-bordered secondary). No silent overwrites.
- Footer shows a second line under the button label when _other_ packs of this family are already in the draft: 12px, white at 70%: "Family total: 60 L · Tier 2 pricing". This is the family-shared-tier story told at the exact moment of commitment.
- Image stage: keep tap-to-cycle but add **horizontal swipe** (pointer events, translate the strip with a spring settle) and make the dots tappable — tap-only cycling is undiscoverable.

### 1.4 Orders list — detach the rows (the "attached cards" complaint)

**Defect**: V1 put all orders of a month into one card with hairline-separated rows (Settings-style). In practice the rows read as one congested slab.

**Fix — Uber Eats order history pattern: one card per order, real air between them:**

- Each order = its own white card, radius 18px, **12px vertical gap**, padding 16px. Month headers stay (13px graphite, uppercase-tracked, sticky) but sections are card _stacks_, not card _interiors_.
- Card anatomy — instant recognition without reading:
  - Left: a 44px **product thumbnail** (first item's image via `resolveOrderItemImage`; fog block with package icon as fallback). If >1 item, a tiny `+N` badge overlapping the thumbnail corner.
  - Middle: order number 15px/600 ink; below, `Jul 12 · 8 items` 13px graphite.
  - Right, vertically centered: total 15px/700 tabular ink over a `StatusChip`; then a 16px graphite chevron-right.
  - Live orders: a 3px azure left accent bar inset within the card radius (the Stripe "something is happening" cue), replacing the old 6px dot.
- Cards get `:active` scale 0.98 (they're buttons). List entry: stagger fade+8px-rise, 40ms/card, first 8 cards only, once per mount (§3 stagger rules).
- Apply the identical detached-card treatment to any other hairline-row stacks that read as slabs (order-detail item groups keep their in-card grouping — that one is genuinely a single object).

### 1.5 Loading, feedback, and sound — replace ad-hoc states

**Spinner**: build one `AppleSpinner` component — the iOS activity indicator: 8 rounded-rect spokes in `--color-graphite`, opacity-staggered rotation via a single CSS animation, 0.8s/rev linear, sizes 16 (in-button) / 28 (inline). Replace every other spinner. Skeletons remain the page-level loading pattern; the spinner is for in-flight _actions_ only.

**Toasts** (amends V1's "no toasts" — confirmations that have no in-place anchor get one): build a `MobileToast` system following the Sonner principles from the emil skill:

- Renderer mounted once in the dealer mobile layout; imperative `toast(message, { icon })` API; max 1 visible (queue, don't stack) — this is a phone, not a dashboard.
- Visual: ink pill (radius 999), white 14px/500 text, optional leading 16px icon, bottom-docked **above the cart pill / tab bar**, max-width `calc(100% - 32px)`.
- Motion: enter `translateY(16px) + scale(0.97) + opacity 0 → identity`, 350ms `cubic-bezier(0.32, 0.72, 0, 1)`; exit 200ms ease-out downward (exits faster than it enters); auto-dismiss 2.5s; **swipe-down to dismiss** with velocity-based release (dismiss if `|Δy|/Δt > 0.11` regardless of distance) and damping if dragged upward. Use transitions, not keyframes — a second toast must retarget mid-flight.
- Use sparingly: "Order placed" success screen is NOT a toast (keep the full-screen moment); toasts are for e.g. "Added to order" _when triggered from a context where the cart pill is off-screen_, "Sale recorded", "Stock updated", clipboard copies.

**Sound + haptic** — the Apple Pay-style completion mark: create `src/dealer/mobile/completionFeedback.js` exporting `playCompletion()`:

- Web Audio API, synthesized (no asset download): two soft sine notes — 880Hz then 1174.7Hz (A5→D6), each ~90ms, gain envelope 0→0.12→0 (quiet; it must feel like a system sound, not a notification), second note starting 70ms in. Lazily create the `AudioContext` on first call (always inside a user-gesture handler, so autoplay policy is satisfied); wrap in try/catch and fail silently.
- Pair with `navigator.vibrate?.(10)` for a single light tick where supported.
- Trigger **only** on rare, meaningful completions: order placed, coupon redemption confirmed, sale recorded. Never on add-to-cart, navigation, or anything done tens of times a day (emil rule: frequency gates delight).

---

## 2. Creative-liberty upgrades (native patterns from Apple Store / Uber Eats / Stripe)

Implement all of these — they are specified, not optional inspiration:

### 2.1 Large-title collapse (Apple navigation bars)

Root screens (Home, Browse, Orders) get the iOS large-title behavior: the 34px/28px title sits in the scroll content; on scroll past ~32px it collapses into a **compact pinned header** — 44px, centered 17px/600 title, background `rgba(245,245,247,0.82)` with `backdrop-filter: saturate(180%) blur(20px)`, and a 0.5px hairline that is _only visible once scrolled_ (Apple's scroll-edge effect). Crossfade the two titles over the scroll distance (opacity driven by a scroll listener writing to a CSS variable; transform/opacity only — no layout animation). Pinned search on Browse docks under this compact header.

### 2.2 Live order card as a "Live Activity" (Home)

Restyle the Home live-order card with iOS Live Activity energy: ink (near-black) card, white text — the only dark surface in the app, which is exactly why the eye lands on it first (Uber Eats does the same with its active-order tracker). White status rail nodes, azure current-node pulse (2s breathing, opacity 0.5↔1). Top row: order number in 13px white-at-60% + white StatusChip. Add a relative timestamp ("Verified 2h ago") in 13px white-at-60%. Tap target unchanged. All other Home cards stay white — one dark hero max.

### 2.3 Stripe-style stat presentation (Home)

- Stats **count up** on first appearance: 0 → value over 600ms ease-out, tabular-nums so nothing shifts; run once per mount, skip under `prefers-reduced-motion` (jump straight to the value).
- Add a fourth micro-element to the stats card: a 7-bar **spend sparkline** (last 7 days, 3px-wide fog bars, current day azure, max height 24px, pure CSS heights from data — not a chart library, no axes, no labels). This is the Stripe glance: trend without a chart wall. If the month has <2 orders, omit it.

### 2.4 Sliding segmented control (Orders filters, inventory view toggle)

Replace independent filter chips with one **segmented control**: fog track (radius 10, 2px inner padding), white "thumb" that _slides_ under the active segment (`translateX` transition, 250ms `cubic-bezier(0.32, 0.72, 0, 1)`; thumb is one absolutely-positioned element — never per-chip backgrounds fading). Labels 13px/600, ink when active, graphite otherwise, with count ("Active 2"). This is the iOS `UISegmentedControl` and it kills the "which chip is on?" scan cost.

### 2.5 Cart pill tier hint (Uber Eats basket intelligence)

When the draft is within 20% of any family's next tier, the cart pill grows a second line (pill → 2-line lozenge, height animates via the 0fr/1fr grid trick): line 1 unchanged (`3 items · NPR 42,500`); line 2 in 11px white-at-70%: "20 L more Silk Emulsion → Tier 2". Data from the existing `TierProgressBar` math — never duplicated. Collapses back when no longer applicable.

### 2.6 Checkmark draw + staged success screen

On the order-placed screen, sequence the elements (each 250ms apart, ease-out, translateY 8px + fade): ① 64px circle scales in 0.9→1 while the ✓ path draws via `stroke-dashoffset` (400ms), ② "Order placed" headline, ③ order number, ④ buttons. `playCompletion()` fires with step ①. Under reduced motion: single fade, sound still plays.

### 2.7 Press acknowledgment everywhere

Every tappable surface — cards, rows, chips, steppers, thumbnails, tab items — gets `transition: transform 120ms ease-out` + `:active { transform: scale(0.97) }` (0.98 for large cards). Gate any `:hover` styles behind `@media (hover: hover) and (pointer: fine)` so taps don't leave sticky hover states on touch devices.

---

## 3. Animation constitution (from `emil-design-eng` — binding for every transition in this pass)

Define once in the mobile styles and use everywhere:

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1); /* entrances, releases */
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1); /* on-screen moves */
--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1); /* sheets, pills, thumbs */
--ease-bounce-subtle: cubic-bezier(0.34, 1.56, 0.64, 1); /* tab glyph only */
```

1. **Frequency gates animation.** Actions done tens of times daily (tab switches, stepper taps, chip filters) get ≤150ms feedback or none. Rare moments (order placed) may take up to ~1s of staged delight. Nothing keyboard-initiated animates.
2. **Only `transform` and `opacity`** (plus `clip-path` for the segmented thumb/check tricks). Never animate `height`/`width`/`padding`/`margin`/`top` — expanding rows use the `grid-template-rows: 0fr→1fr` technique.
3. **`ease-out` for anything entering; exits faster than enters** (toast: 350ms in / 200ms out; sheet: 400ms in / 250ms out). Never `ease-in` on UI. Never `transition: all` — name the properties.
4. **Transitions over keyframes** for anything that can retrigger mid-flight (pack accordion, pill resize, toasts, segmented thumb). Keyframes only for fire-once effects (check draw, stagger-in, spinner).
5. **Nothing enters from `scale(0)`** — minimum `scale(0.95)` + opacity.
6. **Stagger** list entrances 30–80ms/item, first screenful only, never blocking interaction.
7. **`prefers-reduced-motion`**: strip transform motion, keep ≤200ms opacity fades; counters and progress jump to final values.
8. **Verify like Emil**: run the sheet, accordion, and toast at 5× duration in DevTools' Animations panel before calling them done; check the cart-pill resize and toast retarget under rapid repeated taps.

---

## 4. Extend the design language to the "More" sections

Same gutter token, same detached cards, same segmented control, same toasts/spinner, same press states. These pages currently leak desktop patterns onto mobile:

### 4.1 Inventory — `/dealer/inventory` (`DealerInventoryPage.jsx`)

- **Defect**: `InventoryHistoryTable` renders a `min-width: 760px` `<table>` — horizontal scrolling on a phone, which V1 banned. On mobile, replace the table with a card list: one row-card per movement — left: type icon in a fog circle (order ↓ / sale ↑), middle: product name 15px/600 + date 13px graphite, right: signed quantity `+12` / `−3` 15px/700 tabular (positive ink, negative graphite). Paginate with a plain "Load more" ghost button, not page numbers.
- Product cards: single column, detached (12px gap), 56px product image left; stock presented as **dot + word first** ("● In stock" ink / "● Low" `--color-caution` / "● Out" graphite at 60%), the unit count second in 13px graphite ("142 units"). The card/table view toggle becomes the §2.4 segmented control; table view is desktop-only (hide the segment on mobile).
- Detail page (`DealerInventoryDetailPage.jsx`): apply gutter + push-header (`MobilePushHeader`) + detached cards; movements list uses the same card-list component as above.

### 4.2 Sales Register — `/dealer/sales` (`DealerSalesPage.jsx`)

- Keep the day-grouped timeline concept, but mobile-tune it: day headers sticky (13px graphite, uppercase-tracked, blur backdrop like §2.1); each sale = a detached card (12px gap): left painter/customer initial avatar (32px fog circle), middle bill number 15px/600 + items summary 13px graphite, right amount 15px/700 tabular + time 12px graphite. Stagger-in per §3.
- `NewSaleModal` becomes a **bottom sheet** on mobile (reuse the ProductSheet's scrim/handle/spring shell — extract a generic `MobileSheet` wrapper from it first so ProductSheet, NewSale, and the order-confirm sheet all share one animated container). Full-height 92%, form fields 48px tall, fog inset style, 16px radius. Submit = `PrimaryButton` with in-button `AppleSpinner`; on success: sheet dismisses → `toast("Sale recorded", ✓)` + `playCompletion()`.
- Any sales stats strip follows the Home stats card pattern (tabular, count-up).

### 4.3 More drawer itself

Restyle `DashboardMobileNavDrawer` content for dealers into grouped Apple-Settings lists: white group cards (radius 18) of 52px rows — 24px graphite icon, 16px ink label, chevron; groups: Operations (Inventory, Sales, Coupons) / Account (Profile, Logout). Rows get the standard press state. Logout stays ink text — no red.

---

## 5. Home page — professional recomposition

Final Home stack (order matters — it's a priority argument):

1. **Greeting** — date 13px graphite uppercase-tracked _above_ "Good morning, Ram" 28px/700 (Apple Today-page order: eyebrow first). No card.
2. **Live Activity card** (§2.2) — only when a live order exists.
3. **"Order again" / "Continue your order" hero** — upgrade thumbnails to a 48px **overlapping stack** (−12px margins, 2px white rings, `+N` end cap — App Store visual grammar), total right-aligned on the same row as the label, `PrimaryButton` below. When neither draft nor history exists, this card becomes the first-run hero: "Start your first order" + Browse CTA.
4. **Quick actions** — two cards (Browse products / Redeem coupon — coupons earn the slot over Inventory, which already lives one tap away in More and in the stats row's story). 28px icon on fog circle, 15px/600.
5. **This month stats card** with count-up + sparkline (§2.3).

Everything staggers in per §3 (single pass, 50ms steps). Pull-to-refresh is explicitly out of scope (native browser refresh suffices; don't fake it).

---

## 6. Engineering constraints

- **No new dependencies.** Sound = Web Audio; springs = CSS cubic-bezier approximations; toast/sheet/segmented control are hand-rolled per above. (If Motion/framer-motion were ever added later, its shorthand `x`/`y` props are not hardware-accelerated — but that's moot here.)
- Extract shared primitives rather than duplicating: `MobileSheet` (from ProductSheet), `SegmentedControl`, `MobileToast` + `useToast`, `AppleSpinner`, `completionFeedback.js`, `MovementCardList`. All under `src/dealer/mobile/`.
- Data via existing RTK Query hooks; pricing via `pricing.js`; draft via `useOrderDraft` — unchanged contracts.
- Keep `DealerMobileStyles.jsx` as the style home but split it if it passes ~2000 lines (e.g. `DealerMobileStyles.core.jsx` / `.pages.jsx`) — a single unreadable style blob is itself a UX bug for the next engineer.
- Touch targets ≥44×44. Test at 390×844 and 360×780. `npm run lint` clean; verify in browser at mobile viewport.

## 7. Acceptance checklist

- [ ] Content width ≥ 356px at 390px viewport on every dealer mobile page; zero horizontal overflow at 360px.
- [ ] Active tab is identifiable at arm's length: filled azure glyph + azure label; exactly one tab active on every dealer route including Inventory/Sales/Coupons.
- [ ] Product sheet: selected pack shows azure border + check + inline stepper + line math; unselected packs show `×N` draft chips; button reads Add / Update / Remove correctly; switching packs animates smoothly under rapid tapping.
- [ ] Orders list: detached cards with thumbnails, 12px gaps, azure accent on live orders; no hairline-row slabs anywhere on mobile.
- [ ] Large-title collapse + blur hairline works on Home/Browse/Orders; hairline invisible at scroll-top.
- [ ] Segmented controls slide their thumb (one moving element, transitions retarget mid-slide).
- [ ] Toast enters above the pill, swipe-down dismisses with velocity, second toast retargets without restarting.
- [ ] `playCompletion()` sounds on order placed / sale recorded / coupon redeemed — nowhere else — and never throws.
- [ ] Stats count up once, sparkline renders from real data, both degrade under `prefers-reduced-motion`.
- [ ] Inventory mobile has no `<table>`; sales register uses detached cards + bottom-sheet form.
- [ ] Every tappable element has a `:active` scale; hover styles gated behind `(hover: hover)`.
- [ ] All animations use the four easing tokens; no `transition: all`; no height/width animation anywhere.
