# Dealer Mobile Ordering Experience — UI Design Prompt

> Hand this file to the implementing agent as-is. It is scoped to the **dealer role, mobile viewport (≤768px, design target 390px)** of the Meitu Paints SPA. Desktop dealer views and other roles (Admin/Dispatcher/Factory) must not regress.

---

## 1. Mission

Redesign the dealer's mobile ordering experience so that reordering paint feels like **buying an iPhone on apple.com, tracking an Uber Eats delivery, and glancing at a Stripe dashboard** — never like filling out an ERP purchase order.

The dealer is a busy shop owner standing behind a counter, phone in one hand. Every screen must survive the test: **can they complete the task with one thumb, in under 30 seconds, without reading anything twice?**

### North-star principles

1. **Fast ordering** — a repeat order should take 3 taps: Home → Reorder → Confirm.
2. **Zero thinking** — one primary action per screen, everything else recedes.
3. **Visual confidence** — products shown as products (imagery, color), not SKU rows.
4. **Instant stock visibility** — availability is ambient, never a surprise at checkout.
5. **One-thumb navigation** — primary actions live in the bottom 40% of the screen.
6. **Premium business tool** — the dealer should feel like a valued partner, not a data-entry clerk.

### What to take from each inspiration

| Source | Take | Explicitly reject |
|---|---|---|
| **Apple Store** | Massive whitespace, typographic hierarchy, product-first layouts, exactly one blue CTA per screen, emotional premium calm | Marketing animations, hero banners, promo carousels |
| **Uber Eats** | Category-first browsing, search always reachable, quick-add steppers on cards, smart "order again" resurfacing, live progress tracker | Busy cards, badges/ratings clutter, discount shouting |
| **Stripe Dashboard** | Clean information architecture, numbers presented with confidence (big, tabular-lining), quiet status chips, impeccable list design | Dense tables, filter toolbars, chart walls |

### The biggest mistake to avoid

Designing this like B2B software. Concretely banned: data tables on mobile, multi-column forms, filter ribbons, "Export CSV" prominence, badge soup, toolbar rows of small icon buttons, modal-on-modal, anything requiring horizontal scroll, and any screen whose primary content is a grid of numbers.

---

## 2. Grounding in this codebase (read before designing)

- **Design system**: `Frontend/meitupaints/DESIGN.md` is authoritative. Tokens live in `src/index.css`. Canvas `--color-fog #f5f5f7`, cards `--color-snow #fff`, ink `#1d1d1f`, secondary `--color-graphite #707070`, primary action `--color-azure #0071e3`. No heavy shadows — elevation via contrast, radius, spacing. Inter/SF system type.
- **Routes** (in `src/main.jsx`): `/dealer/catalog`, `/dealer/cart`, `/dealer/orders`, `/dealer/orders/:orderId`, `/dealer/inventory`, `/dealer/inventory/:productId`, `/dealer/sales`, coupon redeem. `DealerDashboardPage.jsx` is the landing page.
- **Data model**:
  - Products (`useGetProductsQuery`) have `sku`, `code` (family key grouping 20L/10L/4L/1L pack variants of the same paint), `name`, `category`, `images[]` (with `isPrimary`), `pack {size, unit, label}`, `pricing {model, basis, tiers[]}`, `currency` (NPR).
  - **Tier pricing is family-shared**: `src/dealer/pricing.js` computes the tier from the *combined* metric (e.g., total liters) across all SKUs of the same `code`. Adding 10L more can drop the per-pack price of everything in that family. This is the single most important pricing behavior to surface visually — it is the dealer's "free delivery progress bar."
  - Cart draft: quantities keyed by SKU in localStorage (`src/dealer/draftStorage.js`, key `meitu_dealer_order_draft_v1`). Catalog and Cart pages both read/write it. Keep this mechanism.
  - Order lifecycle: `SUBMITTED → VERIFIED → DISPATCHED → COMPLETED`, off-ramps `REJECTED`/`CANCELLED`. Exactly these six — do not invent "preparing/out for delivery" sub-stages. Status metadata already exists in `src/dealer/orderDetailLogic.js` (`ORDER_STATUS_META`).
  - Payment status is a separate enum; order detail exposes invoice/proforma PDFs.
- **Existing mobile nav**: `src/components/dashboard/DashboardShell.jsx` renders a mobile topbar + hamburger `DashboardMobileNavDrawer.jsx`. See §3 for how the dealer mobile experience overrides this.
- **Do not** hand-roll axios fetching; all data through existing RTK Query hooks in `src/redux/api/meituApi.js`. Keep `pricing.js` as the only pricing source of truth.

---

## 3. Navigation architecture (mobile, dealer role only)

Replace the hamburger-drawer-first pattern with a **fixed bottom tab bar** — the single biggest lever for "one-thumb, zero thinking." The drawer may remain for overflow ("More").

**Tab bar** — 4 tabs + centered emphasis, 64px tall + `env(safe-area-inset-bottom)` padding, `--color-snow` background, 0.5px top hairline `--color-silver-mist`, no shadow:

1. **Home** (`/dealer`) — house icon
2. **Browse** (`/dealer/catalog`) — grid icon
3. **Orders** (`/dealer/orders`) — receipt icon; shows a small azure dot when any order is in a live state (SUBMITTED/VERIFIED/DISPATCHED)
4. **More** — opens the existing drawer (Inventory, Sales, Coupons, Account, Logout)

Icons from `src/components/ui/ApplePageIcons.jsx` (extend the set if needed), 24px, `--color-graphite` inactive → `--color-ink` active with the label turning semibold. No filled/outlined color flips to azure — active state is ink, Apple-style.

**Cart is not a tab.** It is a **floating cart pill** (Uber Eats pattern): when the draft has ≥1 item, a pill docks above the tab bar — `--color-ink` (near-black) background, white text: `🛍 3 items · NPR 42,500 →`. Tapping goes to `/dealer/cart`. It persists across Home/Browse/product screens, animates in with a 250ms spring rise, and updates its total live. This is the app's constant "you have an order in progress" anchor.

**Hierarchy rule**: screens reached from tabs are roots (no back button, large title). Everything deeper (product detail, order detail, checkout) is a push with a chevron-left back button in a minimal 44px header, title centered, set in SF-style 17px semibold.

---

## 4. Screen-by-screen specification

### 4.1 Home — `/dealer` (`DealerDashboardPage.jsx`)

Purpose: the dealer opens the app; within one glance they know (a) where their money/orders stand and (b) how to order in one tap. This is Stripe-glance + Uber-Eats-reorder, not a metrics wall.

Layout, top to bottom on fog canvas, 20px horizontal padding, 16px stack gap:

1. **Greeting header** (no card): "Good morning, Ram Hardware" — 28px/700, −0.02em; below in 14px graphite, today's date. No avatar, no bell icon unless notifications actually exist.
2. **Live order card** (only when an order is in SUBMITTED/VERIFIED/DISPATCHED — else omitted entirely): white card, radius 20px. Top row: `ORD-4F2A91` in 13px graphite mono-ish + status chip. Middle: a **4-segment progress rail** (see §5 Status Rail) with the current stage labeled below in 15px ink: "Being verified" / "On its way". Tap → order detail. If multiple live orders, show the most recent + "2 more active orders →" text link.
3. **Reorder card** — the hero of the screen: white card, radius 20px, 20px padding. Label "Order again" 13px graphite uppercase-tracked; then the last order summarized as a horizontal row of up to 4 product thumbnails (40px rounded squares from `images[].url`) + "and 3 more" ; total in 22px/700 tabular. Full-width azure button "Reorder — NPR 84,200" (see §5 Buttons). Tapping loads that order's items into the draft (`saveDraft`) and goes straight to `/dealer/cart`. If the draft already has items, this card becomes "**Continue your order**" with the draft's contents instead.
4. **Quick actions row** — 2 side-by-side white cards, 16px radius: "Browse products" (grid icon) and "My inventory" (cube icon). Icon 28px on a fog circle, 15px/600 label. No more than these two.
5. **This month strip** (Stripe energy, restrained): a single white card with three inline stats separated by hairlines — Orders `6`, Spend `NPR 4.2L`, In transit `1`. Numbers 20px/700 tabular-lining, labels 12px graphite. **No chart.**

### 4.2 Browse — `/dealer/catalog` (`DealerCatalogPage.jsx`)

Purpose: Uber Eats browsing speed with Apple product presentation. The dealer knows what they want; get out of the way.

1. **Search field** pinned under the large title "Products" (34px/700): full-width, fog-colored inset field, radius 12px, magnifier icon, placeholder "Search paints, primers, SKUs…". Filters as you type across `name`/`sku`/`code`/`category`. On focus it sticks to top and results replace the page body (no separate search screen).
2. **Category chips** — one horizontal scroll row (the only permitted horizontal scroll in the app): "All", then categories from `useGetProductCategoriesQuery`. Chip: 34px tall, 16px side padding, fog background/ink text; active = ink background/white text. No icons in chips.
3. **Product family cards** — vertical list (single column; no grid on mobile), grouped by `code` via `groupProductsByCode`. Each card: white, radius 20px, 16px padding, laid out as:
   - Left: 72px product image (primary image, fog placeholder block while loading — never a broken-image glyph).
   - Middle: family `name` 17px/600 ink (max 2 lines), `category` 13px graphite; below, **"From NPR 1,450 · 4 sizes"** in 14px ink — the lowest tier price across pack variants.
   - Right: a **quick-add `+` button** (36px circle, fog bg, ink `+`). Tap opens the pack-size sheet (§4.3) — because a family has multiple pack sizes, quick-add cannot silently guess.
   - If every SKU in the family is inactive/out of stock: card at 45% opacity, price line replaced by "Currently unavailable" in graphite; not hidden (hiding creates "where did it go?" support calls).
4. **Tier nudge banner** (Uber Eats "almost free delivery" moment): when the draft is within 20% of a family's next price tier, an inline slim card appears under that family's card: fog-tinted azure at 8% opacity, 13px: "Add 20L more Silk Emulsion to unlock NPR 1,320/pack" with a thin progress bar. Data comes straight from `pricing.js` tier boundaries — never hardcode.
5. List virtue: 12px gap between cards, no dividers, infinite natural scroll (products list is small enough — no pagination UI).

### 4.3 Product detail — bottom sheet (new component)

Purpose: Apple product page in miniature. Opened from a family card tap or `+`. A **bottom sheet** (85% height, 24px top radius, grab handle, fog scrim at 40%, drag-to-dismiss) rather than a route push — keeps the dealer "in the aisle."

Top to bottom:

1. **Product stage**: 180px tall centered product image on pure white; behind it a soft radial fog. Swipeable if multiple images, dot indicators 4px.
2. **Identity**: family name 22px/700 −0.02em; category 14px graphite. One line of `description` max, 15px graphite; never a paragraph.
3. **Pack size selector** — the Apple buy-flow moment. One row per pack variant (20L / 10L / 4L / 1L), each a full-width selectable card, 14px radius, 1.5px border (`--color-silver-mist` default, `--color-azure` + azure-tinted bg at 4% when selected):
   - Left: pack label 17px/600 ("20 Litre").
   - Right: **live unit price for the current cart context** — `getTierPrice` with the family's shared metric including what's already in the draft — 17px/600 tabular. If a deeper tier applies vs. tier-1, show the struck-through base price in 13px graphite before it. This is where tier pricing becomes *felt* instead of read.
4. **Tier ladder** (replaces any tier table): a single horizontal bar showing tier breakpoints as ticks, filled to the family's current draft metric, with the active tier's price bolded beneath. Caption 12px graphite: "Pricing is combined across all Silk Emulsion sizes."
5. **Quantity stepper**: centered, large — 44px `−` and `+` circular buttons flanking a 24px/700 count. Long-press repeats. Haptic-feel via 100ms scale-to-0.92 press animation.
6. **Sticky footer** inside the sheet: full-width azure button **"Add to order — NPR 29,000"** (live line total). On tap: write to draft, dismiss sheet, cart pill pulses once (scale 1 → 1.06 → 1, 300ms). No toast, no confirmation dialog — the pill's update *is* the confirmation.

### 4.4 Cart — `/dealer/cart` (`DealerCartPage.jsx`)

Purpose: review with confidence, edit without friction, one obvious exit. This screen *is* checkout — do not add a separate checkout route; the flow is Cart → Confirm sheet → Placed.

1. Header: large title "Your order", 34px/700; beneath, "8 items · 140 L total" 14px graphite (`calculateCartTotals`).
2. **Line items grouped by family**: one white card per family, radius 20px. Family header row: 44px thumbnail + name 16px/600 + family subtotal right-aligned 16px/700 tabular. Under it, one row per pack size: "20L × 3" 15px ink, unit price 13px graphite ("NPR 1,320/pack · Tier 2"), line total right 15px tabular, and a compact stepper (28px `−`/`+`) . Swipe-left on a row reveals a red "Remove" action (the only place Meitu red may appear as UI, and only here as iOS-convention delete).
3. **Tier savings line** inside any family card benefiting from a tier > 1: 13px in a green-tinted row: "Tier pricing applied — you're saving NPR 3,400". Confidence, not confetti.
4. **Next-tier nudge**: same component as §4.2.4, shown once, for the family closest to its next tier, with an "Add more" link reopening that family's sheet.
5. **Summary card**: Subtotal, total volume, then **Total** 24px/700. No fake fields (no tax/shipping rows that are always zero).
6. **Sticky footer**: full-width azure **"Place order — NPR 84,200"**. Tapping opens a short **confirm sheet** (not a browser confirm): order summary in 3 lines (items count, volume, total), delivery note text field (optional, single line, only if the API supports notes — check `useCreateDealerOrderMutation` payload; omit if unsupported), and "Confirm order" button. This two-beat confirm replaces any separate checkout page — Apple Pay-sheet energy.
7. **Placed state**: on success, replace the screen (no redirect flash) with a centered success composition: 64px animated checkmark (draw-on, 400ms), "Order placed" 28px/700, order number 15px graphite, and two buttons — azure "Track order" (→ detail) and plain "Back to home". Clear the draft (`clearDraft`). This 1.5-second moment is the emotional payoff; do not skip it.
8. Empty cart: centered 64px bag icon in graphite at 30%, "Nothing here yet" 17px/600, "Browse products" azure text button. No sad illustrations.

### 4.5 Order tracking — `/dealer/orders/:orderId` (`DealerOrderDetailPage.jsx` + `orderDetailUI.jsx`)

Purpose: the Uber Eats tracker, mapped honestly onto the four real statuses.

1. Push-screen header: back chevron, centered order number.
2. **Status hero** (no card, on fog): current-state headline 24px/700 — "Order placed" / "Verified — being prepared" / "On its way" / "Delivered", with a 15px graphite subline giving the timestamp ("Verified today, 2:14 PM"). For REJECTED/CANCELLED: headline in ink (not red), subline shows the reason if present, and a full-width secondary "Order these items again" button.
3. **Progress rail**: the §5 Status Rail, large variant — four nodes with labels Submitted / Verified / Dispatched / Completed. Completed nodes filled ink with 12px white check; current node azure with a slow 2s breathing pulse; future nodes hairline circles. Map from `ORDER_STATUS_META` — never invent stages.
4. **Payment chip row**: quiet Stripe-style chips — payment status (e.g., "Payment pending" fog/ink, "Paid" green-tinted) and, when the API provides them, "Invoice PDF" / "Proforma PDF" as 15px azure text buttons with a doc icon. Chips, not a table.
5. **Items card**: same family-grouped presentation as the cart, read-only, thumbnails included. Totals footer inside the card.
6. **Sticky footer** (COMPLETED only): "Reorder all items" azure button — loads items into the draft → `/dealer/cart`.

### 4.6 Order history — `/dealer/orders` (`DealerOrdersPage.jsx`)

Purpose: Stripe's payment list — scannable, quiet, chronological.

1. Large title "Orders". Beneath it, **status filter chips** (not tabs, not dropdown): All / Active / Completed / Cancelled — mapping Active → SUBMITTED+VERIFIED+DISPATCHED, Cancelled → REJECTED+CANCELLED. Counts in the chip ("Active 2") from the existing counts query.
2. **Month section headers**: "July 2026" 13px graphite uppercase-tracked, sticky while its section scrolls.
3. **Order rows** in a single white card per month (rows separated by inset hairlines, Apple Settings-style — not one card per order, which gets bubbly): Left: order number 15px/600 ink + date · item count 13px graphite. Right: total 15px/600 tabular over a small status chip. Whole row taps → detail. Live orders additionally show a 6px azure dot before the order number.
4. No search here (history is short), no date-range pickers, no export button on mobile.
5. Empty state: "No orders yet" + azure "Browse products".

### 4.7 Inventory glance (touch lightly)

`/dealer/inventory` keeps its current structure but restyle list rows to match §4.6 rows, and surface stock as a **colored dot + word** ("In stock" ink / "Low" caution `#b64400` / "Out" graphite) — never a bare number first. Full inventory redesign is out of scope for this pass.

---

## 5. Component inventory (build once, reuse everywhere)

Create these under `src/dealer/mobile/` (or extend `src/components/ui/`), each a small focused component:

- **`BottomTabBar`** — §3. Renders only for dealer role at ≤768px; `position: fixed`, respects `env(safe-area-inset-bottom)`.
- **`CartPill`** — floating pill; reads draft via a small `useOrderDraft()` hook wrapping `draftStorage.js` (with a `storage`-event + custom-event listener so Catalog/Sheet/Cart stay in sync in the same tab).
- **`StatusRail`** — 4-node progress; sizes `sm` (home card) and `lg` (order detail); driven by `ORDER_STATUS_META`.
- **`StatusChip`** — one chip component for order + payment statuses: 12px/600, 6px radius, tinted-bg-at-8% + full-strength text. Tones: neutral (fog/ink), live (azure), success (green `#1a7f37`-family), caution (`--color-caution`), muted (graphite).
- **`ProductSheet`** — §4.3 bottom sheet; also usable from Home reorder edit later.
- **`QuantityStepper`** — sizes 28px (cart rows) and 44px (sheet).
- **`TierProgressBar`** — §4.2.4/§4.3.4; all math from `pricing.js`.
- **`PrimaryButton`** — the one azure button: 52px tall, radius 14px, 17px/600 white text, full width; pressed = scale 0.98 + 8% darken, 120ms ease-out; loading = text fades to a 20px spinner (button width unchanged — no layout jump); disabled = fog bg / graphite text (never a faded azure).
- **`MobilePushHeader`** — 44px back-chevron header for pushed screens.

### Motion rules (global)

- Durations 120–300ms only; `cubic-bezier(0.32, 0.72, 0, 1)` for sheets/pills, `ease-out` for everything else. One spring-ish moment per interaction, max.
- Sheets slide up; pushed screens may use a subtle 8px slide+fade (CSS only — don't fight the router).
- Skeletons: fog-colored blocks with a soft shimmer, matching final layout exactly (no spinners for page loads; spinners only inside buttons).
- Respect `prefers-reduced-motion`: cut all transforms, keep opacity fades.

### Numbers & currency

- All money: `formatMoney` from `pricing.js`. Tabular figures (`font-variant-numeric: tabular-nums`) on every price, total, and stat.
- Large amounts may compress on Home stats only ("NPR 4.2L" lakh-style); never compress in cart/checkout/detail.

---

## 6. States you must design (not bolt on)

For **every** screen: loading skeleton, empty, API error, and refetching.

- Error: inline card — "Couldn't load products" 15px/600 + one azure "Try again" text button wired to the query's `refetch`. Never a red banner, never a raw error string from the server.
- Refetching (`isFetching` with data present): keep content, show a 2px azure indeterminate hairline under the header. No overlay dimming.
- Offline/failed order placement: keep the confirm sheet open, show the inline error inside it, preserve the draft — a dealer must never lose a built cart.

---

## 7. Implementation constraints

- React 19 + existing stack; **no new dependencies** (no framer-motion, no UI kits — CSS transitions/keyframes are sufficient for everything specified).
- Styling: follow the file's existing convention (styled-jsx style blocks / CSS in the component, tokens from `src/index.css`). All colors via tokens — zero hex literals outside token definitions except the specified tint math.
- All specs above are the ≤768px experience via media queries/conditional rendering; **desktop dealer layouts keep working**. `DashboardShell` continues to serve other roles unchanged — gate the tab bar/pill on dealer role + mobile width.
- Touch targets ≥ 44×44px everywhere. Test at 390×844 and 360×780.
- Data: RTK Query hooks only; pricing math only through `pricing.js`; draft only through `draftStorage.js` (extend it with the event-sync hook rather than replacing it).
- Verify with `npm run dev` + browser at mobile viewport, and `npm run lint`. Click through: fresh browse → add 2 families with mixed packs → verify family tier price updates live → place order → success state → tracker → reorder from history.

## 8. Acceptance checklist

- [ ] Repeat order in ≤3 taps from Home; new order in ≤6 taps for one product.
- [ ] Exactly one azure element visible per screen (the primary action); everything else ink/graphite/fog.
- [ ] Cart pill appears/updates/pulses correctly from Catalog, ProductSheet, and Home.
- [ ] Family tier price visibly changes in the pack selector as quantities cross a tier boundary.
- [ ] Status rail matches `ORDER_STATUS_META` for all six statuses including both off-ramps.
- [ ] No horizontal scroll anywhere except the category chip row.
- [ ] No data table, no dropdown menus for primary actions, no toast notifications.
- [ ] Skeletons match final layout; draft survives a failed order placement and a page reload.
- [ ] Desktop dealer pages and Admin/Dispatcher/Factory mobile views unchanged.
