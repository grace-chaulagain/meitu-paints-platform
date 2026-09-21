// Scheme-order unit tests. Pure logic only - nothing here opens a database
// connection, so `npm test` is safe to run anywhere, including against a
// checkout configured with production credentials.
//
// Run: npm test          (from Server/)
import test from "node:test";
import assert from "node:assert/strict";

import {
  createSchemeOrderBodySchema,
  updateSchemeOrderBodySchema,
} from "../../src/validations/schemeOrder.validation.js";
import { describeSchemeChanges } from "../../src/services/schemeOrder.service.js";
import { buildRecipientOrderUrl, buildFactoryOrderUrl } from "../../src/utils/orderLinks.js";
import { saleItemSchema } from "../../src/validations/sale.validation.js";

const OID = "6aaf86299833ec91031d8be7";
const validCreate = {
  recipientType: "DEALER",
  recipientId: OID,
  label: "Dashain 2083 Volume Scheme",
  note: "Deliver to the main gate.",
  items: [{ productId: OID, quantity: 3 }],
};

test("create payload: a well-formed scheme is accepted", () => {
  const result = createSchemeOrderBodySchema.safeParse(validCreate);
  assert.equal(result.success, true);
  assert.equal(result.data.items[0].quantity, 3);
});

test("create payload: recipient is required and must be a dealer or a dispatcher", () => {
  for (const patch of [{ recipientId: "" }, { recipientType: "FACTORY" }, { recipientType: "PAINTER" }]) {
    const result = createSchemeOrderBodySchema.safeParse({ ...validCreate, ...patch });
    assert.equal(result.success, false, `expected ${JSON.stringify(patch)} to be rejected`);
  }
});

test("create payload: a scheme must grant at least one product, in whole units", () => {
  assert.equal(createSchemeOrderBodySchema.safeParse({ ...validCreate, items: [] }).success, false);
  for (const quantity of [0, -2, 1.5]) {
    const result = createSchemeOrderBodySchema.safeParse({ ...validCreate, items: [{ productId: OID, quantity }] });
    assert.equal(result.success, false, `expected quantity ${quantity} to be rejected`);
  }
});

test("create payload: the admin note is capped at 500 characters", () => {
  assert.equal(createSchemeOrderBodySchema.safeParse({ ...validCreate, note: "x".repeat(500) }).success, true);
  assert.equal(createSchemeOrderBodySchema.safeParse({ ...validCreate, note: "x".repeat(501) }).success, false);
});

test("create payload: unknown fields are refused rather than silently dropped", () => {
  // Guards against a caller trying to set price, status or recipient routing.
  const result = createSchemeOrderBodySchema.safeParse({ ...validCreate, status: "COMPLETED" });
  assert.equal(result.success, false);
});

test("update payload: each field can be sent on its own, but not an empty body", () => {
  assert.equal(updateSchemeOrderBodySchema.safeParse({ label: "Renamed" }).success, true);
  assert.equal(updateSchemeOrderBodySchema.safeParse({ note: "" }).success, true);
  assert.equal(updateSchemeOrderBodySchema.safeParse({ items: [{ productId: OID, quantity: 2 }] }).success, true);
  assert.equal(updateSchemeOrderBodySchema.safeParse({}).success, false);
});

// --- Activity history -------------------------------------------------------
// Every edit made after a scheme is verified has to leave a readable trace.

const line = (productId, name, packLabel, quantity) => ({ productId, name, packLabel, quantity });
const basket = (...items) => ({ label: "S", note: "", items });

test("change summary: a quantity change names the product and both numbers", () => {
  const summary = describeSchemeChanges(
    basket(line("a", "Glossy Enamel - Po Red", "1L", 2)),
    basket(line("a", "Glossy Enamel - Po Red", "1L", 5)),
  );
  assert.equal(summary, "Glossy Enamel - Po Red (1L) 2 → 5");
});

test("change summary: renames and note edits are described in words", () => {
  const before = { label: "Old", note: "a", items: [line("a", "P", "1L", 1)] };
  const after = { label: "New", note: "b", items: [line("a", "P", "1L", 1)] };
  assert.equal(describeSchemeChanges(before, after), 'name "Old" → "New"; note edited');

  const noteRemoved = describeSchemeChanges(before, { ...before, note: "" });
  assert.equal(noteRemoved, "note removed");

  const noteAdded = describeSchemeChanges({ ...before, note: "" }, before);
  assert.equal(noteAdded, "note added");
});

test("change summary: products added and removed are both reported", () => {
  const summary = describeSchemeChanges(
    basket(line("a", "Gold", "1L", 3)),
    basket(line("b", "Red", "4L", 2)),
  );
  assert.match(summary, /added Red \(4L\) × 2/);
  assert.match(summary, /removed Gold \(1L\)/);
});

test("change summary: saving without changing anything records nothing", () => {
  const same = basket(line("a", "P", "1L", 1));
  assert.equal(describeSchemeChanges(same, same), "");
});

test("change summary: long edits are truncated with a count of the rest", () => {
  const before = { label: "A", note: "", items: [line("a", "P1", "1L", 1), line("b", "P2", "1L", 1), line("c", "P3", "1L", 1)] };
  const after = { label: "B", note: "n", items: [line("a", "P1", "1L", 2), line("b", "P2", "1L", 2), line("c", "P3", "1L", 2)] };
  const summary = describeSchemeChanges(before, after);
  assert.match(summary, /\+1 more$/);
  assert.equal(summary.split(";").length, 5); // 4 changes + the "+N more" tail
});

// --- Portal deep links ------------------------------------------------------
// These land in emails, so a wrong one is a dead link in someone's inbox.

test("tracking link: a dealer's scheme points at the dealer portal", () => {
  const url = buildRecipientOrderUrl({ _id: OID, dealerId: "d1" });
  assert.ok(url.endsWith(`/dealer/orders/${OID}`), url);
});

test("tracking link: a dispatcher's own scheme points at the dispatcher portal", () => {
  const url = buildRecipientOrderUrl({ _id: OID, dispatcherCustomerId: "x1" });
  assert.ok(url.endsWith(`/dispatcher/orders/${OID}`), url);
});

test("tracking link: a dispatcher-served dealer still tracks it as a dealer", () => {
  // The factory ships these directly, but the order belongs to the dealer.
  const url = buildRecipientOrderUrl({ _id: OID, dealerId: "d1", dispatcherCustomerId: "x1" });
  assert.ok(url.endsWith(`/dealer/orders/${OID}`), url);
});

test("tracking link: the factory link opens that exact order", () => {
  const url = buildFactoryOrderUrl({ _id: OID });
  assert.ok(url.endsWith(`/factory/dashboard/orders?orderId=${OID}`), url);
});

test("tracking link: a missing id degrades to a list rather than a broken url", () => {
  assert.ok(!buildRecipientOrderUrl({}).includes("undefined"));
  assert.ok(buildFactoryOrderUrl({}).endsWith("/factory/dashboard/orders"));
});

// --- Dealer sales -----------------------------------------------------------

test("sale quantity: units are whole numbers, never fractions", () => {
  assert.equal(saleItemSchema.safeParse({ productId: OID, quantity: 3 }).success, true);
  for (const quantity of [2.5, 0.5, 0, -1]) {
    assert.equal(
      saleItemSchema.safeParse({ productId: OID, quantity }).success,
      false,
      `expected quantity ${quantity} to be rejected`,
    );
  }
});
