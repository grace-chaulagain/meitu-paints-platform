# Dealer Mobile Experience — V3 Polish Prompt

> Hand this file to the implementing agent as-is. It builds on the shipped V1+V2 work (`DEALER_MOBILE_DESIGN_PROMPT.md`, `DEALER_MOBILE_DESIGN_PROMPT_V2.md`; code under `src/dealer/mobile/`). This pass has four parts: **(1)** a real gesture-driven bottom sheet, **(2)** search redesigned from a pinned bar to an icon-activated overlay, **(3)** a global ~15% type-scale reduction, **(4)** first-class product removal in the cart — plus a short list of final-tightening upgrades.
>
> **Invoke the `emil-design-eng` skill before writing any animation or gesture code.** §1 below is essentially that skill's gesture chapter (momentum dismissal, damping, pointer capture, multi-touch protection) applied to this codebase — treat the skill as the authority.

Scope: dealer role, ≤768px, target 390×844. All motion obeys the V2 §3 animation constitution (easing tokens, transform/opacity only, transitions-over-keyframes, reduced-motion fallbacks). No new dependencies.

---

## 1. The sheet becomes a real drawer (`MobileSheet.jsx` — fix once, every sheet inherits)

Three confirmed defects in the current shell, all fixed in this one component (ProductSheet, the cart confirm sheet, and NewSaleMobileSheet all render through it):

1. **No exit animation exists at all** — `if (!open) return null` unmounts instantly, so both the scrim tap and programmatic closes make the sheet vanish in one frame.
2. **No drag gesture** — the grab handle is decorative.
3. **No background lock** — the page behind the scrim still scrolls while the sheet is open.

### 1.1 Animated dismissal (mount/unmount choreography)

- Keep the sheet mounted while closing: internal `closing` state; `onClose` intent → add a `closing` class → sheet transitions to `translateY(100%)` (250ms, `--ease-out-strong`) while the scrim fades to 0 (200ms) → unmount on `transitionend` (with a 300ms setTimeout fallback in case the event is swallowed). **Every** close path goes through this: scrim tap, close button, drag release, successful add/submit.
- Enter stays as-is conceptually but must use the same mounted pattern: initial `translateY(100%)` → identity, 400ms `--ease-sheet`, scrim 0 → 1. Use `@starting-style` where supported with the `data-mounted` fallback.
- Use percentages (`translateY(100%)`), never pixel heights — the sheet's height varies by content and variant.

### 1.2 Drag-to-dismiss (the Vaul/emil gesture spec)

Pointer-event based (works for touch + mouse), applied to the whole sheet:

- **Start**: `pointerdown` anywhere on the sheet begins a *candidate* drag. It becomes a real drag only when the vertical displacement exceeds ~8px **downward** and, critically, only if the sheet's inner scroller (`.dealer-m-sheet-scroll`) is at `scrollTop === 0` — otherwise the gesture belongs to content scrolling. The handle and header region always drag immediately.
- **During**: call `setPointerCapture` so the drag survives leaving the element bounds; ignore additional pointers once dragging (multi-touch protection); set `touch-action: none` on the sheet while dragging so the browser doesn't fight for the gesture. Write `element.style.transform = translateY(...)` **directly on the sheet node** each move — never via a CSS variable on a parent (style-recalc cost on all children) and with `transition: none` during the drag (the finger is the animation).
- **Downward drag** tracks the finger 1:1. **Upward drag past rest** gets friction, not a wall: `offset = -overshoot * 0.15` capped ~24px, so the sheet feels rubber-banded, iOS-style.
- **Scrim follows the finger**: scrim opacity = `1 - (dragY / sheetHeight)`, updated in the same frame (direct style write). The background visibly "returns" as the card is pulled down — this is what makes the gesture feel physical.
- **Release** (momentum rule from the skill): compute `velocity = |dragY| / elapsedMs`. Dismiss if `velocity > 0.11` **or** `dragY > sheetHeight * 0.3`; a quick flick dismisses regardless of distance. Dismissal animates from the *current* position to `translateY(100%)` (200ms ease-out — release is always snappy). Otherwise spring back to rest: 300ms `--ease-sheet` (a transition retargets smoothly from wherever the finger left it).
- `prefers-reduced-motion`: drag still works (it's direct manipulation, not decoration), but enter/exit become 150ms opacity fades.

### 1.3 Background lock

- While any sheet is open: `document.body` gets `overflow: hidden` with the current scroll position preserved (store `scrollY`, set `position: fixed; top: -scrollY; width: 100%`, restore on close — the classic iOS-Safari-proof lock; plain `overflow: hidden` alone doesn't stop iOS touch scrolling).
- `overscroll-behavior: contain` on `.dealer-m-sheet-scroll` so hitting the end of the sheet's own scroll never chains into the page.
- Implement as a small `useBodyScrollLock(active)` hook in `src/dealer/mobile/` — reference-counted so stacked sheet + toast situations can't unlock early.
- The scrim also swallows all pointer/wheel events (it already covers the viewport; add `touchmove` preventDefault on the scrim itself).

### 1.4 QA for this section

Test at 5× slow-mo in DevTools per the emil debugging method: scrim-tap close, flick-dismiss from a scrolled-then-returned-to-top sheet, slow-drag-past-30% release, drag-up rubber band, rapid open/close retargeting, and background immobility (attempt two-finger scroll behind the scrim).

---

## 2. Browse search — from pinned bar to icon-activated overlay

**Remove the sticky search field** from `LargeTitleHeader`'s `sticky` slot on the Products tab — it permanently occupies ~60px of premium space and (per user feedback) reads as distracting chrome.

Replace with the icon-activated pattern:

- **Idle state**: a 36px circular search button (fog background, 18px graphite magnifier) sitting at the trailing edge of the large-title row — vertically centered against "Products". In the collapsed/compact header state it migrates to the trailing edge of the 44px pinned bar (same element, position adjusted by header state). The category chips row moves up to fill the freed space; the product list starts one card sooner.
- **Activation** (tap): a **search overlay header** slides over the title area: a full-width fog input field (radius 12, magnifier icon, autofocused) with a "Cancel" text button (15px azure) at the trailing edge. Motion: the field scales in from the icon's position — `transform-origin` at the icon's corner, `scale(0.9) + opacity 0 → identity`, 250ms `--ease-out-strong`; Cancel slides in 8px from the right, 30ms delayed. The large title and search button crossfade out (150ms). This is the App Store's search-activation feel without pretending to be a native nav controller.
- **Active state**: input focused (keyboard up), category chips remain usable below (search + category compose, as the filtering logic already supports), results update live as today. The compact blur header keeps the field pinned while scrolling results — pinning is fine *during* an active search; it's the permanent idle bar that was the problem.
- **Dismissal**: "Cancel" or clearing + blurring reverses the animation (field scales back toward the icon, 200ms ease-out — exit faster than enter), restores the title, clears the query, and re-shows the full list. Android/desktop Escape key also cancels (no animation on keyboard-initiated close, per the constitution).
- **iOS Safari trap — mandatory**: the search input's `font-size` must be **≥16px**, or iOS auto-zooms the viewport on focus and wrecks the layout. This overrides §3's reduction for this input (and all form inputs — see §3 exceptions).
- Empty results state upgrade: "No results for 'silk'" 15px/600 + the category chips rendered as suggestion pills beneath ("Try: Primer · Emulsion · Distemper").

---

## 3. Global type scale — ~15% smaller, tokenized

The current scale reads oversized on a 390px screen. Reduce ~15% across the dealer mobile UI, and while doing it, **replace every literal `font-size` in `DealerMobileStyles.core.jsx` / `DealerMobileStyles.pages.jsx` with a token** so the next adjustment is one line, not 120 edits.

Define in the core styles (on the dealer-mobile root class):

```css
--t-hero: 29px;      /* was 34 - large titles */
--t-title1: 24px;    /* was 28 - greeting, success headline */
--t-title2: 20px;    /* was 24 - totals, stat values */
--t-title3: 19px;    /* was 22 - sheet product name */
--t-headline: 17px;  /* was 20 */
--t-body-lg: 14.5px; /* was 17 - primary buttons, pack labels, compact header title */
--t-body: 13.5px;    /* was 16 */
--t-callout: 13px;   /* was 15 - card names, row primaries */
--t-subhead: 12px;   /* was 14 - secondary row text */
--t-footnote: 11px;  /* was 13 - metadata, section headers, chips */
--t-caption: 10.5px; /* was 12 - badges, chip counts */
--t-caption2: 10px;  /* was 11 and below - floor, see rules */
```

Rules:

- Map every existing size to its nearest token (17→`--t-body-lg`, 15→`--t-callout`, 13→`--t-footnote`, etc.). In-between strays (14.5, 13.5, 12.5, 11.5, 10.5, 9.5) collapse into the adjacent token — the scale gets *cleaner*, not just smaller.
- **Floor: 10px.** Nothing functional below it; anything currently at 9.5–10.5px becomes `--t-caption2`.
- **Exceptions that do NOT shrink**: ① all `<input>`/`<textarea>`/`<select>` stay ≥16px (iOS focus-zoom prevention — see §2); ② money totals at the moment of commitment (sheet footer button total, cart grand total, confirm sheet total) keep their current size — decision-critical numbers stay big (Apple keeps the price large on the buy page for a reason); ③ the tab bar labels (already 10px).
- Line-heights: where set in px, scale them with their text (maintain existing ratios). Letter-spacing on large titles stays negative (−0.02em).
- Touch targets are unaffected — 44px minimums come from padding/height, not font size; verify no control shrank below 44px after the pass.
- After the sweep: `grep -c "font-size:[0-9]" DealerMobileStyles.*.jsx` should return ~0 (tokens only).

---

## 4. Cart — complete product removal

**Defect**: the cart currently has no removal affordance at all — the only way to get rid of a line is to step its quantity down one tap at a time, and there is no way to drop an entire product family at once. Removal must exist at both levels, discoverable, and reversible:

- **Line level (one pack size)** — two paths to the same animated result:
  1. **Swipe-left** on a pack row reveals a single "Remove" action (72px wide, `--color-caution`-free — use Meitu red here, the one sanctioned red-UI moment per V1, white label at `--t-subhead`, matching the row's radius). Reuse the §1.2 pointer/velocity mechanics via the shared `useSwipeAction` hook: release past 40% of the action width or a flick commits; anything less springs back. Only one row may be open at a time — opening a second closes the first.
  2. **Stepping to 0**: when a row's stepper hits 0, remove the line (no confirm dialog). At quantity 1, the `−` button's glyph crossfades to a small trash glyph (150ms opacity swap) so the next tap's meaning is announced before it happens — this is the discoverable path for dealers who will never find the swipe.
- **Product level (whole family)**: each family card gets a quiet "Remove" text button (`--t-footnote`, graphite, trailing edge of the family header row; ≥44px touch target via padding). One tap removes **all pack lines of that family** from the draft.
- **Removal choreography** (same for every path): the row/card collapses via the `grid-template-rows: 1fr → 0fr` technique + fade (250ms, `--ease-in-out-strong`) while the remaining list closes the gap in the same motion; cart totals and the cart pill update with their existing blur-crossfade; if the cart empties, the empty state fades in rather than popping.
- **Undo instead of confirm** (the professional pattern — never a "Are you sure?" dialog for a reversible act): every removal fires a toast through the existing `MobileToast` system — "Removed Silk Emulsion" with a trailing **Undo** text action (azure, `--t-subhead`). Undo restores the exact prior quantities from a snapshot taken at removal time (keep the last snapshot only; a new removal replaces it). Toast auto-dismisses after 5s (longer than the standard 2.5s — it carries an action).
- Family-header "Remove" and swipe actions must not fight the card's own tap/press states: the swipe gesture claims the pointer only after ~8px of horizontal intent, same threshold discipline as §1.2.

## 5. Third-pass creative tightening (Apple Store / Uber Eats / Stripe — implement all)

1. **"Order again" shelf on Browse** (Uber Eats' reorder rail): above the category chips, a horizontal full-bleed rail (V2 gutter-breakout pattern) of the dealer's 5 most-ordered families — 64px product image cards, 12px radius, name in `--t-caption` below, tap opens the ProductSheet. Compute from the existing orders query (`limit: 100`) — count SKU family frequency, no new endpoint, show only when the dealer has ≥3 past orders. This is the fastest path from "open app" to "sheet open" for a repeat buyer.
2. **Tier-crossing celebration** (once per crossing, not per render): when a stepper change moves a family *into* a deeper tier, the `TierProgressBar` fill pulses (scale 1→1.03→1 on the bar, 300ms) and the tier label does a blur-crossfade (2px blur + opacity swap, 200ms — the emil blur-masking trick for state changes that would otherwise hard-swap). Pair with a single `navigator.vibrate?.(10)` tick. No sound — this is frequent-ish; sound stays reserved for completions.
3. **Status rail progressive fill** (order detail, once per mount): nodes and connecting segments fill sequentially, 150ms apart, ease-out — the Uber Eats tracker moment of "watching your order be real". Static under reduced motion.
4. **Rolling total in the cart pill** (Stripe number confidence): when the pill's amount changes, the old value blur-crossfades to the new one (2px blur, 150ms) instead of hard-swapping; `tabular-nums` guarantees no width jitter for same-digit-count changes; the pill itself already pulses on add. Do *not* implement per-digit odometer rolls — over-animated for a value that changes constantly while building an order.
5. **Skeleton → content crossfade**: page skeletons currently pop into content. Fade content in over the skeleton (skeleton fades out 150ms, content fades in 200ms, 4px rise) — one shared `SkeletonSwap` wrapper or CSS convention, applied to Home/Browse/Orders/Inventory/Sales.
6. **Swipe-to-reorder on order-history cards** (Uber Eats): swipe-left reveals a single azure "Reorder" action (the mirror of the cart's swipe-to-remove from §4); release past 40% or flick triggers it — loads that order's items into the draft and navigates to the cart. Both are consumers of the shared `useSwipeAction` hook.
7. **Compact-header context totals** (Stripe's sticky context): while scrolled on Orders, the compact blur header shows a trailing `--t-footnote` graphite summary of the active filter ("Active · 2"); on Browse during search, the match count ("14 results"). Quiet orientation, zero chrome.
8. **First-open coach mark, once ever** (`localStorage` flag): the first time the ProductSheet opens, the grab handle does one slow dip-and-return (translateY 0→6→0, 600ms, 400ms after open) hinting "this is draggable". Never repeats. Skipped under reduced motion.

---

## 6. Engineering constraints

- All gesture math lives in reusable hooks under `src/dealer/mobile/`: `useSheetDrag`, `useBodyScrollLock`, `useSwipeAction`. Direct style writes during gestures; transitions only on release.
- No new dependencies; no `<canvas>`; clip-path/transform/opacity only (constitution).
- `MobileSheet` API is unchanged for callers (`open/onClose/height/footer`) — the choreography is internal. Verify all three consumers (ProductSheet, confirm sheet, NewSaleMobileSheet) after the change.
- `npm run lint` clean. Manual verification on a real phone (or Safari responsive mode + touch emulation) for §1 — mouse-only testing of touch gestures is not acceptance.

## 7. Acceptance checklist

- [ ] Sheet: scrim tap, close button, and submit all animate the card *down* before unmount; nothing vanishes in one frame.
- [ ] Sheet: flick-down dismisses (velocity rule); slow drag <30% springs back from the finger's position; drag-up rubber-bands; scrim opacity tracks the finger.
- [ ] Background: page behind an open sheet cannot scroll (iOS Safari included); scroll position is preserved on close.
- [ ] Browse idle state has no search field — only the circular icon; activation/dismissal animate from/to the icon; input ≥16px (no iOS zoom jump).
- [ ] Type: zero literal font-sizes left in the mobile style files; scale reads ~15% smaller; inputs and commitment totals exempt; nothing below 10px; all targets still ≥44px.
- [ ] Cart: swipe-left removes a pack line; stepper-to-0 removes it (with the trash-glyph hint at qty 1); family "Remove" clears all its lines; every removal collapses smoothly and offers a working 5s Undo toast; no confirmation dialogs anywhere.
- [ ] Reorder shelf appears for dealers with ≥3 orders and opens the sheet in one tap.
- [ ] Tier crossing pulses once per crossing; status rail fills once per mount; skeletons crossfade; order cards swipe to reorder.
- [ ] Every new animation passes a 5× slow-mo inspection and has a reduced-motion fallback.
