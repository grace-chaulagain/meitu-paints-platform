# Multi-State Order Handling — Implementation Prompt (Admin · Factory · Dispatcher)
## v2 — exhaustive edition

> Hand this file to the implementing agent as-is. It implements the redesign diagnosed in `ORDER_STATE_HANDLING_REPORT.md` (read Parts 1, 2, 5 first — they are the *why* for everything here). This version is deliberately verbose: where it states a file, line anchor, string, or timing, that is the decision — do not improvise an alternative. Where reality has drifted from a line anchor, find the same code by its quoted content.
>
> **Locked decisions (owner-approved, not open for re-litigation):**
> 1. Scope: frontend + *minimal* backend (conflict-error enrichment + one revert endpoint). No WebSockets/SSE, no event-log collection, no new npm dependencies.
> 2. Devices: desktop AND mobile get full treatment in all three portals.
> 3. Step 0 (freshness + conflict UX) ships first, in this pass.
> 4. Arrivals: badge pulse + highlighted card entry + subtle mutable chime.
>
> **Before writing any animation code, invoke the `emil-design-eng` skill.** The animation constitution (`DEALER_MOBILE_DESIGN_PROMPT_V2.md` §3) is binding: easing tokens `--ease-out-strong: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out-strong: cubic-bezier(0.77,0,0.175,1)`, `--ease-sheet: cubic-bezier(0.32,0.72,0,1)`; transform/opacity only; transitions over keyframes for anything retriggering; exits faster than entrances; `prefers-reduced-motion` fallbacks on every animation; 5×-slow-mo inspection before sign-off.
>
> Implement phases **strictly in order**. Each phase ends with its own verification step (§V).

---

## §A — Domain truth ledger (memorize before writing a line)

Every ambiguity the previous prompt left implicit is resolved here. When any spec below seems to conflict with this ledger, the ledger wins.

**A1. States.** `ORDER_STATUS` = `SUBMITTED → VERIFIED → DISPATCHED → COMPLETED` + off-ramps `REJECTED`, `CANCELLED` (defined in `Server/src/models/Order.model.js`, re-exported from `constants/statuses.js`). Never invent stages ("mixing", "packed", "out for delivery" are banned words in UI copy). `PAYMENT_STATUS` / `SHIPMENT_STATUS` are unrelated enums — never render their members through the order state machine.

**A2. Fulfillment mode fork.** `order.dealerSnapshot.fulfillmentMode` ∈ {factory-fulfilled, dispatcher-fulfilled}. This forks THREE things: who reviews (A3), what DISPATCHED means (A4), and the stock lifecycle (A5). Any list, count, or filter that buckets by status **must** scope by mode or use mode-aware labels — status-only logic silently conflates "truck on the highway" with "already handed to the dealer".

**A3. Reviewer party.** `ORDER_REVIEWED_BY` = `ADMIN | DISPATCHER`. Factory-routed orders are reviewed by Admin (`verifyAdminOrder` → `/api/orders/:id/verify`); dispatcher-assigned orders by their dispatcher (`verifyDispatcherOrder` → `/api/dispatchers/me/orders/:id/verify`). Owner of a SUBMITTED order = its reviewer party.

**A4. The DISPATCHED duality — and the complete() contradiction, resolved.** Factory mode: DISPATCHED = in transit; factory later calls deliver → COMPLETED (4 meaningful stages). Dispatcher mode: `dispatcher.service.js` line ~916 comments *"Dispatched is terminal for these orders — there is no separate delivery confirmation"*, **yet** `completeAssignedOrder()` (line ~1028) exists, is exposed in the UI (`canComplete` in `DispatcherOrderDetailPage.jsx:117`), and sends a status email. **Resolution directive (do exactly this):** treat dispatcher-mode DISPATCHED as *effectively delivered* — canonical label **"Delivered"**, owner `null`, the order leaves every "needs action" view. The rail for dispatcher-mode orders has **3 nodes** (Submitted → Verified → Delivered); when `status === COMPLETED` the third node's sublabel becomes "Delivered · confirmed". `completeAssignedOrder` is surfaced only as a quiet secondary action ("Confirm handover") inside the dispatcher's order detail — bookkeeping, never a pending step, never a badge, never counted in "Needs you". Do not "fix" the backend comment or remove the endpoint.

**A5. Stock lifecycle (source of ceremony copy — verified against services).**
- Factory mode: **verify** reserves stock (`reserveStockForOrder` called inside the verify path, `order.service.js` ~996; reservation fields `stockReservation.reservedAt/By`); **reject/revert** releases it; **factory dispatch** consumes it (`markOut` path — the existing button already says "consumes reserved stock"); deliver touches no stock.
- Dispatcher mode: **verify** runs a stock *check* only (`stock-check` endpoint; nothing reserved); **dispatch** deducts dispatcher stock and credits the dealer's received-quantity counter (`consumeDispatcherStockForOrder`); complete touches no stock.

**A6. Email side effects (for ceremony copy; all use the timeout-hardened mailer).** Order submission → factory notification (`notifyFactoryOrderSubmitted`, `order.service.js:649`). Admin verify → dealer status email (`sendDealerStatusEmail`, `order.service.js:~1032`). Factory dispatch & deliver → dealer status email (`factory.service.js` `emailDealer` path, ~135). Dispatcher dispatch & complete → dealer status email (dispatcher.service.js, logged as `[dispatcher-email]`). Emails are fire-and-forget (failures logged, not thrown) — ceremony copy says "The dealer will be emailed", never promises delivery.

**A7. Orthogonal flags — never render as statuses.** `closedAt/closedBy` = admin financial reconciliation on top of status. Archive (dispatcher `orders/archive`) = a list scope, not a state. `amendedAt` + `OrderRevision` = content changed, status did not. `googleSheetsArchive.*` = external mirror side effect — preserve, may appear in the event feed, never in ceremonies.

**A8. Backend guards are correct and atomic** (status-preconditioned `findOneAndUpdate`). Never weaken them; the frontend mirrors them. One honest conflict message already exists (`dispatcher.service.js:~1085` — "Order status changed before it could be completed. Please refresh and try again."); Phase 0 standardizes that instinct everywhere with structured payloads.

---

## Phase 0 — Freshness & truth

### 0.1 Freshness plumbing

1. `src/redux/store.js`: add `import { setupListeners } from "@reduxjs/toolkit/query"` and `setupListeners(store.dispatch)` after store creation. (Currently absent — verified.)
2. `src/redux/api/meituApi.js`: add `refetchOnFocus: true, refetchOnReconnect: true` to the `createApi` config.
3. Polling — **at call sites via hook options** (so unmounted pages never poll), preserving each site's existing arg object:
   - `useGetAdminOrdersQuery(args, { pollingInterval: 20000 })` in `AdminOrdersPage.jsx`
   - `useGetFactoryOrdersQuery(args, { pollingInterval: 20000 })` in `FactoryOrdersPage.jsx`
   - `useGetDispatcherOrdersQuery(args, { pollingInterval: 20000 })` in `DispatcherOrdersPage.jsx`
   - The open order-detail query in each of the three detail surfaces: `{ pollingInterval: 15000 }`.
   - Do NOT poll: archives, catalogs, products, dealers, settings, insights, or any dealer-app query (the dealer app is out of scope).
4. Refetch indicator: only the established quiet pattern — a 2px azure indeterminate hairline under the page header while `isFetching && !isLoading`. No spinners, no overlay, no opacity dimming of lists. Where a portal page lacks the hairline, add it (one shared CSS class, `ops-refetch-hairline`).

### 0.2 Conflict UX — the phrase "Action failed." is banned

**Backend.** Every status-precondition guard in the three services throws with structured details. Sites to update (find by quoted precondition if lines drifted): `order.service.js` ~265, ~323 (verify/reject from non-SUBMITTED); `factory.service.js` ~351, ~367-filter, ~431, ~567, ~613 (dispatch/deliver/reject preconditions); `dispatcher.service.js` verify/dispatch (~922 area)/complete (~1038, ~1085) preconditions. Uniform shape:

```js
throw new ApiError(409, "Order state has changed", {
  code: "ORDER_STATE_CONFLICT",
  currentStatus: order.status,
  reviewedByRole: order.reviewedByRole || null,
  changedAt: order.reviewedAt || order.fulfillment?.sentToFactoryAt
         || order.fulfillment?.outForDeliveryAt || order.fulfillment?.deliveredAt || null,
});
```

`ApiError` already carries `details`/`code` — this is additive; keep each guard's HTTP semantics otherwise unchanged. Also apply to the atomic-update "document not matched" fallbacks (the compare-and-set misses), which are conflicts by definition.

**Frontend.** New module `src/shared/orderConflict.js`:

```js
export async function handleTransitionError(err, { refetchOrder, showToast }) → boolean // true = was a conflict, handled
```

Behavior on `err.data?.details?.code === "ORDER_STATE_CONFLICT"` (verify actual serialized error shape via `getQueryErrorMessage`'s source before coding): ① `refetchOrder()` and invalidate the relevant list tag; ② toast copy built from this table (role names title-cased, time via the codebase's existing relative-time helper):

| `currentStatus` | Toast copy |
|---|---|
| VERIFIED | `Already verified by the {Admin|Dispatcher} · {rel-time}` |
| DISPATCHED | `This order was dispatched while you were viewing it` |
| COMPLETED | `This order was already completed` |
| REJECTED / CANCELLED | `This order was {rejected|cancelled} — no further actions` |
| details missing | `This order changed state — showing the latest` |

③ the visible card/detail self-corrects via the normal refetch render (Phase 2's chip crossfade makes the correction perceptible); ④ **aria-live="polite"** announcement of the toast text. Wire into every transition catch: `FactoryOrderModal.run()` (~line 133), `AdminOrderDetailPage` `runAction` handlers (verify ~171, reject ~221, list-level ~237), `DispatcherOrderDetailPage` handlers (~157–200), and any list-level swipe/inline actions added later. Non-conflict fallback copy everywhere: **"Couldn't complete — check your connection and try again."**

---

## Phase 1 — `src/shared/orderStateMachine.js` (one rulebook)

Dependency-free ESM, no React imports. Full required surface (signatures are the contract):

```js
export const isDispatcherFulfilled = (order) => /* read order.dealerSnapshot.fulfillmentMode; treat missing/unknown as factory-fulfilled and log a console.warn once per session */;
export const reviewerParty = (order) => isDispatcherFulfilled(order) ? "DISPATCHER" : "ADMIN";

export function getStatusLabel(order)   // canonical, mode-aware — table below
export function getStatusTone(order)    // "neutral" | "attention" | "progress" | "success" | "caution"
export function getOwner(order)         // "ADMIN" | "DISPATCHER" | "FACTORY" | null
export function isWaitingOn(order, role)
export function getRailNodes(order)     // array of { key, label, at, byRole, state:"done"|"current"|"todo"|"terminated" } — 4 nodes factory-mode, 3 dispatcher-mode (A4); off-ramps terminate the rail at the point reached, appending a caution node labeled Rejected/Cancelled with reason
export function getTransitions(order, role) // [{ action, target, kind:"primary"|"destructive"|"bookkeeping", irreversible:boolean }]
export function getConsequences(order, action) // string[] — exact strings from the matrix below
export function getHandoffLine(order, action)  // "Next: …" string
```

**Canonical labels** (the ONLY vocabulary any chip/toast/rail/tab may use; factory lane headers Inbox/Shipment/Completed may remain as *headers only*):

| Status | Factory-mode label | Dispatcher-mode label | Tone | Owner |
|---|---|---|---|---|
| SUBMITTED | Submitted | Submitted | attention | reviewerParty |
| VERIFIED | Verified — with Factory | Verified — ready to dispatch | progress | FACTORY / DISPATCHER |
| DISPATCHED | In transit | Delivered | progress / success | FACTORY / null |
| COMPLETED | Delivered | Delivered · confirmed | success | null |
| REJECTED | Rejected | Rejected | caution | null |
| CANCELLED | Cancelled | Cancelled | caution | null |

**Transitions per role** (mirror backend exactly; nothing else exists):
ADMIN on factory-mode SUBMITTED → verify (primary), reject (destructive). DISPATCHER on own SUBMITTED → verify, reject; on own VERIFIED → dispatch (primary, irreversible); on own DISPATCHED → confirm-handover (bookkeeping). FACTORY on factory-mode VERIFIED → dispatch (primary, irreversible), reject (destructive, per `canReject = !isOrderDone`); on DISPATCHED → deliver (primary). ADMIN additionally: revert-verification (Phase 6) on factory-mode VERIFIED while `fulfillment.sentToFactoryAt == null` and reservation not consumed.

**Consequences matrix** (exact strings; ceremony renders them as a list, ⚠-prefixed when irreversible):

| Action | Strings |
|---|---|
| verify (factory-mode) | "Stock will be reserved for this order." · "The dealer will be emailed." · "You can undo this until the Factory begins work." |
| verify (dispatcher-mode) | "Availability is checked against your regional stock." · "The dealer will be emailed." |
| reject (either) | ⚠ "This permanently rejects the order." · "Any reserved stock is released." · "The dealer will be emailed with your reason." |
| dispatch (factory) | ⚠ "Reserved stock will be consumed — this cannot be undone." · "The Proforma Invoice will be attached." · "The dealer will be emailed." |
| dispatch (dispatcher) | ⚠ "Your regional stock will be deducted — this cannot be undone." · "The dealer's received-stock counter is credited." · "This marks the order Delivered — dispatcher orders have no transit stage." |
| deliver (factory) | "Marks the order Delivered and closes fulfillment." · "The dealer will be emailed." |
| confirm-handover | "Bookkeeping only — records the handover as confirmed." |
| revert-verification | "Returns the order to Submitted." · "Reserved stock is released." · "The action is recorded in the order's history." |

**Deletions** (replaced by `getTransitions`): `canDispatch`/`canDeliver`/`canReject` at `FactoryOrderModal.jsx:109–111`; `canComplete` at `DispatcherOrderDetailPage.jsx:117`; admin's inline equivalents in `AdminOrderDetailPage.jsx`/`AdminOrdersPage.jsx`. Grep for `status ===` / `status !==` in the three portals afterward — any survivor deciding *what a user may do* is a defect (pure display branching is fine).

---

## Phase 2 — Shared components (`src/components/orderflow/`)

All styled with existing tokens; no new deps; every animation obeys the constitution; every component ships desktop + mobile styles + reduced-motion behavior.

**2.1 `OrderStatusRail`** — promote/extend the dealer `StatusRail` (keep a dealer-compatible wrapper so the dealer app is untouched). Props: `order`, `size: "sm"|"lg"`, `interactive?: boolean`. Data exclusively from `getRailNodes`. `lg`: 28px nodes, connecting 2px lines that fill left→right 300ms `--ease-in-out-strong` sequentially (150ms stagger, once per mount), metadata under each node ("Verified · Admin · Jul 21, 2:14 PM" — 12px graphite, role not personal names). `sm`: 10px nodes + 1.5px lines, no metadata (title attribute on desktop, tap → detail on mobile). Terminated rails: reached nodes stay `done`-styled, the caution node renders with the rejection/cancellation reason beneath (never render phantom "todo" nodes after a termination). Current node: azure with a 2s breathing pulse (opacity 0.5↔1; static ring under reduced motion).

**2.2 `OrderEventFeed`** — props `order`, `limit?`. Pure derivation, newest first, from: `createdAt` ("Placed by {dealer name}"), `amendedAt` (+ revision link "3 items changed"), `reviewedAt/ByRole` ("Verified by the Admin" / rejection with reason), `stockReservation.reservedAt|releasedAt|consumedAt` ("42 units reserved" — quantities only if present on the order), `fulfillment.proformaGeneratedAt/By` ("Proforma Invoice generated"), `fulfillment.sentToFactoryAt`, `outForDeliveryAt` (+ driver name/vehicle from the dispatch record), `deliveredAt`, `closedAt/By` ("Closed for reconciliation"), `archivedAt`, `googleSheetsArchive.appendedAt` ("Synced to records archive" — muted styling). Row: relative time 12px graphite (absolute on hover/tap), sentence 14px ink, actor role 600-weight. Rows beyond `limit` collapse behind "Show full history (N)" using the `grid-template-rows: 0fr→1fr` technique. Missing timestamps render nothing — never "N/A".

**2.3 `OwnerChip`** — props `order`, `role` (viewer's role). `getOwner` === viewer → **"Waiting on you"** (azure bg at 10%, azure text, 600 — the only azure allowed on a card); else "With Factory"/"With Admin"/"With Dispatcher" (fog/ink); terminal success → "Done" (quiet ink); off-ramps → caution-tinted label. One chip per card, top-right, before the status chip. When owner changes on refetch, crossfade old→new 200ms with a 2px blur during the swap (emil blur-mask).

**2.4 `TransitionConfirmSheet`** — props `order`, `action`, `onConfirm`, `busy`, optional `children` (extra fields — factory dispatch injects its existing driver-details + PI controls; dispatcher/admin verify injects the review-note field). Renders: ① `OrderStatusRail lg` with target node pulsing; ② `getConsequences` list, ⚠ rows in `--color-caution` with a warning glyph; ③ `getHandoffLine` ("Next: Factory prepares shipment" / "Next: nothing — the order is complete"); ④ confirm `PrimaryButton` (label = action verb + order number, in-flight `AppleSpinner` swap at constant width) + Cancel ghost. Desktop: existing `ModalOverlay`, max-width 560; mobile: drag-dismissable `MobileSheet` (drag blocked while `busy`). The factory button's honest copy ("consumes reserved stock") moves into the consequences list; the button itself becomes "Dispatch {orderNumber}".

**2.5 `useOrderTransition`** — orchestrates success: ① in-place morph (status chip crossfade 200ms + rail advance + "Verified · just now" line fade-in 150ms); ② 2.5s hold — reversible transitions show an inline **Undo** button on the card (Phase 6), irreversible show none; ③ exit-if-filtered-out: `translate` toward the destination tab/lane's screen direction, 300ms `--ease-in-out-strong` + fade, while destination badge pulses (scale 1→1.15→1, 250ms); if the current filter still contains the order, no exit — it stays, transformed, list re-sorts on next poll. Sounds: `playCompletion()` on verify/dispatch/deliver success (not bookkeeping). Reduced motion: instant swap + badge tick, hold and Undo still function.

**2.6 Arrival system** — `useQueueArrivals(items, laneKey)`: diff incoming ids per poll; new cards mount with azure-at-6% background decaying over 2s + slide-in 8px `--ease-out-strong`; lane/tab badge pulses; `playArrival()` — new export in `completionFeedback.js`: two ascending sine notes (660→880Hz, ~70ms apart, gain envelope peaking 0.08 — audibly quieter than `playCompletion`), throttled globally to once per 10s, silent when `localStorage["meitu_ops_sound_muted"] === "1"`; mute toggle = small speaker icon in each portal header (persists, shared key). "New since you last looked": per-lane `localStorage["meitu_ops_seen:{userId}:{laneKey}"]`; cards newer than the stamp show an azure "New" dot; stamp updates after the lane is visibly on screen 5s (IntersectionObserver). Arrivals also announce via a single `aria-live="polite"` region ("2 new orders in Inbox").

---

## Phase 3 — Admin portal

**Desktop list (`AdminOrdersPage.jsx`).** Above existing filters, a **"Needs you (N)"** segment — default whenever N>0, remembered per session; contents = `isWaitingOn(order,"ADMIN")`. Every timeline row/card gains `OwnerChip` + `OrderStatusRail sm` + mode indicator (tiny "Factory"/"Dispatcher" tag). Day-grouped timeline layout stays. Inline verify from the list opens `TransitionConfirmSheet` (never bare-confirm). Success runs `useOrderTransition`; conflicts run `handleTransitionError`. The list's two `<table>` renders become card lists at ≤768px.

**Detail (`AdminOrderDetailPage.jsx`).** Order: hero (number eyebrow / dealer name / total) → `OrderStatusRail lg` → payment + proforma chips → **`OrderEventFeed`** card → items → action area rendering only `getTransitions(order,"ADMIN")` through the sheet. Replace the "moved into the factory queue" toast: the toast is now only "Order verified" + Undo; the *narrative* lives in the sheet's handoff line and the advancing rail. Verify success in-place: rail advances, feed grows a row, `playCompletion()`.

**Mobile.** Dealer-app conventions (16px gutter, detached cards 12px gaps, push header, sheets). Swipe-left on SUBMITTED = Verify, swipe-right = Reject (`useSwipeAction`) — both land in the confirm sheet, never commit-on-release. Rails `sm` on cards; `lg` in detail.

## Phase 4 — Factory portal

**Lanes (`FactoryOrdersPage.jsx`).** Headers Inbox/Shipment/Completed stay; chips inside use canonical labels ("In transit" in Shipment). Lane tabs get live count badges (pulse on change), Inbox gets arrivals treatment + chime + "N new" per 2.6. Cards: `OwnerChip` ("Waiting on you" in Inbox), `sm` rail, dealer name prominent, "Verified {rel-time} — by Admin" line.

**Modal (`FactoryOrderModal.jsx`) — stop ejecting the operator.** Delete the current `handleDispatched` choreography (`FactoryOrdersPage.jsx:251`: close modal + switch lane + toast). New flow: dispatch confirm runs inside `TransitionConfirmSheet` (driver details + PI controls injected as `children`; existing checklist stays as a pre-gate). On success the modal **stays open**: `lg` rail animates SUBMITTED-…-VERIFIED→**In transit**, `OrderEventFeed` (add it to the modal, above items) appends "Stock consumed"/"PI generated" rows, `playCompletion()`, and a ghost button appears: "Done — view Shipment lane". Choosing it (or closing) reveals the list where the card runs its `useOrderTransition` exit toward Shipment with the badge bump. Deliver: same pattern, lighter (no driver form). Reject: destructive ceremony with reason field.

**Mobile.** Lanes → `SegmentedControl` with counts; modal → full-height `MobileSheet`; identical flows.

## Phase 5 — Dispatcher portal

- Pending queue gets arrivals + "Needs you" default + OwnerChips; same primitives everywhere.
- **3-node rails** on all dealer-assigned orders (A4). Dispatch ceremony uses the dispatcher-mode consequences (says "marks the order Delivered"). After dispatch success, the card's chip reads **Delivered** — the operator sees the terminal truth immediately.
- "Confirm handover" (bookkeeping): quiet ghost button in detail only, its own one-line ceremony, no sound, no badge involvement.
- **Replenishment orders** (dispatcher-as-customer toward factory) use the standard 4-node factory rail. The two lists must be visually labeled: "Dealer orders you fulfill" vs "Your stock orders" — the two rail shapes never appear side-by-side unexplained.
- Amendments: `OrderEventFeed` renders "Amended by you · N items changed" linking the revision; the amend flow itself is unchanged.
- Archive remains a list scope; archived cards render their terminal rail + "Archived {date}" feed row; no transitions offered.

## Phase 6 — Backend additions (the complete list; nothing else)

1. **Conflict enrichment** (Phase 0.2).
2. **Revert endpoint.** Route: `POST /api/orders/:orderId/revert-verification`, auth + `requireRole("ADMIN")` (dispatcher revert of their own verify is OUT of scope — dispatcher verify has no reservation to unwind and less mis-click risk; keep the surface minimal). Service `revertOrderVerification({ orderId, adminUserId })`: atomic `findOneAndUpdate` filtered on `{ _id, status: VERIFIED, "fulfillment.sentToFactoryAt": null, "stockReservation.status": { $ne: "CONSUMED" } }`; effects — release reservation via the same helper the reject path uses, set `status: SUBMITTED`, clear `reviewedAt/ByRole/ByUserId` and review note, set new audit pair `unverifiedAt` / `unverifiedBy` (add both to the Order schema; render in `OrderEventFeed` as "Verification reverted by the Admin"). No-match → the standard `ORDER_STATE_CONFLICT` 409. Controller thin per house layering; RTK mutation `revertAdminOrderVerification` invalidating the same tags as verify.
3. UI wiring: Undo appears ① on the card for 5s post-verify (2.5s hold extends while hovered/focused), ② as "Undo verification" in the admin detail overflow while the guard conditions hold (poll data keeps it honest — hide the instant `sentToFactoryAt` appears). Undo success: reverse morph (chip back to Submitted, rail node un-fills with a 200ms fade — no celebratory animation), quiet toast "Verification undone", **no sound**.

---

## §V — Verification protocol (per-phase, mandatory)

- Every phase: `git diff --stat` — intended files only; a phase "done" with no diff did not happen. Expected files include: `store.js`, `meituApi.js`, the three services + `Order.model.js` + one route/controller (Phases 0/6), `src/shared/orderStateMachine.js` + `orderConflict.js`, `src/components/orderflow/*`, the six portal pages/modals named above.
- **Phase 0 drill (two windows):** same SUBMITTED order open as admin twice; verify in A; act in B → B's card must self-correct + truth toast, no "Action failed." anywhere in the repo afterward (`grep -r "Action failed"` returns nothing). Repeat once for factory dispatch.
- **Phase 1 unit sanity:** node-run a scratch script asserting `getTransitions`/`getRailNodes` for all 6 statuses × 2 modes × 3 roles matches the tables above (place in the session scratchpad, not the repo).
- **Full E2E, desktop AND 390×844:** ① factory-mode order: place (dealer) → admin verifies (morph, Undo visible; exercise Undo once, re-verify) → factory arrival (badge/highlight/chime; mute toggle works and persists) → dispatch ceremony (consequences + driver + PI; modal stays; rail advances; feed grows) → deliver → dealer sees Delivered. ② dispatcher-mode order end-to-end: 3-node rail, dispatch reads "Delivered", confirm-handover as bookkeeping. ③ one rejection: terminated rail + reason in feed + reservation released. ④ throttle check: two near-simultaneous arrivals produce one chime, two highlights.
- Backend dev server: `DOTENV_CONFIG_PATH=.env.staging` — **verify the running server's env before browser testing; never production.** `npm run check` (Server) + `npm run lint` (Frontend) clean. All new animations reviewed at 5× slow-mo; reduced-motion pass on every screen.

## §W — Acceptance: the hallway question, plus hard gates

Any order, any portal, any device, **without clicking**: current state · who it's waiting on · what happened last and by whom · what happens next. Hard gates: zero "Action failed." strings; no transition ends in silent disappearance; both fulfillment modes read correctly at a glance (no 4th phantom node on dispatcher orders, no "Delivered" on in-transit factory orders); all three portals share one status vocabulary; sounds fire only for arrivals (throttled, mutable) and completions; Undo exists for exactly one transition (admin verify) and irreversible ceremonies say so; dealer app behavior unchanged except the shared rail's internals.

## §X — Out-of-scope guardrails (violating these fails the pass)

No WebSockets/SSE; no new npm packages; no event-log collection or schema rewrites beyond the two audit fields; no renaming factory lanes; no dealer-app visual changes; no dark mode; no notification-center integration (separate workstream); no changes to PDF generation, Google Sheets mirroring, or email templates beyond consuming existing behavior in copy.
