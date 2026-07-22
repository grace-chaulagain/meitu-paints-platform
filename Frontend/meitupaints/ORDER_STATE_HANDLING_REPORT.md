# Multi-State Order Handling — Diagnosis & Redesign

Audit of the Admin, Factory, and Dispatcher order interfaces. Written for a decision-maker: plain language first, implementation spec at the end.

---

## Part 1 — The diagnosis

### The one-sentence problem

**The UI treats an order's state as a place it sits, not as a journey it travels.** Tabs are containers; acting on an order makes it vanish from the container you're looking at. So the system renders its single most important event — a state change — as a *disappearance*, which people read as loss, not progress.

Layman's version: right now the software behaves like a filing cabinet. You take a folder out of the "Pending" drawer, and it silently reappears in the "Dispatched" drawer. Nobody watched it move. What you want is a delivery tracker: the same parcel, visibly advancing, with a record of every hand it passed through.

### Six concrete defects found in the code

| # | Defect | Evidence |
|---|---|---|
| 1 | **The object you're working on disappears at the moment of success.** The modal closes and the card leaves the current list. | `FactoryOrderModal` → `handleDispatched()` in `FactoryOrdersPage.jsx:251` closes the modal, switches the lane, and shows a toast. The card the operator was holding is gone from view. |
| 2 | **No per-order lifecycle timeline exists in any of the three portals.** Operators cannot see who did what, when, or what happens next. | The only thing named "timeline" in admin (`AdminOrdersPage.jsx:1635`) is a day-grouped *list of orders*, not an order's own history. `StatusRail` exists only in the dealer app. |
| 3 | **The data for that timeline already exists and is being discarded.** | `Order.model.js` stores `reviewedAt`, `fulfillment.sentToFactoryAt/By`, `outForDeliveryAt/By`, `deliveredAt/By`, `rejectedAt/By`, `stockReservation.reservedAt/By`, `consumedAt/By`, `closedAt/By`, `amendedAt`. A complete audit trail, almost entirely unrendered. |
| 4 | **State change is announced by a toast — a message that erases itself.** A permanent fact is communicated by a temporary object. | `setToast({ title: "Order verified", description: "…moved into the factory queue" })` in all three portals. Five seconds later there is no trace that anything happened. |
| 5 | **Three portals, three vocabularies for the same six states.** Admin says "moved into the factory queue", Factory calls its lanes Inbox / Shipment / Completed, Dispatcher says "ready to dispatch". | Operators on a phone call cannot align on what state an order is in. Worse, `DISPATCHED` means *two different real-world things* depending on `fulfillmentMode` (factory: still in transit; dispatcher: finished) and no UI distinguishes them. |
| 6 | **Transition rules are scattered and re-derived per page.** | `canDispatch`/`canDeliver`/`canReject` in `FactoryOrderModal.jsx:109-111`, `canComplete` in `DispatcherOrderDetailPage.jsx:117`, separate logic again in admin. No single rulebook — rules will drift apart as portals grow. |

### The deeper miss: nobody knows who holds the ball

Every mature operations tool answers one question above all others: **whose move is it right now?**

- **Stripe** puts "Action required" on the payment itself — the object tells you it needs you.
- **Linear** pairs status with an assignee; work is always *someone's*.
- **Uber Eats Merchant** shows a countdown on orders awaiting *your* acceptance — you are never unsure whether the restaurant or the courier is the blocker.

Meitu's orders pass between Dealer → Admin/Dispatcher → Factory → back out. At every moment exactly one party owns the next action. **The UI never says so.** That single missing concept is why operators "aren't getting concrete sense" out of the interface — they can see the state, but not the obligation, and obligation is what people actually work from.

---

## Part 2 — The solution

Five changes, in dependency order. The first is architectural and unblocks the rest.

### Solution 1 — One rulebook: a shared order state machine

Create `src/shared/orderStateMachine.js` as the single source of truth for every portal (including the dealer app):

- The six real states (`SUBMITTED → VERIFIED → DISPATCHED → COMPLETED`, plus `REJECTED`/`CANCELLED`) — no invented stages.
- For each state: **canonical label** (one name used in all four portals), **owner** (who must act next), **allowed transitions per role**, **side effects** each transition fires, and **fulfillment-mode-aware wording** (`DISPATCHED` reads "In transit to dealer" for factory orders, "Delivered — order closed" for dispatcher-fulfilled ones).
- Every page derives its buttons, filters, and labels from this module. Delete the ad-hoc `canDispatch`/`canComplete` booleans.

*Layman's version: one rulebook that every screen reads from, so the factory and the admin are never describing the same order with different words.*

### Solution 2 — Objects transform; they never vanish

Replace disappearance with visible transformation. On a successful transition:

1. The card **stays exactly where it is** for ~2.5 seconds and changes *in place*: the status chip crossfades to the new state, the progress rail advances one node with a draw-on animation, and a thin "Verified · just now" line appears.
2. Only then, if the current filter no longer includes it, does the card animate **out in the direction of its destination tab** — and that tab's count badge bumps with a pulse. Direction carries meaning: the operator's eye follows the object to where it went. (This is Linear's exact pattern for status changes.)
3. The card carries an **Undo** affordance during those seconds for reversible transitions — on the object, not only in a toast.

*Layman's version: instead of the folder silently teleporting to another drawer, you watch the stamp land on it, then watch it slide into the correct drawer, and the drawer's label ticks up by one.*

### Solution 3 — A lifecycle rail on every order, everywhere

Promote the dealer app's `StatusRail` into `src/components/mobile/` (or a shared UI folder) and render it in Admin, Factory, and Dispatcher order detail views — and in a compact form on cards.

Each node shows **who** and **when**, read from the timestamp fields already in the database: "Verified · Admin Grace · Jul 21, 2:14 PM". Off-ramps (`REJECTED`/`CANCELLED`) render as a terminated branch with the reason, not as a missing node.

Beneath the rail, an **event feed** for that order — the same fields rendered as plain sentences, including stock effects ("Reserved 42 units", "Stock consumed at dispatch") and document events ("Proforma generated"). **This requires no backend work.** The data is already stored.

### Solution 4 — Make ownership the primary lens

Add an **owner chip** to every order card and detail header, derived from the state machine:

- `Waiting on you` — azure, the only azure on the card
- `With Factory` / `With Dispatcher` / `With Admin` — graphite
- `Done` — quiet ink

Then change the default view of every order list from raw status tabs to **"Needs you"** first, with status segments secondary. Factory's Inbox additionally separates **"New since you last looked (3)"** — arrival time and sender visible — so a handoff is an event you notice, not a row that quietly appeared.

*Layman's version: every order wears a badge saying whose turn it is, and each portal opens on "here's your turn" rather than "here's everything".*

### Solution 5 — Transitions become a short, honest ceremony

Every state-changing action opens a confirm sheet with exactly three parts:

1. **The move**: `Verified → Dispatched`, shown as the rail with the next node highlighted.
2. **The consequences**, stated plainly and specifically — "Reserved stock will be consumed. This cannot be undone." / "The dealer will be emailed." The existing `Confirm Dispatch — consumes reserved stock` button label proves the instinct is already there; formalize it everywhere.
3. **The handoff**: "Next: Factory prepares shipment." So the operator always knows who they just handed the ball to.

Irreversible transitions say so and offer no Undo. Reversible ones offer Undo for 5 seconds. Never a bare "Are you sure?".

---

## Part 3 — Visual grammar (Apple / Stripe / Linear / Uber Eats)

- **One state color language across all portals**, from the state machine: fog/ink for neutral states, azure for "needs you", green-tinted for terminal success, `--color-caution` for off-ramps. Never color alone — always chip + word, for accessibility and for printouts.
- **Motion encodes direction**: forward transitions advance rightward/downward; rejections exit on a different axis. Rail nodes fill sequentially (150ms apart). All motion follows the animation constitution in `DEALER_MOBILE_DESIGN_PROMPT_V2.md` §3 — load the `emil-design-eng` skill before implementing.
- **Cards over tables** in every list; the four `<table>` renders in `AdminOrdersPage`, `AdminDealerOrdersPage`, `AdminDispatcherOrdersPage`, and `InsightsPrimitives` become card lists on mobile.
- **Counts are live**: tab and lane badges animate on change — that bump is what tells a distracted operator something moved.

---

## Part 4 — Implementation order

1. `orderStateMachine.js` + replace all scattered `can*` booleans. *(No visual change; unblocks everything.)*
2. Shared `StatusRail` + per-order event feed in all three portals' detail views.
3. Owner chips + "Needs you" default views + Factory "new since last look".
4. In-place transformation, directional exit, count-badge pulse, on-card Undo.
5. Confirm-sheet ceremony (move → consequences → handoff) for every transition.

**Verification for each step**: `git diff --stat` must show the intended files changed; exercise a full order lifecycle end-to-end across all three portals (dealer places → admin verifies → factory dispatches → factory delivers, plus a dispatcher-fulfilled order and one rejection) at 390×844 and desktop; `npm run lint` clean.

**Acceptance test — the hallway question.** Pick any order in any portal. Without clicking, an operator must be able to answer: *What state is it in? Who is it waiting on? What happened last, and who did it? What happens next?* Today none of the three portals can answer more than the first. All four is the bar.
