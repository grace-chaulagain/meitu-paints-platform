# Multi-State Order Handling — Implementation Prompt (Admin · Factory · Dispatcher)

> Hand this file to the implementing agent as-is. It implements the redesign diagnosed in `ORDER_STATE_HANDLING_REPORT.md` (read it first — Parts 1, 2, and 5 are the rationale for everything below). Decisions already made by the owner, not open for re-litigation:
>
> 1. **Scope**: frontend + *minimal* backend additions (conflict-error enrichment, one revert endpoint). No WebSockets, no event-log collection.
> 2. **Devices**: desktop AND mobile get full treatment for all three portals. Desktop is where order handling mostly happens; mobile must match the dealer app's quality bar.
> 3. **Step 0 included**: freshness + conflict UX ship first, in this same pass.
> 4. **Arrivals**: badge pulse + highlighted card entry + a *subtle* arrival chime (mutable).
>
> **Invoke the `emil-design-eng` skill before writing any animation code.** The animation constitution (`DEALER_MOBILE_DESIGN_PROMPT_V2.md` §3) is binding: the four easing tokens, transform/opacity only, transitions over keyframes, exits faster than entrances, reduced-motion fallbacks, 5×-slow-mo verification.
>
> Implement the phases **in order** — each is a prerequisite for the honesty of the next.

Ground truth to hold at all times: `ORDER_STATUS` is exactly `SUBMITTED → VERIFIED → DISPATCHED → COMPLETED` + `REJECTED`/`CANCELLED`. Never invent stages. `DISPATCHED` means two different things by `dealerSnapshot.fulfillmentMode`: factory-fulfilled = *in transit, not yet received*; dispatcher-fulfilled = *terminal, delivered*. Backend transition guards in `order.service.js` / `factory.service.js` / `dispatcher.service.js` are correct and atomic — do not weaken them; the frontend must *mirror* them, never bypass.

---

## Phase 0 — Freshness & truth (the prerequisite engineering)

### 0.1 Freshness

- `src/redux/store.js` currently has **no `setupListeners`** — add it (`setupListeners(store.dispatch)`).
- Enable `refetchOnFocus: true, refetchOnReconnect: true` on the API slice (`meituApi.js` `createApi` options).
- Add `pollingInterval` to the order-facing queries only: admin orders list, factory orders list, dispatcher orders list — **20_000ms**; any *open* order detail query — **15_000ms** (pass via hook options at the call sites so list pages not on screen don't poll). Do not poll catalogs, products, or settings.
- Refetch indicator: the existing quiet pattern only — a 2px azure hairline under the page header while `isFetching && !isLoading`. Never a spinner, never dimming.

### 0.2 Conflict UX — "Action failed." is banned

**Backend (minimal, surgical)**: every status-precondition guard that currently throws a bare ApiError (e.g. `factory.service.js:351/431/567`, `order.service.js:265/323`, dispatcher equivalents) must throw with structured details:

```js
throw new ApiError(409, "Order state has changed", {
  code: "ORDER_STATE_CONFLICT",
  currentStatus: order.status,
  reviewedByRole: order.reviewedByRole || null,
  changedAt: order.reviewedAt || order.fulfillment?.sentToFactoryAt || null,
});
```

(`ApiError` already carries `details`/`code` — this is additive, no response-shape change.)

**Frontend**: one shared handler, `src/shared/orderConflict.js` → `handleTransitionError(err, { refetchOrder })`. On `ORDER_STATE_CONFLICT`: ① immediately refetch that order (and invalidate the list tag), ② render the truth instead of an error — the order card/detail visibly *corrects itself* (chip crossfades to the real status), and a toast states plainly: **"Already verified by the Admin, 2 min ago"** / "This order was dispatched while you were viewing it." Built from `details` when present, from the refetched order otherwise. All three portals' transition handlers route through this. The generic fallback message for non-conflict errors becomes "Couldn't complete — check connection and try again", never "Action failed."

---

## Phase 1 — One rulebook: `src/shared/orderStateMachine.js`

A dependency-free module consumed by all four portals (dealer included, later). Exports:

```js
ORDER_FLOW = {
  SUBMITTED:  { label: "Submitted",  owner: (o) => reviewerParty(o),          // "ADMIN" | "DISPATCHER"
                next: { verify: "VERIFIED", reject: "REJECTED" } },
  VERIFIED:   { label: "Verified",   owner: (o) => isDispatcherFulfilled(o) ? "DISPATCHER" : "FACTORY",
                next: { dispatch: "DISPATCHED", reject: "REJECTED" } },
  DISPATCHED: { label: (o) => isDispatcherFulfilled(o) ? "Delivered" : "In transit",
                owner: (o) => isDispatcherFulfilled(o) ? null : "FACTORY",
                next: (o) => isDispatcherFulfilled(o) ? {} : { complete: "COMPLETED" } },
  COMPLETED:  { label: "Delivered", owner: null, next: {} },
  REJECTED:   { label: "Rejected",  owner: null, next: {}, offRamp: true },
  CANCELLED:  { label: "Cancelled", owner: null, next: {}, offRamp: true },
}
```

Plus helpers every page must use instead of local booleans:

- `getTransitions(order, role)` → the actions this role may take now (mirrors the backend guards exactly — verify only from SUBMITTED, dispatch only from VERIFIED, complete only from DISPATCHED-factory, reject per backend rules).
- `getOwner(order)` → who must act next; `isWaitingOn(order, role)` → drives "Needs you" filters and owner chips.
- `getStatusLabel(order)` / `getStatusTone(order)` → the **single** canonical vocabulary. Factory lane names (Inbox/Shipment/Completed) may remain as *lane headers*, but every chip/toast/timeline node uses these canonical labels so all portals say the same words.
- `getConsequences(order, action)` → the plain-language side-effect lines for confirm sheets: dispatch (factory) → "Reserved stock will be consumed — this cannot be undone." + "The dealer will be emailed."; dispatch (dispatcher) → "Your regional stock will be deducted." + "This closes the order — dispatcher orders have no separate delivery confirmation."; verify → "Stock will be reserved for this order." etc. Derive from what the services actually do — read them before writing these strings.

**Delete** `canDispatch`/`canDeliver`/`canReject` in `FactoryOrderModal.jsx:109-111`, `canComplete` in `DispatcherOrderDetailPage.jsx:117`, and admin's equivalents — all replaced by `getTransitions`.

---

## Phase 2 — Shared components (build once, in `src/components/orderflow/`)

1. **`OrderStatusRail`** — promote the dealer `StatusRail` and extend: each node reads its timestamp + actor from the order (`createdAt` → `reviewedAt`/`reviewedByRole` → `fulfillment.sentToFactoryAt`/`outForDeliveryAt` → `deliveredAt`), rendering "Verified · Admin · Jul 21, 2:14 PM" beneath the node (desktop) or on tap (mobile). Off-ramps render as a terminated branch in `--color-caution` with the reason — never a missing node. Sizes: `sm` (cards, nodes only), `lg` (detail views, with metadata). 4 nodes for factory-fulfilled, 3 for dispatcher-fulfilled (Submitted → Verified → Delivered).
2. **`OrderEventFeed`** — the order's own history as plain sentences, newest first, built *entirely* from existing fields: review, amendment (`amendedAt` + revision link), stock reservation/consumption (`stockReservation.*`), proforma generation (`fulfillment.proformaGeneratedAt/By`), dispatch with driver details, delivery, rejection with reason, closure (`closedAt/By`), archival. Each row: 12px relative time graphite, sentence 14px ink, actor role in 600 weight. No backend needed.
3. **`OwnerChip`** — from `getOwner`: `Waiting on you` (azure — the only azure on a card), `With Factory` / `With Admin` / `With Dispatcher` (fog/ink), `Done` (quiet ink), off-ramps (caution-tinted). Rendered on every order card and every detail header in all three portals.
4. **`TransitionConfirmSheet`** — the ceremony (report Solution 5): ① the move rendered as the rail with the target node pulsing, ② `getConsequences` lines as a checklist with warning glyphs for irreversibles, ③ the handoff line ("Next: Factory prepares shipment"), ④ confirm `PrimaryButton` with in-flight spinner + cancel. Desktop: centered modal (existing `ModalOverlay`); mobile: drag-dismissable `MobileSheet`. The factory dispatch variant embeds the existing driver-details fields; its current honest button copy ("consumes reserved stock") moves into the consequences list.
5. **Transform-in-place engine** — a `useOrderTransition` hook orchestrating the report's Solution 2: on success ① the card stays and morphs (chip crossfade 200ms, rail node draw-on 300ms, "Verified · just now" line fades in), ② holds ~2.5s (with **Undo** shown when Phase 6's revert applies), ③ if the active filter no longer contains it, exits with `translateX/Y` toward its destination tab/lane (300ms, `--ease-in-out-strong`) while that tab's count badge bumps (scale pulse 1→1.15→1). Reduced motion: instant swap + badge color tick only.
6. **Arrival system** — `useQueueArrivals(queryResult, laneKey)`: diffs incoming poll results against the previous set; new orders slide in at top with an azure-at-6% highlight that fades over 2s, the lane/tab badge pulses, and `playArrival()` fires — a new export in `completionFeedback.js`: two soft ascending sine notes *distinct from and quieter than* `playCompletion()` (~0.08 gain), throttled to once per 10s no matter how many arrive, silenced by a persistent mute toggle (small speaker icon in the portal header, localStorage `meitu_ops_sound_muted`). "New since you last looked" (Factory): per-lane `lastSeenAt` in localStorage keyed by user id; cards newer than it show a small azure "New" dot until the lane has been visible 5s.

---

## Phase 3 — Admin portal (`AdminOrdersPage.jsx`, `AdminOrderDetailPage.jsx`)

**Desktop list**: above the existing status filters, add the primary lens — a **"Needs you (N)"** view (default when N > 0): orders where `isWaitingOn(order, "ADMIN")`. Every row/card gains `OwnerChip` + compact rail (`sm`). The day-grouped timeline layout survives, but each entry becomes a card carrying chip + rail. The two `<table>` renders go card-list on mobile (≤768px) — zero tables on phones.

**Detail**: hero (order number eyebrow, dealer name, total) → **`OrderStatusRail` lg** → payment/proforma chips → `OrderEventFeed` in its own card → items → sticky action area rendering *only* `getTransitions(order, "ADMIN")` via `TransitionConfirmSheet`. Verify success: rail advances in place + `playCompletion()`; the "moved into the factory queue" toast copy is replaced by the handoff line from the ceremony.

**Mobile**: dealer-app conventions (16px gutter, detached cards 12px gaps, push header, sheet ceremonies). Swipe-left = Verify, swipe-right = Reject on SUBMITTED cards (via `useSwipeAction`), both landing in the confirm sheet — never commit-on-release.

## Phase 4 — Factory portal (`FactoryOrdersPage.jsx`, `FactoryOrderModal.jsx`)

- Lanes keep their names as headers, but every chip inside uses canonical labels; each lane header shows a live count badge (pulses on change) and the Inbox shows "3 new" with per-card New dots (Phase 2.6). Arrivals chime here — this is the screen that lives on a wall.
- Cards: `OwnerChip` ("Waiting on you" for the whole Inbox, "In transit" for Shipment), compact rail, dealer name prominent, `sm` timestamps ("Verified 25 min ago — by Admin").
- **The modal stops teleporting the operator** (`handleDispatched` at `FactoryOrdersPage.jsx:251`): after Confirm Dispatch, the modal does *not* close — the rail inside it advances with the draw-on animation, the consequences ("stock consumed", "PI attached") append to the visible `OrderEventFeed`, `playCompletion()` fires, and a "Done — view Shipment lane" ghost button appears. Closing then reveals the card mid-exit toward the Shipment lane with the badge bump. The operator *watches* the state change instead of being ejected from it.
- Modal top gets the `lg` rail; the dispatch checklist and driver form remain, feeding the `TransitionConfirmSheet` variant.
- Mobile: the modal becomes a full-height `MobileSheet`; lanes become a `SegmentedControl` with counts.

## Phase 5 — Dispatcher portal (`DispatcherOrdersPage.jsx`, `DispatcherOrderDetailPage.jsx`, history/archive)

- Same primitives everywhere: OwnerChip, rails, ceremony sheets, arrivals on the pending queue.
- **3-node rail** (Submitted → Verified → Delivered) — dispatcher-fulfilled orders must *never* show a 4th pending node implying an unconfirmed delivery. The dispatch ceremony's consequences say explicitly: "This closes the order."
- The dispatcher's own **replenishment orders** (they play the dealer role toward the factory) use the 4-node rail — label the two lists clearly ("Dealer orders you fulfill" vs "Your stock orders") so the two rails never sit unexplained side by side.
- Amend flow: amendments render in `OrderEventFeed` ("Amended by you · 3 items changed" linking to the revision) — today amendment history is invisible post-hoc.
- Archive stays a filter/list (`orders/archive` endpoint) — archiving is not a status; its card shows the terminal rail state it archived in.

## Phase 6 — Minimal backend additions (the only server work allowed)

1. **Conflict enrichment** (Phase 0.2) — required.
2. **One revert endpoint**: `POST /api/orders/:orderId/revert-verification` (admin + the reviewing dispatcher only). Guard: status is `VERIFIED` **and** `fulfillment.sentToFactoryAt` is null **and** stock not consumed. Effect: release the stock reservation (mirror the existing release path used by reject), return status to `SUBMITTED`, clear review fields, set an `unverifiedAt/By` audit pair (add to the model). Atomic compare-and-set like every other transition. This powers the 5s **Undo** after Verify — the only transition that gets Undo. Dispatch/complete/reject remain irreversible in UI and say so in their ceremonies.
3. Nothing else. No event-log collection (the feed reads existing fields), no push channel (polling covers it), no schema rewrites.

---

## Verification protocol (mandatory)

- Per phase: `git diff --stat` must show the intended files; a phase claimed done with no diff did not happen.
- **Two-window conflict drill**: open the same SUBMITTED order as admin in two browser windows; verify in one; in the other, attempt verify → must see the card self-correct + the "Already verified…" truth toast. Repeat for factory dispatch.
- **Full lifecycle E2E**, desktop and 390×844: dealer places → admin verifies (watch in-place morph + Undo window + revert once) → factory sees arrival (badge, highlight, chime; mute toggle works) → dispatch ceremony (consequences listed, modal stays, rail advances) → deliver → dealer sees COMPLETED. Then a dispatcher-fulfilled order end-to-end (3-node rail, "closes the order" wording), and one rejection (off-ramp branch rendering).
- Backend dev server must run with `DOTENV_CONFIG_PATH=.env.staging` — **verify the running server's env before any browser testing; never point at production.**
- `npm run check` (Server), `npm run lint` (Frontend). All animations pass 5× slow-mo inspection; reduced-motion verified.

## Acceptance — the hallway question

Pick any order in any portal, any device. Without clicking, an operator can answer: **What state? Waiting on whom? What happened last, and who did it? What happens next?** Then: no "Action failed." exists anywhere; no state change ever ends in a silent disappearance; both fulfillment modes read correctly at a glance; all three portals use identical status vocabulary; sound fires only for arrivals (throttled, mutable) and completions.
