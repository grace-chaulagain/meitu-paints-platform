import DispatcherProductStock from "../models/DispatcherProductStock.model.js";
import Product from "../models/Product.model.js";
import ApiError from "../utils/apiError.js";
import { withStockSession } from "./stock.service.js";

function actorId(actorUser) {
  return actorUser?.id || actorUser?._id || actorUser?.sub || null;
}

function clean(value = "") {
  return String(value || "").trim();
}

function itemProductId(item) {
  return item?.productId || null;
}

function itemQuantity(item) {
  const quantity = Number(
    item?.quantity ?? item?.qty ?? item?.deductedQuantity ?? 0,
  );
  return Number.isFinite(quantity) ? quantity : 0;
}

// Increments a dispatcher's on-hand stock for each line item, upserting
// the ledger row the first time this dispatcher holds a given SKU. This
// is the credit side of the Factory dispatching a dispatcher's own
// replenishment order.
export async function creditDispatcherStock({
  dispatcherId,
  items = [],
  actorUser,
  session = null,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId },
        {
          $inc: { currentQuantity: quantity },
          $set: {
            lastUpdatedAt: new Date(),
            lastUpdatedBy: actorId(actorUser),
          },
        },
        { upsert: true, new: true, session: txnSession, setDefaultsOnInsert: true },
      );
    }
  });
}

// Decrements a dispatcher's on-hand stock for each line item, atomically
// guarded so two concurrent dispatches from the same dispatcher can't
// oversell their own regional stock - the same guarded-filter pattern
// stock.service.js uses for central Product.stock.
export async function consumeDispatcherStockForOrder({
  dispatcherId,
  items = [],
  actorUser,
  session = null,
} = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");

  return withStockSession(session, async (txnSession) => {
    for (const item of items) {
      const productId = itemProductId(item);
      const quantity = itemQuantity(item);
      if (!productId || quantity <= 0) continue;

      const updated = await DispatcherProductStock.findOneAndUpdate(
        { dispatcherId, productId, currentQuantity: { $gte: quantity } },
        {
          $inc: { currentQuantity: -quantity },
          $set: {
            lastUpdatedAt: new Date(),
            lastUpdatedBy: actorId(actorUser),
          },
        },
        { new: true, session: txnSession },
      );

      if (!updated) {
        const [existing, product] = await Promise.all([
          DispatcherProductStock.findOne({ dispatcherId, productId }).session(txnSession),
          Product.findById(productId).select("name sku").session(txnSession),
        ]);
        const available = Number(existing?.currentQuantity || 0);
        throw new ApiError(
          400,
          `Insufficient dispatcher stock for ${product?.name || product?.sku || clean(item?.name) || "item"}. Available ${available}, requested ${quantity}.`,
        );
      }
    }
  });
}

export async function listDispatcherStock({ dispatcherId, page = 1, limit = 100 } = {}) {
  if (!dispatcherId) throw new ApiError(400, "dispatcherId is required");
  const pageNumber = Math.max(1, Number(page || 1));
  const limitNumber = Math.min(200, Math.max(1, Number(limit || 100)));

  const [rows, total] = await Promise.all([
    DispatcherProductStock.find({ dispatcherId })
      .sort({ lastUpdatedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({ path: "productId", select: "name sku code category pack images pricing stock.lowStockThreshold" })
      .lean(),
    DispatcherProductStock.countDocuments({ dispatcherId }),
  ]);

  const items = rows
    .filter((row) => row.productId)
    .map((row) => {
      const currentQuantity = Number(row.currentQuantity || 0);
      // No per-purchase unit cost is tracked for dispatcher stock (unlike
      // DealerProductStock.lastKnownUnitCost, sourced from real
      // InventoryMovement history) - the current catalog price is used as
      // a live estimate instead, just for this "Value" display column.
      const unitPrice = Number(row.productId.pricing?.tiers?.[0]?.pricePerPack || 0);
      return {
        productId: row.productId._id,
        sku: row.productId.sku || "",
        name: row.productId.name || "",
        code: row.productId.code || "",
        category: row.productId.category || "",
        pack: row.productId.pack || {},
        currentQuantity,
        inventoryValue: unitPrice > 0 ? currentQuantity * unitPrice : null,
        lowStockThreshold: Number(row.productId.stock?.lowStockThreshold || 0),
        lastUpdatedAt: row.lastUpdatedAt || null,
      };
    });

  return {
    items,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.max(1, Math.ceil(total / limitNumber)),
    },
  };
}
