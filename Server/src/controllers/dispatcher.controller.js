import {
  createDispatcherApplication,
  getAllDispatchers,
  getPendingDispatchers,
  getDispatcherById,
  listVerifiedDispatchers,
  getMyDispatcherProfile,
  listMyAssignedDealers,
  getMyAssignedDealerById,
  listMyOrders,
  getMyOrderById,
  getMyOrderStockCheck,
  verifyAssignedOrder,
  rejectAssignedOrder,
  amendAssignedOrder,
  listMyOrderArchive,
  createDispatcherReplenishmentOrder,
  getMyDispatcherStock,
  getMyDispatcherStockHistory,
  dispatchAssignedOrder,
  completeAssignedOrder,
  listMyReplenishmentOrders,
  getMyReplenishmentOrderById,
  getMyReplenishmentCatalog,
} from "../services/dispatcher.service.js";
import { deleteDispatcher as scheduleDispatcherDeletion } from "../services/admin.service.js";

/* ---------------------------------------
   Public Dispatcher Application
---------------------------------------- */

export async function createDispatcherApplicationController(req, res, next) {
  try {
    const dispatcher = await createDispatcherApplication(req.body || {});

    return res.status(201).json({
      ok: true,
      message: "Dispatcher application submitted successfully.",
      item: dispatcher,
    });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------------------
   Admin Dispatcher Management
---------------------------------------- */

export async function listDispatchersController(req, res, next) {
  try {
    const items = await getAllDispatchers(req.query || {});

    return res.status(200).json({
      ok: true,
      items,
    });
  } catch (error) {
    next(error);
  }
}

export async function listPendingDispatchersController(req, res, next) {
  try {
    const items = await getPendingDispatchers();

    return res.status(200).json({
      ok: true,
      items,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDispatcherByIdController(req, res, next) {
  try {
    const { dispatcherId } = req.params;
    const item = await getDispatcherById(dispatcherId);

    return res.status(200).json({
      ok: true,
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function listVerifiedDispatchersController(req, res, next) {
  try {
    const items = await listVerifiedDispatchers();

    return res.status(200).json({
      ok: true,
      items,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDispatcherController(req, res, next) {
  try {
    const { dispatcherId } = req.params;
    const item = await scheduleDispatcherDeletion({
      dispatcherId,
      confirmation: req.body?.confirmation || "",
      reason: req.body?.reason || "",
      adminUser: req.user,
    });

    return res.status(200).json({
      ok: true,
      message: "Dispatcher deletion scheduled.",
      item,
    });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------------------
   Dispatcher Self Workspace
---------------------------------------- */

export async function getMyDispatcherProfileController(req, res, next) {
  try {
    const item = await getMyDispatcherProfile({
      user: req.user,
    });

    return res.status(200).json({
      ok: true,
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyAssignedDealersController(req, res, next) {
  try {
    const { q, status, page, limit } = req.query || {};

    const out = await listMyAssignedDealers({
      user: req.user,
      q,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAssignedDealerByIdController(req, res, next) {
  try {
    const { dealerId } = req.params;

    const item = await getMyAssignedDealerById({
      user: req.user,
      dealerId,
    });

    return res.status(200).json({ ok: true, item });
  } catch (error) {
    next(error);
  }
}

export async function listMyOrdersController(req, res, next) {
  try {
    const { status, q, page, limit, archive, dealerId } = req.query || {};

    const out = await listMyOrders({
      user: req.user,
      status,
      q,
      page,
      limit,
      archive,
      dealerId,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrderByIdController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await getMyOrderById({
      user: req.user,
      orderId,
    });

    return res.status(200).json({
      ok: true,
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrderStockCheckController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await getMyOrderStockCheck({
      user: req.user,
      orderId,
    });

    return res.status(200).json({
      ok: true,
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyAssignedOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await verifyAssignedOrder({
      user: req.user,
      orderId,
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      message: "Order verified successfully.",
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectAssignedOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await rejectAssignedOrder({
      user: req.user,
      orderId,
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      message: "Order rejected successfully.",
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function amendAssignedOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await amendAssignedOrder({
      user: req.user,
      orderId,
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      message: "Order amended successfully.",
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyOrderArchiveController(req, res, next) {
  try {
    const { q, page, limit } = req.query || {};

    const out = await listMyOrderArchive({
      user: req.user,
      q,
      page,
      limit,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

/* ---------------------------------------
   Dispatcher's own replenishment ordering + stock
---------------------------------------- */

export async function createReplenishmentOrderController(req, res, next) {
  try {
    const order = await createDispatcherReplenishmentOrder({
      user: req.user,
      payload: req.body || {},
    });

    return res.status(201).json({
      ok: true,
      message: "Replenishment order submitted successfully.",
      item: order,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyDispatcherStockController(req, res, next) {
  try {
    const { page, limit } = req.query || {};

    const out = await getMyDispatcherStock({
      user: req.user,
      page,
      limit,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyDispatcherStockHistoryController(req, res, next) {
  try {
    const { q, type, from, to, sort, page, limit } = req.query || {};

    const out = await getMyDispatcherStockHistory({
      user: req.user,
      q,
      type,
      from,
      to,
      sort,
      page,
      limit,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyReplenishmentCatalogController(req, res, next) {
  try {
    const { q } = req.query || {};

    const out = await getMyReplenishmentCatalog({ user: req.user, q });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyReplenishmentOrdersController(req, res, next) {
  try {
    const { status, q, page, limit, archive } = req.query || {};

    const out = await listMyReplenishmentOrders({
      user: req.user,
      status,
      q,
      page,
      limit,
      archive,
    });

    return res.status(200).json({
      ok: true,
      ...out,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyReplenishmentOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await getMyReplenishmentOrderById({
      user: req.user,
      orderId,
    });

    return res.status(200).json({
      ok: true,
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function dispatchAssignedOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await dispatchAssignedOrder({
      user: req.user,
      orderId,
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      message: "Order dispatched successfully.",
      item,
    });
  } catch (error) {
    next(error);
  }
}

export async function completeAssignedOrderController(req, res, next) {
  try {
    const { orderId } = req.params;

    const item = await completeAssignedOrder({
      user: req.user,
      orderId,
      payload: req.body || {},
    });

    return res.status(200).json({
      ok: true,
      message: "Order completed successfully.",
      item,
    });
  } catch (error) {
    next(error);
  }
}
