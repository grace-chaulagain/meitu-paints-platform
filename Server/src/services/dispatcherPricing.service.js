import Dispatcher from "../models/Dispatcher.model.js";
import Product from "../models/Product.model.js";
import DispatcherProductPrice from "../models/DispatcherProductPrice.model.js";
import ApiError from "../utils/apiError.js";

// Mirrors Frontend/meitupaints/src/factory/factoryHelpers.js's Proforma
// Invoice tax scheme exactly (same VAT rate, same per-category excise
// multipliers, same code-prefix-first classification) - net price here is
// the same "back the tax out of the tax-inclusive price" figure shown on
// a PI, just computed at pricing-entry time instead of PDF-generation
// time. Kept in sync manually since one lives client-side (PDF rendering)
// and the other server-side (this pricing save) - if the scheme ever
// changes, update both.
const VAT_RATE = 0.13;
const EXCISE_MULTIPLIER_BY_BUCKET = {
  WALL_PUTTY: 1.05,
  OTHER: 1.07,
  TOOLS_ACCESSORIES: 1,
};

function excisemultiplierForProduct(product) {
  const code = product?.code || "";
  if (code.startsWith("WALLPUTTY-")) return EXCISE_MULTIPLIER_BY_BUCKET.WALL_PUTTY;
  if (code.startsWith("COLORANT-") || code.startsWith("TOOLS-")) {
    return EXCISE_MULTIPLIER_BY_BUCKET.TOOLS_ACCESSORIES;
  }
  if (product?.category === "TOOLS_AND_ACCESSORIES" || product?.category === "COLORANTS") {
    return EXCISE_MULTIPLIER_BY_BUCKET.TOOLS_ACCESSORIES;
  }
  return EXCISE_MULTIPLIER_BY_BUCKET.OTHER;
}

// The dispatcher-facing "Price" is the tax-inclusive figure (same
// convention as Order.items[].unitPrice); Net Price is always derived
// from it, never entered directly, so it can't drift out of sync with
// the actual tax scheme.
function computeNetPrice(price, product) {
  const multiplier = excisemultiplierForProduct(product);
  return Math.round(Number(price || 0) / (1 + VAT_RATE) / multiplier);
}

export async function getDispatcherPricingSummary() {
  const [dispatchers, counts, totalActiveProducts] = await Promise.all([
    Dispatcher.find({ status: "VERIFIED" })
      .select("name companyName email isActive")
      .sort({ companyName: 1, name: 1 })
      .lean(),
    DispatcherProductPrice.aggregate([{ $group: { _id: "$dispatcherId", count: { $sum: 1 } } }]),
    Product.countDocuments({ isActive: { $ne: false } }),
  ]);

  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

  return {
    items: dispatchers.map((dispatcher) => ({
      ...dispatcher,
      pricedCount: countMap.get(String(dispatcher._id)) || 0,
      totalProducts: totalActiveProducts,
    })),
  };
}

export async function listDispatcherPricing({ dispatcherId } = {}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId).lean();
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

  const [products, priceRows] = await Promise.all([
    Product.find({ isActive: { $ne: false } })
      .select("name sku code category pack")
      .sort({ category: 1, name: 1 })
      .lean(),
    DispatcherProductPrice.find({ dispatcherId }).lean(),
  ]);

  const priceMap = new Map(priceRows.map((row) => [String(row.productId), row]));

  const items = products.map((product) => {
    const priceRow = priceMap.get(String(product._id));
    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      code: product.code || "",
      category: product.category || "",
      packLabel: product.pack?.label || "",
      price: priceRow ? priceRow.price : null,
      netPrice: priceRow ? priceRow.netPrice : null,
      currency: priceRow?.currency || "NPR",
      updatedAt: priceRow?.updatedAt || null,
    };
  });

  return {
    dispatcher: {
      _id: dispatcher._id,
      name: dispatcher.name,
      companyName: dispatcher.companyName,
      email: dispatcher.email,
    },
    items,
  };
}

export async function listMyReplenishmentCatalog({ dispatcherId, q } = {}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  // sellable:{$ne:false} keeps a kit's own component products out of the
  // dispatcher's own replenishment catalog - see product.service.js's
  // listActiveProducts for the same gate on the dealer/public catalog.
  const filter = { isActive: { $ne: false }, sellable: { $ne: false } };

  if (q && q.trim()) {
    const query = q.trim();
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { sku: { $regex: query, $options: "i" } },
      { code: { $regex: query, $options: "i" } },
    ];
  }

  const [products, priceRows] = await Promise.all([
    Product.find(filter)
      .select("name sku code category pack")
      .sort({ category: 1, name: 1 })
      .lean(),
    DispatcherProductPrice.find({ dispatcherId }).lean(),
  ]);

  const priceMap = new Map(priceRows.map((row) => [String(row.productId), row]));

  const items = [];
  for (const product of products) {
    const priceRow = priceMap.get(String(product._id));
    if (!priceRow || priceRow.price === null || priceRow.price === undefined) continue;

    items.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      code: product.code || "",
      category: product.category || "",
      packLabel: product.pack?.label || "",
      price: priceRow.price,
      netPrice: priceRow.netPrice ?? 0,
      currency: priceRow.currency || "NPR",
    });
  }

  return { items };
}

export async function upsertDispatcherPricing({ dispatcherId, items = [], adminUser } = {}) {
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const dispatcher = await Dispatcher.findById(dispatcherId);
  if (!dispatcher) throw new ApiError(404, "Dispatcher not found");

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "No pricing rows to save");
  }

  const productIds = items.map((item) => item.productId).filter(Boolean);
  const validProducts = await Product.find({ _id: { $in: productIds } })
    .select("_id code category")
    .lean();
  const productById = new Map(validProducts.map((product) => [String(product._id), product]));

  const operations = [];

  for (const item of items) {
    const product = item.productId ? productById.get(String(item.productId)) : null;
    if (!product) continue;
    // Blank price = "leave this SKU unpriced for now", not an error - admins
    // rarely price the entire catalog for a dispatcher in one sitting.
    if (item.price === "" || item.price === null || item.price === undefined) continue;

    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, `Invalid price for product ${item.productId}`);
    }

    // Net Price is always system-computed from Price, never accepted from
    // the client - see computeNetPrice's comment.
    const netPrice = computeNetPrice(price, product);

    operations.push({
      updateOne: {
        filter: { dispatcherId, productId: item.productId },
        update: {
          $set: {
            price,
            netPrice,
            updatedBy: adminUser?.id || adminUser?._id || null,
          },
        },
        upsert: true,
      },
    });
  }

  if (operations.length === 0) {
    throw new ApiError(400, "No valid pricing rows to save");
  }

  await DispatcherProductPrice.bulkWrite(operations);

  return { ok: true, updated: operations.length };
}
