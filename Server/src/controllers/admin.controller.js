import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";

import * as adminService from "../services/admin.service.js";
import * as adminInsightsService from "../services/adminInsights.service.js";
import * as factoryService from "../services/factory.service.js";
import { resendPasswordSetupEmailForUser } from "../services/auth.service.js";

// Settings
export const getNotificationSettingsController = asyncHandler(
  async (req, res) => {
    const item = await adminService.getNotificationSettings();
    res.status(200).json({ ok: true, item });
  },
);

export const updateNotificationSettingsController = asyncHandler(
  async (req, res) => {
    const item = await adminService.updateNotificationSettings(req.body || {});
    res.status(200).json({ ok: true, item });
  },
);

export const testNotificationSettingsController = asyncHandler(
  async (req, res) => {
    const item = await adminService.testNotificationSettings();
    res.status(200).json({ ok: true, item });
  },
);

export const listTrashItemsController = asyncHandler(async (req, res) => {
  const out = await adminService.listTrashItems(req.query || {});
  res.status(200).json({ ok: true, ...out });
});

export const restoreTrashItemController = asyncHandler(async (req, res) => {
  const { type, id } = req.params || {};
  const out = await adminService.restoreTrashItem({
    type,
    id,
    adminUser: req.user,
  });
  res.status(200).json({ ok: true, ...out });
});

export const restoreAllTrashItemsController = asyncHandler(async (req, res) => {
  const { type = "ALL" } = req.body || {};
  const out = await adminService.restoreAllTrashItems({
    type,
    adminUser: req.user,
  });
  res.status(200).json({ ok: true, ...out });
});

// Insights
export const getAdminInsightsController = asyncHandler(async (req, res) => {
  const item = await adminInsightsService.getAdminInsights(req.query || {});
  res.status(200).json({ ok: true, item });
});

// Dealer applications
export const listDealerApplicationsController = asyncHandler(
  async (req, res) => {
    const { status, page, limit } = req.query || {};
    const out = await adminService.listDealerApplications({
      status,
      page,
      limit,
    });
    res.status(200).json({ ok: true, ...out });
  },
);

export const getDealerApplicationController = asyncHandler(async (req, res) => {
  const { applicationId } = req.params || {};
  if (!applicationId) throw new ApiError(400, "Missing applicationId");

  const out = await adminService.getDealerApplication({ applicationId });
  res.status(200).json({ ok: true, item: out });
});

export const verifyDealerApplicationController = asyncHandler(
  async (req, res) => {
    const { applicationId } = req.params || {};
    const {
      fulfillmentMode = "FACTORY",
      dispatcherId = null,
      reviewNote = "",
    } = req.body || {};

    if (!applicationId) throw new ApiError(400, "Missing applicationId");

    const out = await adminService.verifyDealerApplication({
      applicationId,
      fulfillmentMode,
      dispatcherId,
      adminUser: req.user,
      reviewNote,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

export const rejectDealerApplicationController = asyncHandler(
  async (req, res) => {
    const { applicationId } = req.params || {};
    const { reviewNote = "" } = req.body || {};

    if (!applicationId) throw new ApiError(400, "Missing applicationId");

    await adminService.rejectDealerApplication({
      applicationId,
      adminUser: req.user,
      reviewNote,
    });

    res.status(200).json({ ok: true });
  },
);

export const deleteDealerApplicationController = asyncHandler(
  async (req, res) => {
    const { applicationId } = req.params || {};
    const { confirmation = "", reason = "" } = req.body || {};

    if (!applicationId) throw new ApiError(400, "Missing applicationId");

    const out = await adminService.deleteDealerApplication({
      applicationId,
      confirmation,
      reason,
      adminUser: req.user,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

export const undoDealerApplicationDeletionController = asyncHandler(
  async (req, res) => {
    const { applicationId } = req.params || {};

    if (!applicationId) throw new ApiError(400, "Missing applicationId");

    const out = await adminService.undoDealerApplicationDeletion({
      applicationId,
      adminUser: req.user,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

// Dealers
export const listDealersController = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query || {};
  const out = await adminService.listDealers({ status, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const getDealerController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const out = await adminService.getDealer({ dealerId });
  res.status(200).json({ ok: true, item: out });
});

export const getDealerAnalyticsController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const out = await adminService.getDealerAnalytics({ dealerId });
  res.status(200).json({ ok: true, item: out });
});

export const getDealerLeaderboardController = asyncHandler(async (req, res) => {
  const { sort, limit, fulfillmentMode, dispatcherId } = req.query || {};
  const out = await adminService.getDealerLeaderboard({
    sort,
    limit,
    fulfillmentMode,
    dispatcherId,
  });
  res.status(200).json({ ok: true, ...out });
});

export const updateDealerController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const out = await adminService.updateDealer({
    dealerId,
    ...req.body,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, item: out });
});

export const resendDealerSetupEmailController = asyncHandler(
  async (req, res) => {
    const { dealerUserId } = req.params || {};
    if (!dealerUserId) throw new ApiError(400, "Missing dealerUserId");

    const out = await resendPasswordSetupEmailForUser({ userId: dealerUserId });
    res.status(200).json(out);
  },
);

export const updateDealerRoutingController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  const { fulfillmentMode, dispatcherId = null } = req.body || {};

  if (!dealerId) throw new ApiError(400, "Missing dealerId");
  if (!fulfillmentMode) throw new ApiError(400, "Missing fulfillmentMode");

  const out = await adminService.updateDealerRouting({
    dealerId,
    fulfillmentMode,
    dispatcherId,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const assignDispatcherToDealerController = asyncHandler(
  async (req, res) => {
    const { dealerId } = req.params || {};
    const { dispatcherId } = req.body || {};

    if (!dealerId || !dispatcherId) {
      throw new ApiError(400, "Missing dealerId or dispatcherId");
    }

    const out = await adminService.assignDispatcherToDealer({
      dealerId,
      dispatcherId,
      adminUser: req.user,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

export const unassignDispatcherFromDealerController = asyncHandler(
  async (req, res) => {
    const { dealerId } = req.params || {};
    if (!dealerId) throw new ApiError(400, "Missing dealerId");

    const out = await adminService.unassignDispatcherFromDealer({
      dealerId,
      adminUser: req.user,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

export const setDealerStatusController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  const { status } = req.body || {};

  if (!dealerId || !status) {
    throw new ApiError(400, "Missing dealerId or status");
  }

  await adminService.setDealerStatus({
    dealerId,
    status,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true });
});

export const deleteDealerController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  const { confirmation = "", reason = "" } = req.body || {};

  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const out = await adminService.scheduleDealerDeletion({
    dealerId,
    confirmation,
    reason,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const undoDealerDeletionController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};

  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  const out = await adminService.undoDealerDeletion({
    dealerId,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const updateDealerCreditController = asyncHandler(async (req, res) => {
  const { dealerId } = req.params || {};
  const { credit } = req.body || {};

  if (!dealerId) throw new ApiError(400, "Missing dealerId");

  await adminService.updateDealerCredit({
    dealerId,
    credit,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true });
});

// Dispatchers
export const createDispatcherController = asyncHandler(async (req, res) => {
  const {
    name,
    companyName = "",
    phone = "",
    email = "",
    address = "",
    notes = "",
  } = req.body || {};

  if (!name) throw new ApiError(400, "Dispatcher name is required");

  const out = await adminService.createDispatcher({
    name,
    companyName,
    phone,
    email,
    address,
    notes,
    adminUser: req.user,
  });

  res.status(201).json({ ok: true, item: out });
});

export const listDispatchersController = asyncHandler(async (req, res) => {
  const { status, activeOnly, page, limit } = req.query || {};

  const out = await adminService.listDispatchers({
    status,
    activeOnly,
    page,
    limit,
  });

  res.status(200).json({ ok: true, ...out });
});

export const listDispatcherApplicationsController = asyncHandler(
  async (req, res) => {
    const { status, page, limit } = req.query || {};

    const out = await adminService.getDispatcherApplications({
      status,
      page,
      limit,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

export const verifyDispatcherApplicationController = asyncHandler(
  async (req, res) => {
    const { dispatcherId } = req.params || {};
    const { notes = "" } = req.body || {};

    if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

    const out = await adminService.verifyDispatcherApplication({
      dispatcherId,
      notes,
      adminUser: req.user,
    });

    res.status(200).json({
      ok: true,
      message: "Dispatcher verified successfully.",
      ...out,
    });
  },
);

export const rejectDispatcherApplicationController = asyncHandler(
  async (req, res) => {
    const { dispatcherId } = req.params || {};
    const { notes = "" } = req.body || {};

    if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

    const out = await adminService.rejectDispatcherApplication({
      dispatcherId,
      notes,
      adminUser: req.user,
    });

    res.status(200).json({
      ok: true,
      message: "Dispatcher rejected successfully.",
      item: out,
    });
  },
);

export const listVerifiedDispatchersController = asyncHandler(
  async (req, res) => {
    const out = await adminService.listVerifiedDispatchers();
    res.status(200).json({ ok: true, ...out });
  },
);

export const setDispatcherActiveController = asyncHandler(async (req, res) => {
  const { dispatcherId } = req.params || {};
  const { isActive } = req.body || {};

  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  await adminService.setDispatcherActive({
    dispatcherId,
    isActive,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true });
});

export const getDispatcherController = asyncHandler(async (req, res) => {
  const { dispatcherId } = req.params || {};
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const out = await adminService.getDispatcher({ dispatcherId });
  res.status(200).json({ ok: true, item: out });
});

export const updateDispatcherController = asyncHandler(async (req, res) => {
  const { dispatcherId } = req.params || {};
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const out = await adminService.updateDispatcher({
    dispatcherId,
    ...req.body,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, item: out });
});

export const deleteDispatcherController = asyncHandler(async (req, res) => {
  const { dispatcherId } = req.params || {};
  const { confirmation = "", reason = "" } = req.body || {};
  if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

  const out = await adminService.deleteDispatcher({
    dispatcherId,
    confirmation,
    reason,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const undoDispatcherDeletionController = asyncHandler(
  async (req, res) => {
    const { dispatcherId } = req.params || {};
    if (!dispatcherId) throw new ApiError(400, "Missing dispatcherId");

    const out = await adminService.undoDispatcherDeletion({
      dispatcherId,
      adminUser: req.user,
    });

    res.status(200).json({ ok: true, ...out });
  },
);

// Orders
export const listOrdersController = asyncHandler(async (req, res) => {
  const { status, dealerId, dispatcherId, fulfillmentMode, from, to, q, page, limit } =
    req.query || {};

  const out = await adminService.listOrders({
    status,
    dealerId,
    dispatcherId,
    fulfillmentMode,
    from,
    to,
    q,
    page,
    limit,
  });

  res.status(200).json({ ok: true, ...out });
});

export const getOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const out = await adminService.getOrder({ orderId });
  res.status(200).json({ ok: true, item: out });
});

export const getOrderStatementsReportController = asyncHandler(
  async (req, res) => {
    const {
      from,
      to,
      dealerId = "",
      dealerSearch = "",
      status = "",
      fulfillmentMode = "",
      dispatcherId = "",
      minTotal = "",
      maxTotal = "",
    } = req.query || {};

    const out = await adminService.getOrderStatementsReport({
      from,
      to,
      dealerId,
      dealerSearch,
      status,
      fulfillmentMode,
      dispatcherId,
      minTotal,
      maxTotal,
    });

    res.status(200).json({ ok: true, item: out });
  },
);

export const hardDeleteOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const { confirmation = "", reason = "" } = req.body || {};

  if (!orderId) throw new ApiError(400, "Missing orderId");

  const out = await adminService.hardDeleteOrder({
    orderId,
    confirmation,
    reason,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const approveOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  await adminService.approveOrder({ orderId, adminUser: req.user });
  res.status(200).json({ ok: true });
});

export const sendOrderToDispatcherController = asyncHandler(
  async (req, res) => {
    const { orderId } = req.params || {};
    if (!orderId) throw new ApiError(400, "Missing orderId");

    await adminService.sendOrderToDispatcher({ orderId, adminUser: req.user });
    res.status(200).json({ ok: true });
  },
);

export const sendOrderToFactoryController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const { note = "" } = req.body || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const item = await factoryService.sendOrderToFactory({
    orderId,
    adminUser: req.user,
    note,
  });

  res.status(200).json({
    ok: true,
    message: "Order sent to Factory.",
    item,
  });
});

export const closeOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  await adminService.closeOrder({ orderId, adminUser: req.user });
  res.status(200).json({ ok: true });
});

export const reviseOrderController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  const { patch, reason = "" } = req.body || {};

  if (!orderId) throw new ApiError(400, "Missing orderId");
  if (!patch || typeof patch !== "object") {
    throw new ApiError(400, "Missing patch");
  }

  const out = await adminService.reviseOrder({
    orderId,
    patch,
    reason,
    adminUser: req.user,
  });

  res.status(200).json({ ok: true, ...out });
});

export const getOrderOutstandingController = asyncHandler(async (req, res) => {
  const { orderId } = req.params || {};
  if (!orderId) throw new ApiError(400, "Missing orderId");

  const out = await adminService.getOrderOutstanding({ orderId });
  res.status(200).json({ ok: true, ...out });
});

// Payments
export const listPaymentsController = asyncHandler(async (req, res) => {
  const { status, method, dealerId, orderId, from, to, page, limit } =
    req.query || {};

  const out = await adminService.listPayments({
    status,
    method,
    dealerId,
    orderId,
    from,
    to,
    page,
    limit,
  });

  res.status(200).json({ ok: true, ...out });
});

export const verifyPaymentController = asyncHandler(async (req, res) => {
  const { paymentId } = req.params || {};
  const { note = "" } = req.body || {};

  if (!paymentId) throw new ApiError(400, "Missing paymentId");

  await adminService.verifyPayment({
    paymentId,
    adminUser: req.user,
    note,
  });

  res.status(200).json({ ok: true });
});

export const rejectPaymentController = asyncHandler(async (req, res) => {
  const { paymentId } = req.params || {};
  const { note = "" } = req.body || {};

  if (!paymentId) throw new ApiError(400, "Missing paymentId");

  await adminService.rejectPayment({
    paymentId,
    adminUser: req.user,
    note,
  });

  res.status(200).json({ ok: true });
});

export const resendDispatcherSetupEmailController = asyncHandler(
  async (req, res) => {
    const { dispatcherUserId } = req.params || {};
    if (!dispatcherUserId) {
      throw new ApiError(400, "Missing dispatcherUserId");
    }

    const out = await resendPasswordSetupEmailForUser({
      userId: dispatcherUserId,
      accountType: "DISPATCHER",
    });

    res.status(200).json(out);
  },
);
