import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import {
  buildCart,
  calculateCartTotals,
  getTierLabel,
  groupProductsByCode,
  formatMoney,
  formatPack,
} from "./pricing.js";
import NavBar from "../components/NavBar.jsx";

/* -----------------------------
   local draft storage helpers
----------------------------- */
const DRAFT_KEY = "meitu_dealer_order_draft_v1";

function sanitizeDraft(draft = {}) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => Number(value || 0) > 0),
  );
}

function loadDraft() {
  try {
    return sanitizeDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"));
  } catch {
    return {};
  }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizeDraft(draft)));
}

function categoryLabel(value) {
  if (!value) return "";
  if (value === "ALL") return "All Categories";
  return String(value).replaceAll("_", " ");
}

function getFamilySelectionCount(family, quantities) {
  return family.items.reduce((acc, item) => {
    const qty = Number(quantities[item.sku] || 0);
    return acc + (qty > 0 ? qty : 0);
  }, 0);
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function resolveFamilyDisplayImage(family) {
  const firstItem = family?.items?.[0] || null;

  const familyPrimary =
    family?.primaryImage ||
    getPrimaryImage(family?.familyImages || []) ||
    firstItem?.family?.primaryImage ||
    getPrimaryImage(firstItem?.family?.images || []) ||
    getPrimaryImage(firstItem?.familyImages || []);

  const productPrimary = getPrimaryImage(firstItem?.images || []);
  const displayImage = familyPrimary || productPrimary || null;

  return {
    url: displayImage?.url || "",
    alt:
      displayImage?.alt || family?.name || firstItem?.name || "Meitu product",
  };
}

const CATEGORY_OPTIONS = [
  "ALL",
  "EXTERIOR_PAINT",
  "INTERIOR_PAINT",
  "PRIMER",
  "DISTEMPER",
  "INTERIOR_EXTERIOR_PAINT",
  "CEILING_WHITE",
  "SPECIALTY",
  "ENAMEL",
  "ENAMEL_PRIMER",
  "LIQUID_GRANITE_GTONE_2D",
  "LIQUID_GRANITE_GTONE_3D",
  "REAL_STONE",
  "WALL_PUTTY",
  "GRANITE_FLOOR",
  "TOOLS_ACCESSORIES",
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name · A to Z" },
  { value: "name-desc", label: "Name · Z to A" },
];

/* -----------------------------
   UI primitives
----------------------------- */
function GlassPanel({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 30,
        background: "rgba(255,255,255,.78)",
        border: "1px solid rgba(255,255,255,.68)",
        boxShadow:
          "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,.82)",
        border: "1px solid rgba(0,0,0,.05)",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(0,0,0,.56)",
      }}
    >
      {children}
    </div>
  );
}

function HeroMetric({ label, value, accent = false }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 20,
        background: accent ? "rgba(196,0,0,.07)" : "rgba(248,248,250,.94)",
        border: accent
          ? "1px solid rgba(196,0,0,.12)"
          : "1px solid rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,.45)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: accent ? "#b42318" : "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange(String(value || "").trim());
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 54,
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,.08)",
        background: "rgba(255,255,255,.96)",
        padding: "0 7px 0 16px",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color: "rgba(0,0,0,.46)",
          flex: "0 0 auto",
        }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.8-3.8" />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          minWidth: 0,
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by name, SKU, code, category..."
          style={{
            width: "100%",
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontWeight: 900,
            color: "#0f172a",
            fontSize: 14,
          }}
        />
        {String(value || "").trim() ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            style={{
              flex: "0 0 auto",
              width: 28,
              height: 28,
              border: "none",
              borderRadius: 999,
              background: "rgba(15,23,42,.08)",
              color: "rgba(15,23,42,.58)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              fontWeight: 950,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
            }}
          >
            X
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        style={{
          flex: "0 0 auto",
          height: 40,
          border: "none",
          borderRadius: 999,
          padding: "0 18px",
          background: "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 950,
          letterSpacing: ".01em",
          cursor: "pointer",
          boxShadow: "0 12px 22px rgba(196,0,0,.18)",
        }}
      >
        Search
      </button>
    </form>
  );
}

function CategoryPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(196,0,0,.16)"
          : "1px solid rgba(0,0,0,.06)",
        background: active
          ? "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)"
          : "rgba(255,255,255,.94)",
        color: active ? "#fff" : "#111827",
        fontWeight: 900,
        fontSize: 12,
        cursor: "pointer",
        boxShadow: active
          ? "0 12px 30px rgba(196,0,0,.18)"
          : "inset 0 1px 0 rgba(255,255,255,.92)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function ProductArtwork({ category, imageUrl, imageAlt }) {
  return (
    <div
      style={{
        position: "relative",
        height: 220,
        borderRadius: 26,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(248,248,250,1) 0%, rgba(233,236,241,1) 100%)",
        border: "1px solid rgba(0,0,0,.04)",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={imageAlt}
          style={{
            width: "auto",
            height: "100%",
            objectFit: "cover",
            display: "block",
            margin: "0 auto",
          }}
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 24% 20%, rgba(255,255,255,.94), transparent 25%), radial-gradient(circle at 80% 78%, rgba(209,0,0,.08), transparent 24%), linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0))",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "54%",
              transform: "translate(-50%, -50%)",
              width: 118,
              height: 148,
              borderRadius: "30px 30px 24px 24px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(244,244,247,1) 100%)",
              border: "1px solid rgba(0,0,0,.05)",
              boxShadow:
                "0 22px 44px rgba(15,23,42,.12), inset 0 1px 0 rgba(255,255,255,.95)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                top: 14,
                width: 62,
                height: 14,
                borderRadius: 999,
                background: "rgba(0,0,0,.08)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 20,
                height: 46,
                borderRadius: 16,
                background: "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
                boxShadow: "0 10px 24px rgba(196,0,0,.22)",
              }}
            />
          </div>
        </>
      )}

      <div style={{ position: "absolute", left: 18, top: 18 }}>
        <SectionEyebrow>{categoryLabel(category)}</SectionEyebrow>
      </div>
    </div>
  );
}

function QtyStepper({ value, onChange }) {
  const qty = Number(value || 0);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: "rgba(255,255,255,.96)",
        border: "1px solid rgba(0,0,0,.08)",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.92)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, qty - 1))}
        style={{
          width: 42,
          height: 42,
          border: "none",
          background: "transparent",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        −
      </button>

      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
          )
        }
        style={{
          width: 56,
          height: 42,
          border: "none",
          outline: "none",
          background: "transparent",
          textAlign: "center",
          fontWeight: 950,
          color: "#0f172a",
          fontSize: 14,
        }}
      />

      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        style={{
          width: 42,
          height: 42,
          border: "none",
          background: "transparent",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

function VariantTile({ product, quantity, cartLine, onQtyChange }) {
  const qty = Number(quantity || 0);
  const selected = qty > 0;
  const tier = cartLine?.tier || null;
  const unitPrice = Number(cartLine?.unitPrice || 0);
  const subtotal = Number(cartLine?.lineTotal || 0);

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 20,
        background: selected ? "rgba(196,0,0,.06)" : "rgba(248,248,250,.9)",
        border: selected
          ? "1px solid rgba(196,0,0,.12)"
          : "1px solid rgba(0,0,0,.05)",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 950,
              fontSize: 15,
              color: "#0f172a",
            }}
          >
            {formatPack(product.pack)}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "rgba(0,0,0,.5)",
              fontWeight: 700,
            }}
          >
            {product.sku}
          </div>
        </div>

        <div
          style={{
            padding: "7px 10px",
            borderRadius: 999,
            background: selected ? "rgba(196,0,0,.1)" : "rgba(0,0,0,.05)",
            border: "1px solid rgba(0,0,0,.05)",
            fontSize: 11,
            fontWeight: 900,
            color: selected ? "#b42318" : "rgba(0,0,0,.62)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            whiteSpace: "nowrap",
          }}
        >
          {getTierLabel(tier, product.pricing)}
        </div>
      </div>

      <div
        className="dealer-variant-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,.46)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
              fontWeight: 900,
            }}
          >
            Unit Price
          </div>
          <div
            style={{
              marginTop: 4,
              fontWeight: 950,
              fontSize: 16,
              color: "#0f172a",
            }}
          >
            {formatMoney(unitPrice, product.currency)}
          </div>

          {selected ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 800,
                color: "#b42318",
              }}
            >
              Subtotal · {formatMoney(subtotal, product.currency)}
            </div>
          ) : null}
        </div>

        <QtyStepper
          value={quantity}
          onChange={(next) => onQtyChange(product.sku, next)}
        />
      </div>
    </div>
  );
}

function ProductCard({ family, quantities, cartBySku, onQtyChange }) {
  const selectionCount = getFamilySelectionCount(family, quantities);
  const artwork = resolveFamilyDisplayImage(family);

  return (
    <div
      style={{
        borderRadius: 32,
        overflow: "hidden",
        background: "rgba(255,255,255,.84)",
        border: "1px solid rgba(255,255,255,.72)",
        boxShadow:
          "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.86)",
      }}
    >
      <div style={{ padding: 20 }}>
        <ProductArtwork
          category={family.category}
          imageUrl={artwork.url}
          imageAlt={artwork.alt}
        />

        <div style={{ marginTop: 18 }}>
          <div
            className="dealer-product-title-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.15,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                color: "#0f172a",
              }}
            >
              {family.name}
            </div>

            {selectionCount > 0 ? (
              <div
                style={{
                  padding: "8px 11px",
                  borderRadius: 999,
                  background: "rgba(196,0,0,.08)",
                  color: "#b42318",
                  fontWeight: 950,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {selectionCount} selected
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(196,0,0,.08)",
                color: "#b42318",
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              {categoryLabel(family.category)}
            </span>

            <span
              style={{
                fontSize: 12,
                color: "rgba(0,0,0,.45)",
                fontWeight: 800,
              }}
            >
              {family.code}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "0 20px 20px",
          display: "grid",
          gap: 12,
        }}
      >
        {family.items
          .slice()
          .sort(
            (a, b) => Number(b?.pack?.size || 0) - Number(a?.pack?.size || 0),
          )
          .map((product) => (
            <VariantTile
              key={product.sku}
              product={product}
              quantity={quantities[product.sku] || ""}
              cartLine={cartBySku[product.sku] || null}
              onQtyChange={onQtyChange}
            />
          ))}
      </div>
    </div>
  );
}

function SelectedProductsSummary({ cart, onQtyChange }) {
  return (
    <GlassPanel style={{ padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(0,0,0,.45)",
            }}
          >
            Selected Products
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 18,
              fontWeight: 950,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            {cart.length} active line{cart.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div
        className="dealer-selected-summary-list"
        style={{
          marginTop: 14,
          display: "grid",
          gap: 10,
          maxHeight: "calc(100vh - 435px)",
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        {cart.length === 0 ? (
          <div
            style={{
              padding: 14,
              borderRadius: 18,
              background: "rgba(248,248,250,.92)",
              border: "1px solid rgba(0,0,0,.05)",
              color: "rgba(15,23,42,.58)",
              fontWeight: 800,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Products you add from the catalog will appear here for quick edits.
          </div>
        ) : (
          cart.map((line) => (
            <div
              key={line.sku}
              style={{
                padding: 12,
                borderRadius: 18,
                background: "rgba(248,248,250,.92)",
                border: "1px solid rgba(0,0,0,.05)",
                display: "grid",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.25,
                    fontWeight: 950,
                    color: "#0f172a",
                  }}
                >
                  {line.name}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    display: "flex",
                    gap: 7,
                    flexWrap: "wrap",
                    alignItems: "center",
                    color: "rgba(15,23,42,.52)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>{formatPack(line.pack)}</span>
                  <span>{getTierLabel(line.tier, line.pricing)}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <QtyStepper
                  value={line.quantity}
                  onChange={(next) => onQtyChange(line.sku, next)}
                />

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 950,
                      color: "#0f172a",
                    }}
                  >
                    {formatMoney(line.lineTotal, line.currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onQtyChange(line.sku, 0)}
                    style={{
                      marginTop: 4,
                      border: "none",
                      background: "transparent",
                      color: "#b42318",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}

function StickySummary({ draftMetrics, cart, onQtyChange, onReview }) {
  const totalQty = Number(draftMetrics.totalQty || 0);
  const lineCount = cart.length;

  return (
    <div
      className="dealer-catalog-right-rail"
      style={{
        display: "grid",
        gap: 14,
      }}
    >
      <GlassPanel style={{ padding: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "rgba(0,0,0,.45)",
          }}
        >
          Order Draft
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 28,
            fontWeight: 950,
            letterSpacing: "-0.04em",
            color: "#0f172a",
          }}
        >
          {totalQty} pack{totalQty === 1 ? "" : "s"}
        </div>

        <div
          style={{
            marginTop: 6,
            color: "rgba(0,0,0,.56)",
            fontWeight: 700,
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          {lineCount} active line{lineCount === 1 ? "" : "s"} in your draft.
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 18,
            background: "rgba(248,248,250,.92)",
            border: "1px solid rgba(0,0,0,.05)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "rgba(0,0,0,.45)",
            }}
          >
            Estimated Subtotal
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: 950,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            {formatMoney(draftMetrics.subtotal)}
          </div>
        </div>

        <button
          type="button"
          onClick={onReview}
          disabled={totalQty <= 0}
          style={{
            width: "100%",
            height: 48,
            marginTop: 14,
            borderRadius: 999,
            border: "1px solid rgba(196,0,0,.18)",
            background:
              totalQty > 0
                ? "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)"
                : "rgba(15,23,42,.08)",
            color: totalQty > 0 ? "#fff" : "rgba(15,23,42,.42)",
            fontWeight: 950,
            cursor: totalQty > 0 ? "pointer" : "not-allowed",
          }}
        >
          Review Order
        </button>
      </GlassPanel>

      <SelectedProductsSummary cart={cart} onQtyChange={onQtyChange} />
    </div>
  );
}

function LoadingGrid() {
  return (
    <div
      className="dealer-catalog-grid"
      style={{
        display: "grid",
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <GlassPanel key={i} style={{ padding: 20 }}>
          <div
            style={{
              height: 220,
              borderRadius: 24,
              background: "rgba(240,242,245,.95)",
            }}
          />
          <div
            style={{
              marginTop: 16,
              height: 24,
              width: "72%",
              borderRadius: 10,
              background: "rgba(240,242,245,.95)",
            }}
          />
          <div
            style={{
              marginTop: 10,
              height: 16,
              width: "40%",
              borderRadius: 10,
              background: "rgba(240,242,245,.95)",
            }}
          />
          <div
            style={{
              marginTop: 18,
              height: 94,
              borderRadius: 18,
              background: "rgba(240,242,245,.95)",
            }}
          />
          <div
            style={{
              marginTop: 12,
              height: 94,
              borderRadius: 18,
              background: "rgba(240,242,245,.95)",
            }}
          />
        </GlassPanel>
      ))}
    </div>
  );
}

function EmptyState({ onClear }) {
  return (
    <GlassPanel style={{ padding: 28 }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 950,
          letterSpacing: "-0.04em",
          color: "#0f172a",
        }}
      >
        No products found
      </div>
      <div
        style={{
          marginTop: 10,
          maxWidth: 620,
          color: "rgba(0,0,0,.58)",
          fontWeight: 700,
          lineHeight: 1.6,
        }}
      >
        Try broadening your search or clearing the current filters to explore
        more of the catalog.
      </div>

      <button
        type="button"
        onClick={onClear}
        style={{
          marginTop: 18,
          height: 48,
          padding: "0 18px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,.08)",
          background: "rgba(255,255,255,.94)",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Clear Filters
      </button>
    </GlassPanel>
  );
}

function FloatingDraftBar({ itemCount, subtotal, onReview, disabled = false }) {
  return (
    <button
      type="button"
      className="dealer-floating-draft"
      onClick={onReview}
      disabled={disabled}
      style={{
        position: "fixed",
        right: 28,
        bottom: 28,
        height: 62,
        padding: "0 20px",
        borderRadius: 999,
        border: "1px solid rgba(196,0,0,.18)",
        background: "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
        color: "#fff",
        fontWeight: 950,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.72 : 1,
        boxShadow: "0 22px 44px rgba(196,0,0,.26)",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        zIndex: 80,
        transition: "transform .18s ease, box-shadow .18s ease",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "rgba(255,255,255,.18)",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 950,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.16)",
        }}
      >
        {itemCount}
      </span>
      {disabled
        ? "Build Your Order"
        : `Review Order · ${formatMoney(subtotal)}`}
    </button>
  );
}

/* -----------------------------
   main
----------------------------- */
export default function DealerCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderSearchParam = searchParams.get("search") || "";

  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState(loadDraft());
  const [search, setSearch] = useState(orderSearchParam);
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState("name-asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    saveDraft(quantities);
  }, [quantities]);

  useEffect(() => {
    setSearch(orderSearchParam);
    if (orderSearchParam) setCategory("ALL");
  }, [orderSearchParam]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/api/products");
        const items = res?.data?.items || res?.data?.products || [];

        if (!alive) return;
        setProducts(items.filter((item) => item?.isActive !== false));
      } catch (e) {
        if (!alive) return;
        setError(
          e?.response?.data?.error ||
            e?.message ||
            "Failed to load product catalog.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((item) => {
      const categoryOk = category === "ALL" ? true : item.category === category;

      const queryOk = q
        ? [item.name, item.code, item.sku, item.category, item.pack?.label]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;

      return categoryOk && queryOk;
    });
  }, [products, category, search]);

  const productsMap = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
    }, {});
  }, [products]);

  const cart = useMemo(
    () => buildCart(productsMap, quantities),
    [productsMap, quantities],
  );

  const draftMetrics = useMemo(() => calculateCartTotals(cart), [cart]);

  const cartBySku = useMemo(() => {
    return cart.reduce((acc, line) => {
      acc[line.sku] = line;
      return acc;
    }, {});
  }, [cart]);

  const families = useMemo(() => {
    const grouped = groupProductsByCode(filteredProducts);

    if (sortBy === "name-desc") {
      return grouped
        .slice()
        .sort((a, b) => String(b.name).localeCompare(String(a.name)));
    }

    return grouped
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [filteredProducts, sortBy]);

  const handleQtyChange = (sku, nextValue) => {
    setQuantities((prev) => {
      const nextDraft = {
        ...prev,
        [sku]: nextValue,
      };
      return sanitizeDraft(nextDraft);
    });
  };

  const handleReviewDraft = () => {
    const cleanDraft = sanitizeDraft(quantities);
    saveDraft(cleanDraft);
    navigate("/dealer/cart");
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const cleanValue = String(value || "").trim();

        if (cleanValue) {
          next.set("search", value);
        } else {
          next.delete("search");
        }

        return next;
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("ALL");
    setSortBy("name-asc");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("search");
        return next;
      },
      { replace: true },
    );
  };

  return (
    <>
      <NavBar />
      <div
        style={{
          minHeight: "100vh",
          paddingTop: 0,
          paddingBottom: 86,
          background:
            "radial-gradient(900px 520px at 12% 0%, rgba(255,230,160,.46), transparent 52%), radial-gradient(900px 520px at 88% 10%, rgba(255,120,80,.18), transparent 45%), linear-gradient(180deg, #f5f6f8 0%, #edf1f5 100%)",
        }}
      >
        <div className="container" style={{ maxWidth: 1520 }}>
          <div
            className="dealer-catalog-shell-grid"
            style={{
              display: "grid",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <GlassPanel style={{ padding: 16 }}>
                <div style={{ display: "grid", gap: 16 }}>
                  <div
                    className="dealer-catalog-controls"
                    style={{
                      display: "grid",
                    }}
                  >
                    <SearchBox value={search} onChange={handleSearchChange} />

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        height: 54,
                        borderRadius: 18,
                        border: "1px solid rgba(0,0,0,.08)",
                        background: "rgba(255,255,255,.96)",
                        padding: "0 14px",
                        fontWeight: 900,
                        color: "#0f172a",
                        outline: "none",
                      }}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={clearFilters}
                      style={{
                        height: 54,
                        borderRadius: 18,
                        border: "1px solid rgba(0,0,0,.08)",
                        background: "rgba(255,255,255,.96)",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      overflowX: "auto",
                      paddingBottom: 4,
                    }}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <CategoryPill
                        key={option}
                        active={category === option}
                        onClick={() => setCategory(option)}
                      >
                        {categoryLabel(option)}
                      </CategoryPill>
                    ))}
                  </div>
                </div>

                {error ? (
                  <div
                    style={{
                      marginTop: 18,
                      padding: "14px 16px",
                      borderRadius: 16,
                      background: "rgba(180,35,24,.08)",
                      border: "1px solid rgba(180,35,24,.16)",
                      color: "#b42318",
                      fontWeight: 800,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      style={{
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(180,35,24,.16)",
                        background: "rgba(255,255,255,.9)",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
              </GlassPanel>

              {loading ? (
                <LoadingGrid />
              ) : families.length === 0 ? (
                <EmptyState onClear={clearFilters} />
              ) : (
                <div
                  className="dealer-catalog-grid"
                  style={{
                    display: "grid",
                  }}
                >
                  {families.map((family) => (
                    <ProductCard
                      key={family.code}
                      family={family}
                      quantities={quantities}
                      cartBySku={cartBySku}
                      onQtyChange={handleQtyChange}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="dealer-catalog-right-cell d-none d-xl-block">
              <StickySummary
                draftMetrics={draftMetrics}
                cart={cart}
                onQtyChange={handleQtyChange}
                onReview={handleReviewDraft}
              />
            </div>
          </div>
        </div>

        <FloatingDraftBar
          itemCount={draftMetrics.totalQty}
          subtotal={draftMetrics.subtotal}
          disabled={draftMetrics.totalQty <= 0}
          onReview={handleReviewDraft}
        />
      </div>

      <style>{`
        .dealer-catalog-shell-grid{
          grid-template-columns:minmax(0,1fr) 360px;
          gap:22px;
        }

        .dealer-catalog-right-cell{
          min-height:1px;
        }

        .dealer-catalog-right-rail{
          position:fixed;
          top:86px;
          right:max(24px, calc((100vw - 1520px) / 2 + 12px));
          width:360px;
          max-height:calc(100vh - 110px);
          overflow:hidden;
          z-index:90;
        }

        .dealer-selected-summary-list{
          scrollbar-width:thin;
        }

        @media (min-width:1181px){
          .dealer-floating-draft{
            display:none!important;
          }
        }

        .dealer-catalog-controls{
          grid-template-columns:minmax(260px,1fr) 220px 150px;
          gap:12px;
        }

        .dealer-catalog-grid{
          grid-template-columns:repeat(auto-fill, minmax(min(100%, 320px), 1fr));
          gap:18px;
        }

        @media (max-width:1180px){
          .dealer-catalog-shell-grid{
            grid-template-columns:1fr;
          }

          .dealer-catalog-right-rail{
            position:static;
            width:auto;
            max-height:none;
          }
        }

        @media (max-width:760px){
          .dealer-catalog-shell-grid{
            gap:16px;
          }

          .dealer-catalog-controls{
            grid-template-columns:1fr;
            gap:10px;
          }

          .dealer-catalog-grid{
            grid-template-columns:1fr;
            gap:14px;
          }

          .dealer-floating-draft{
            left:14px!important;
            right:14px!important;
            bottom:14px!important;
            width:auto!important;
            justify-content:center!important;
          }
        }

        @media (max-width:520px){
          .dealer-catalog-grid > *{
            border-radius:24px!important;
          }

          .dealer-product-title-row,
          .dealer-variant-row{
            display:grid!important;
            grid-template-columns:1fr!important;
          }

          .dealer-variant-row{
            justify-items:start;
          }
        }
      `}</style>
    </>
  );
}
