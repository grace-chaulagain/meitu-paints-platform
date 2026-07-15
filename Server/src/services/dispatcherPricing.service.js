import Dispatcher from "../models/Dispatcher.model.js";
import Product from "../models/Product.model.js";
import DispatcherProductPrice from "../models/DispatcherProductPrice.model.js";
import ApiError from "../utils/apiError.js";

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

  const filter = { isActive: { $ne: false } };

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
    .select("_id")
    .lean();
  const validProductIdSet = new Set(validProducts.map((product) => String(product._id)));

  const operations = [];

  for (const item of items) {
    if (!item.productId || !validProductIdSet.has(String(item.productId))) continue;
    // Blank price = "leave this SKU unpriced for now", not an error - admins
    // rarely price the entire catalog for a dispatcher in one sitting.
    if (item.price === "" || item.price === null || item.price === undefined) continue;

    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, `Invalid price for product ${item.productId}`);
    }

    const netPrice = item.netPrice === "" || item.netPrice === null || item.netPrice === undefined ? 0 : Number(item.netPrice);
    if (!Number.isFinite(netPrice) || netPrice < 0) {
      throw new ApiError(400, `Invalid net price for product ${item.productId}`);
    }

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
