import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import {
  buildCart,
  calculateCartTotals,
  formatMoney,
  formatPack,
  getTierLabel,
  groupProductsByCode,
} from "../../dealer/pricing.js";

function GlassCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function money(value, currency = "NPR") {
  return formatMoney(value, currency);
}

function SectionHeader({ title, subtitle, action = null }) {
  return (
    <div className="draft-header">
      <div>
        <div className="draft-title">{title}</div>
        {subtitle ? <div className="draft-subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

function SearchInput({ value, onChange }) {
  return (
    <div className="draft-search">
      <span>⌕</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search product, SKU, category..."
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")}>
          ×
        </button>
      ) : null}
    </div>
  );
}

function QtyStepper({ value, onChange }) {
  const qty = Number(value || 0);

  return (
    <div className="draft-stepper">
      <button type="button" onClick={() => onChange(Math.max(0, qty - 1))}>
        -
      </button>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? ""
              : Math.max(0, Number(event.target.value)),
          )
        }
      />
      <button type="button" onClick={() => onChange(qty + 1)}>
        +
      </button>
    </div>
  );
}

function ProductVariantRow({ product, cartLine, quantity, onQtyChange }) {
  const unitPrice = Number(cartLine?.unitPrice || 0);
  const lineTotal = Number(cartLine?.lineTotal || 0);
  const selected = Number(quantity || 0) > 0;

  return (
    <div className={`draft-variant-row ${selected ? "selected" : ""}`}>
      <div className="draft-variant-main">
        <strong>{formatPack(product.pack) || product.sku}</strong>
        <span>{product.sku}</span>
      </div>
      <div className="draft-variant-price">
        <span>{getTierLabel(cartLine?.tier, product.pricing)}</span>
        <strong>{money(unitPrice, product.currency)}</strong>
      </div>
      <QtyStepper
        value={quantity}
        onChange={(next) => onQtyChange(product.sku, next)}
      />
      <div className="draft-line-total">
        {selected ? money(lineTotal, product.currency) : "—"}
      </div>
    </div>
  );
}

function ProductFamilyCard({ family, quantities, cartBySku, onQtyChange }) {
  return (
    <GlassCard>
      <div className="draft-family-head">
        <div>
          <div className="draft-family-name">{family.name}</div>
          <div className="draft-family-meta">
            {family.category || "Uncategorized"} · {family.code}
          </div>
        </div>
        <span>{family.items.length} variants</span>
      </div>
      <div className="draft-variants">
        {family.items
          .slice()
          .sort(
            (a, b) => Number(b?.pack?.size || 0) - Number(a?.pack?.size || 0),
          )
          .map((product) => (
            <ProductVariantRow
              key={product.sku}
              product={product}
              quantity={quantities[product.sku] || ""}
              cartLine={cartBySku[product.sku] || null}
              onQtyChange={onQtyChange}
            />
          ))}
      </div>
    </GlassCard>
  );
}

function SummaryPanel({ cart, totals, currency, onClear }) {
  return (
    <div className="draft-summary">
      <GlassCard style={{ padding: 18 }}>
        <div className="draft-summary-kicker">Draft Total</div>
        <div className="draft-summary-total">{money(totals.subtotal, currency)}</div>
        <div className="draft-summary-grid">
          <div>
            <span>Selected SKUs</span>
            <strong>{cart.length}</strong>
          </div>
          <div>
            <span>Total Quantity</span>
            <strong>{Number(totals.totalQty || 0).toLocaleString()}</strong>
          </div>
        </div>
        <button
          type="button"
          className="draft-clear"
          onClick={onClear}
          disabled={!cart.length}
        >
          Clear Draft
        </button>
      </GlassCard>

      <GlassCard>
        <div className="draft-summary-list-head">Selected lines</div>
        <div className="draft-summary-lines">
          {cart.length ? (
            cart.map((line) => (
              <div className="draft-summary-line" key={line.sku}>
                <div>
                  <strong>{line.name}</strong>
                  <span>
                    {formatPack(line.pack)} · {line.quantity} x{" "}
                    {money(line.unitPrice, line.currency)}
                  </span>
                </div>
                <b>{money(line.lineTotal, line.currency)}</b>
              </div>
            ))
          ) : (
            <div className="draft-summary-empty">
              Select product quantities to calculate a draft total.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default function DraftOrderUtilityPage({
  roleLabel = "Workspace",
  title = "Draft Order",
  subtitle = "Select product quantities to calculate a draft total. This utility does not submit an order.",
}) {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      } catch (err) {
        if (!alive) return;
        setError(
          err?.response?.data?.error ||
            err?.message ||
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

  const categories = useMemo(() => {
    return [
      "ALL",
      ...Array.from(
        new Set(products.map((product) => product.category).filter(Boolean)),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((product) => {
      const categoryOk = category === "ALL" || product.category === category;
      const queryOk = q
        ? [product.name, product.sku, product.code, product.category]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        : true;
      return categoryOk && queryOk;
    });
  }, [category, products, search]);

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
  const totals = useMemo(() => calculateCartTotals(cart), [cart]);
  const cartBySku = useMemo(() => {
    return cart.reduce((acc, line) => {
      acc[line.sku] = line;
      return acc;
    }, {});
  }, [cart]);
  const families = useMemo(
    () => groupProductsByCode(filteredProducts),
    [filteredProducts],
  );
  const currency = cart[0]?.currency || products[0]?.currency || "NPR";

  function handleQtyChange(sku, nextValue) {
    setQuantities((prev) => {
      const next = { ...prev, [sku]: nextValue };
      if (!Number(nextValue || 0)) delete next[sku];
      return next;
    });
  }

  return (
    <div className="draft-page">
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title={title}
          subtitle={subtitle}
          action={<span className="draft-role">{roleLabel}</span>}
        />
        <div className="draft-controls">
          <SearchInput value={search} onChange={setSearch} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item === "ALL" ? "All categories" : item}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="draft-error">{error}</div> : null}
      </GlassCard>

      <div className="draft-layout">
        <div className="draft-list">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <GlassCard key={index} style={{ padding: 18 }}>
                <div className="draft-skeleton" />
              </GlassCard>
            ))
          ) : families.length ? (
            families.map((family) => (
              <ProductFamilyCard
                key={family.code}
                family={family}
                quantities={quantities}
                cartBySku={cartBySku}
                onQtyChange={handleQtyChange}
              />
            ))
          ) : (
            <GlassCard style={{ padding: 24 }}>
              <div className="draft-empty-title">No products found</div>
              <div className="draft-empty-copy">
                Try clearing the search or selecting a broader category.
              </div>
            </GlassCard>
          )}
        </div>

        <SummaryPanel
          cart={cart}
          totals={totals}
          currency={currency}
          onClear={() => setQuantities({})}
        />
      </div>

      <style>{`
        .draft-page,
        .draft-page *{
          box-sizing:border-box;
          min-width:0;
        }
        .draft-page{
          display:grid;
          gap:18px;
        }
        .draft-header{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:16px;
          flex-wrap:wrap;
        }
        .draft-title{
          font-size:28px;
          line-height:1.1;
          font-weight:950;
          letter-spacing:-.03em;
          color:#0f172a;
        }
        .draft-subtitle{
          margin-top:7px;
          max-width:760px;
          font-size:14px;
          line-height:1.65;
          font-weight:700;
          color:rgba(15,23,42,.58);
        }
        .draft-role{
          height:34px;
          padding:0 12px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          border:1px solid rgba(180,35,24,.12);
          background:rgba(180,35,24,.07);
          color:#b42318;
          font-size:11px;
          font-weight:950;
          letter-spacing:.08em;
          text-transform:uppercase;
        }
        .draft-controls{
          margin-top:16px;
          display:grid;
          grid-template-columns:minmax(0,1fr) 220px;
          gap:12px;
          align-items:center;
        }
        .draft-search{
          min-height:46px;
          border-radius:14px;
          border:1px solid rgba(15,23,42,.08);
          background:#fff;
          display:flex;
          align-items:center;
          gap:10px;
          padding:0 12px;
        }
        .draft-search span{
          font-weight:900;
          color:rgba(15,23,42,.42);
        }
        .draft-search input{
          flex:1;
          border:0;
          outline:0;
          background:transparent;
          font-size:14px;
          font-weight:750;
          color:#0f172a;
        }
        .draft-search button{
          width:28px;
          height:28px;
          border-radius:999px;
          border:1px solid rgba(15,23,42,.08);
          background:rgba(248,250,252,.96);
          color:rgba(15,23,42,.58);
          font-size:18px;
          font-weight:900;
          cursor:pointer;
        }
        .draft-controls select{
          min-height:46px;
          border-radius:14px;
          border:1px solid rgba(15,23,42,.08);
          background:#fff;
          padding:0 12px;
          color:#0f172a;
          font-weight:850;
          outline:0;
        }
        .draft-error{
          margin-top:14px;
          padding:13px 15px;
          border-radius:14px;
          background:rgba(180,35,24,.08);
          border:1px solid rgba(180,35,24,.14);
          color:#b42318;
          font-weight:800;
        }
        .draft-layout{
          display:grid;
          grid-template-columns:minmax(0,1fr) 340px;
          gap:18px;
          align-items:start;
        }
        .draft-list{
          display:grid;
          gap:14px;
        }
        .draft-summary{
          position:sticky;
          top:18px;
          display:grid;
          gap:14px;
        }
        .draft-family-head{
          display:flex;
          justify-content:space-between;
          gap:14px;
          align-items:flex-start;
          padding:16px 18px;
          border-bottom:1px solid rgba(15,23,42,.07);
        }
        .draft-family-name{
          font-size:17px;
          line-height:1.25;
          font-weight:950;
          color:#0f172a;
        }
        .draft-family-meta{
          margin-top:5px;
          font-size:12px;
          font-weight:750;
          color:rgba(15,23,42,.52);
        }
        .draft-family-head > span{
          white-space:nowrap;
          padding:6px 9px;
          border-radius:999px;
          background:rgba(15,23,42,.05);
          color:rgba(15,23,42,.55);
          font-size:11px;
          font-weight:950;
        }
        .draft-variants{
          display:grid;
        }
        .draft-variant-row{
          display:grid;
          grid-template-columns:minmax(0,1fr) 150px 136px 132px;
          gap:12px;
          align-items:center;
          padding:13px 18px;
          border-top:1px solid rgba(15,23,42,.06);
        }
        .draft-variant-row:first-child{
          border-top:0;
        }
        .draft-variant-row.selected{
          background:rgba(180,35,24,.035);
        }
        .draft-variant-main,
        .draft-variant-price{
          display:grid;
          gap:4px;
        }
        .draft-variant-main strong,
        .draft-variant-price strong{
          color:#0f172a;
          font-size:13px;
          font-weight:950;
        }
        .draft-variant-main span,
        .draft-variant-price span{
          color:rgba(15,23,42,.52);
          font-size:11px;
          font-weight:800;
        }
        .draft-stepper{
          height:38px;
          border-radius:999px;
          border:1px solid rgba(15,23,42,.08);
          background:#fff;
          overflow:hidden;
          display:grid;
          grid-template-columns:38px minmax(0,1fr) 38px;
        }
        .draft-stepper button,
        .draft-stepper input{
          border:0;
          background:transparent;
          text-align:center;
          color:#0f172a;
          font-weight:950;
          outline:0;
        }
        .draft-stepper button{
          cursor:pointer;
          font-size:16px;
        }
        .draft-line-total{
          justify-self:end;
          color:#0f172a;
          font-size:13px;
          font-weight:950;
        }
        .draft-summary-kicker,
        .draft-summary-list-head{
          font-size:11px;
          font-weight:950;
          letter-spacing:.1em;
          text-transform:uppercase;
          color:rgba(15,23,42,.46);
        }
        .draft-summary-total{
          margin-top:8px;
          font-size:30px;
          line-height:1.05;
          font-weight:950;
          letter-spacing:-.04em;
          color:#b42318;
        }
        .draft-summary-grid{
          margin-top:16px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        }
        .draft-summary-grid div{
          padding:11px;
          border-radius:12px;
          background:rgba(248,250,252,.95);
          border:1px solid rgba(15,23,42,.06);
          display:grid;
          gap:4px;
        }
        .draft-summary-grid span{
          font-size:10px;
          font-weight:950;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(15,23,42,.45);
        }
        .draft-summary-grid strong{
          font-size:18px;
          font-weight:950;
          color:#0f172a;
        }
        .draft-clear{
          margin-top:14px;
          width:100%;
          min-height:42px;
          border-radius:14px;
          border:1px solid rgba(180,35,24,.14);
          background:rgba(180,35,24,.06);
          color:#b42318;
          font-weight:950;
          cursor:pointer;
        }
        .draft-clear:disabled{
          opacity:.45;
          cursor:not-allowed;
        }
        .draft-summary-list-head{
          padding:15px 16px;
          border-bottom:1px solid rgba(15,23,42,.07);
        }
        .draft-summary-lines{
          display:grid;
        }
        .draft-summary-line{
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:10px;
          padding:13px 16px;
          border-top:1px solid rgba(15,23,42,.06);
        }
        .draft-summary-line:first-child{
          border-top:0;
        }
        .draft-summary-line div{
          display:grid;
          gap:4px;
        }
        .draft-summary-line strong{
          color:#0f172a;
          font-size:12px;
          font-weight:950;
        }
        .draft-summary-line span{
          color:rgba(15,23,42,.52);
          font-size:11px;
          font-weight:750;
        }
        .draft-summary-line b{
          color:#0f172a;
          font-size:12px;
          font-weight:950;
          white-space:nowrap;
        }
        .draft-summary-empty{
          padding:16px;
          color:rgba(15,23,42,.56);
          font-size:13px;
          line-height:1.6;
          font-weight:750;
        }
        .draft-empty-title{
          font-size:20px;
          font-weight:950;
          color:#0f172a;
        }
        .draft-empty-copy{
          margin-top:7px;
          color:rgba(15,23,42,.58);
          font-size:13px;
          line-height:1.6;
          font-weight:750;
        }
        .draft-skeleton{
          height:92px;
          border-radius:16px;
          background:linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9));
        }
        @media (max-width:1180px){
          .draft-layout{
            grid-template-columns:1fr;
          }
          .draft-summary{
            position:static;
          }
        }
        @media (max-width:780px){
          .draft-controls{
            grid-template-columns:1fr;
          }
          .draft-variant-row{
            grid-template-columns:1fr 1fr;
          }
          .draft-line-total{
            justify-self:start;
          }
        }
        @media (max-width:520px){
          .draft-title{ font-size:24px; }
          .draft-family-head{
            display:grid;
          }
          .draft-family-head > span{
            width:max-content;
          }
          .draft-variant-row{
            grid-template-columns:1fr;
            padding:14px;
          }
          .draft-summary-grid{
            grid-template-columns:1fr;
          }
          .draft-summary-line{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </div>
  );
}
