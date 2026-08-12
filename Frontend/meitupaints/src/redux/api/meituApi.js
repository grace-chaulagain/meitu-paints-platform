import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./baseQuery.js";

const CATALOG_CACHE_SECONDS = 20 * 60;
const ORDER_CACHE_SECONDS = 60;
const NOTIFICATION_CACHE_SECONDS = 45;
const WORKFLOW_CACHE_SECONDS = 2 * 60;
const PROFILE_CACHE_SECONDS = 3 * 60;
const REPORT_CACHE_SECONDS = 2 * 60;
const INSIGHT_CACHE_SECONDS = 3 * 60;
const VERIFIED_DISPATCHERS_CACHE_SECONDS = 4 * 60;
const STOCK_CACHE_SECONDS = 2 * 60;
const FACTORY_CACHE_SECONDS = 60;

function getItems(response) {
  return response?.items || response?.products || [];
}

function getItem(response) {
  return response?.item || response?.dealer || response?.dispatcher || null;
}

function toFormData(fieldName, file) {
  const formData = new FormData();
  formData.append(fieldName, file);
  return formData;
}

function listTag(type) {
  return { type, id: "LIST" };
}

function itemTags(type, items = []) {
  return [
    listTag(type),
    ...items
      .map((item) => item?._id || item?.id || item?.sku || item?.code)
      .filter(Boolean)
      .map((id) => ({ type, id })),
  ];
}

// Creating, amending or withdrawing a scheme all move reserved factory stock
// and change what the factory queue is holding, so all three invalidate the
// same set rather than each keeping its own drifting list.
const SCHEME_ORDER_INVALIDATES = [
  listTag("SchemeOrder"),
  listTag("Order"),
  listTag("AdminOrder"),
  listTag("Stock"),
  listTag("Insight"),
  listTag("AdminInsight"),
];

function listResponseTags(type, response) {
  return itemTags(type, getItems(response));
}

function itemResponseTags(type, response) {
  const item = getItem(response);
  const id = item?._id || item?.id;
  return id ? [listTag(type), { type, id }] : [listTag(type)];
}

function orderMutationTags(orderId) {
  const itemTagsForOrder = orderId
    ? [
        { type: "Order", id: orderId },
        { type: "AdminOrder", id: orderId },
        { type: "DealerOrder", id: orderId },
        { type: "DispatcherOrder", id: orderId },
        { type: "AdminDealerOrder", id: orderId },
        { type: "DispatcherDealerOrder", id: orderId },
        { type: "FactoryOrder", id: orderId },
      ]
    : [];

  return [
    listTag("Order"),
    listTag("AdminOrder"),
    listTag("DealerOrder"),
    listTag("DispatcherOrder"),
    listTag("AdminDealerOrder"),
    listTag("DispatcherDealerOrder"),
    listTag("DispatcherReplenishmentOrder"),
    listTag("FactoryOrder"),
    listTag("FactoryInvoice"),
    listTag("Stock"),
    listTag("StockHistory"),
    listTag("StockAdjustment"),
    listTag("DispatcherStock"),
    listTag("DealerProfile"),
    listTag("Dashboard"),
    listTag("AdminDashboard"),
    listTag("DispatcherDashboard"),
    listTag("FactoryDashboard"),
    listTag("Report"),
    listTag("Insight"),
    listTag("AdminInsight"),
    listTag("Notification"),
    ...itemTagsForOrder,
  ];
}

function dealerMutationTags(dealerId) {
  return [
    listTag("Dealer"),
    listTag("DealerProfile"),
    listTag("DispatcherDealer"),
    listTag("Order"),
    listTag("AdminOrder"),
    listTag("DispatcherOrder"),
    listTag("AdminDealerOrder"),
    listTag("DispatcherDealerOrder"),
    listTag("Dashboard"),
    listTag("AdminDashboard"),
    listTag("DispatcherDashboard"),
    listTag("Report"),
    listTag("Insight"),
    listTag("AdminInsight"),
    listTag("Notification"),
    ...(dealerId
      ? [
          { type: "Dealer", id: dealerId },
          { type: "DealerProfile", id: dealerId },
          { type: "DispatcherDealer", id: dealerId },
        ]
      : []),
  ];
}

function dispatcherMutationTags(dispatcherId) {
  return [
    listTag("Dispatcher"),
    listTag("DispatcherApplication"),
    listTag("DispatcherDealer"),
    listTag("Dealer"),
    listTag("AdminOrder"),
    listTag("DispatcherOrder"),
    listTag("AdminDealerOrder"),
    listTag("DispatcherDealerOrder"),
    listTag("Dashboard"),
    listTag("AdminDashboard"),
    listTag("DispatcherDashboard"),
    listTag("Report"),
    listTag("Insight"),
    listTag("AdminInsight"),
    listTag("Notification"),
    { type: "Dispatcher", id: "VERIFIED_LIST" },
    ...(dispatcherId ? [{ type: "Dispatcher", id: dispatcherId }] : []),
  ];
}

export const meituApi = createApi({
  reducerPath: "meituApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    "Product",
    "ProductCategory",
    "ProductFamily",
    "Order",
    "AdminOrder",
    "DealerOrder",
    "DispatcherOrder",
    "AdminDealerOrder",
    "DispatcherDealerOrder",
    "Dealer",
    "DealerProfile",
    "DealerApplication",
    "Dispatcher",
    "DispatcherApplication",
    "DispatcherDealer",
    "DispatcherProfile",
    "Stock",
    "StockHistory",
    "StockAdjustment",
    "FactoryOrder",
    "FactoryDealer",
    "FactoryDashboard",
    "FactoryInvoice",
    "ProformaInvoice",
    "Notification",
    "Dashboard",
    "AdminDashboard",
    "DispatcherDashboard",
    "Report",
    "Insight",
    "AdminInsight",
    "AdminPayment",
    "SchemeOrder",
    "DispatcherStock",
    "DispatcherStockMovement",
    "DispatcherCatalog",
    "DispatcherReplenishmentOrder",
    "DealerInventory",
    "DealerInventoryMovement",
    "DealerSale",
    "AdminSale",
    "DealerPayment",
    "DealerOrderOutstanding",
    "Painter",
    "Coupon",
    "CouponBatch",
    "CouponRedemption",
    "CouponAttempt",
    "CouponSettlement",
    "DealerPainterSearch",
    "PointsCatalogProduct",
    "Announcement",
  ],
  keepUnusedDataFor: 60,
  // Global freshness: a stale order card is worse than a redundant fetch -
  // refetch whenever the tab regains focus or the connection comes back,
  // on top of the per-query pollingInterval set at specific order-list/
  // detail call sites (not globally - catalogs/settings/etc. shouldn't
  // poll). Requires setupListeners(store.dispatch) in store.js to actually
  // fire (RTK Query doesn't wire the window focus/online listeners itself).
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({

    getNotificationSummary: builder.query({
      query: () => ({ url: "/api/notifications/summary" }),
      transformResponse: (response) =>
        response?.item || { totalUnread: 0, categories: {} },
      keepUnusedDataFor: NOTIFICATION_CACHE_SECONDS,
      providesTags: () => [
        listTag("Notification"),
        { type: "Notification", id: "SUMMARY" },
      ],
    }),

    getNotifications: builder.query({
      query: (params = {}) => ({ url: "/api/notifications", params }),
      transformResponse: getItems,
      keepUnusedDataFor: NOTIFICATION_CACHE_SECONDS,
      providesTags: (items = []) => itemTags("Notification", items),
    }),

    markNotificationRead: builder.mutation({
      query: (notificationId) => ({
        url: `/api/notifications/${notificationId}/read`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, notificationId) => [
        listTag("Notification"),
        { type: "Notification", id: "SUMMARY" },
        ...(notificationId ? [{ type: "Notification", id: notificationId }] : []),
      ],
    }),

    markNotificationsRead: builder.mutation({
      query: (payload = {}) => ({
        url: "/api/notifications/read",
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: () => [
        listTag("Notification"),
        { type: "Notification", id: "SUMMARY" },
      ],
    }),

    getVapidPublicKey: builder.query({
      query: () => ({ url: "/api/push/vapid-public-key" }),
      transformResponse: (response) => response?.publicKey || null,
    }),

    subscribePush: builder.mutation({
      query: (subscription) => ({
        url: "/api/push/subscribe",
        method: "POST",
        data: { subscription },
      }),
    }),

    unsubscribePush: builder.mutation({
      query: (endpoint) => ({
        url: "/api/push/unsubscribe",
        method: "POST",
        data: { endpoint },
      }),
    }),

    getProducts: builder.query({
      query: (params = {}) => ({
        url: "/api/products",
        params,
      }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: (items = []) => itemTags("Product", items),
    }),

    getProductCategories: builder.query({
      query: () => ({ url: "/api/products/categories" }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: () => [listTag("ProductCategory")],
    }),

    getProductFamilies: builder.query({
      query: () => ({ url: "/api/product-families" }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: (items = []) => itemTags("ProductFamily", items),
    }),

    getAdminProductCategories: builder.query({
      query: () => ({ url: "/api/admin/catalog/categories" }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: () => [listTag("ProductCategory")],
    }),

    // Bulk-renames every Product/ProductFamily currently in `fromValue`'s
    // category to `toLabel` - invalidating the same Product/ProductFamily/
    // ProductCategory list tags the public dealer/dispatcher catalog
    // queries also provide, so their next fetch (immediate if mounted right
    // now, otherwise on next visit) picks up the new name without any
    // page-specific plumbing.
    renameProductCategory: builder.mutation({
      query: ({ fromValue, toLabel }) => ({
        url: "/api/admin/catalog/categories/rename",
        method: "POST",
        body: { fromValue, toLabel },
      }),
      invalidatesTags: () => [listTag("Product"), listTag("ProductFamily"), listTag("ProductCategory")],
    }),

    getAdminAnnouncements: builder.query({
      query: (params = {}) => ({ url: "/api/admin/announcements", params }),
      transformResponse: (response) => response?.item || { items: [], nextCursor: null },
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => [
        listTag("Announcement"),
        ...(response?.items || []).map((item) => ({ type: "Announcement", id: item._id })),
      ],
    }),

    sendAdminAnnouncement: builder.mutation({
      query: (payload) => ({
        url: "/api/admin/announcements/send",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: () => [listTag("Announcement")],
    }),

    previewAnnouncementEmail: builder.mutation({
      query: (payload) => ({
        url: "/api/admin/announcements/preview",
        method: "POST",
        body: payload,
      }),
    }),

    getAdminProductFamilies: builder.query({
      query: () => ({ url: "/api/admin/catalog/product-families" }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: (items = []) => itemTags("ProductFamily", items),
    }),

    getAdminProducts: builder.query({
      query: () => ({ url: "/api/admin/catalog/products" }),
      transformResponse: getItems,
      keepUnusedDataFor: CATALOG_CACHE_SECONDS,
      providesTags: (items = []) => itemTags("Product", items),
    }),

    createAdminProduct: builder.mutation({
      query: (payload) => ({
        url: "/api/admin/catalog/products",
        method: "POST",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: () => [
        listTag("Product"),
        listTag("ProductCategory"),
        listTag("ProductFamily"),
      ],
    }),

    updateAdminProduct: builder.mutation({
      query: ({ productId, payload }) => ({
        url: `/api/admin/catalog/products/${productId}`,
        method: "PATCH",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Product"),
        listTag("ProductCategory"),
        { type: "Product", id: arg?.productId },
      ],
    }),

    deleteAdminProduct: builder.mutation({
      query: (productId) => ({
        url: `/api/admin/catalog/products/${productId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, productId) => [
        listTag("Product"),
        listTag("ProductCategory"),
        { type: "Product", id: productId },
      ],
    }),

    restoreAdminProduct: builder.mutation({
      query: (productId) => ({
        url: `/api/admin/catalog/products/${productId}/restore`,
        method: "POST",
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, productId) => [
        listTag("Product"),
        listTag("ProductCategory"),
        { type: "Product", id: productId },
      ],
    }),

    uploadAdminProductImage: builder.mutation({
      query: ({ productId, file }) => ({
        url: `/api/admin/catalog/products/${productId}/image`,
        method: "POST",
        data: toFormData("image", file),
        headers: { "Content-Type": "multipart/form-data" },
      }),
      transformResponse: (response) => getItem(response) || response,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Product"),
        { type: "Product", id: arg?.productId },
      ],
    }),

    deleteAdminProductImage: builder.mutation({
      query: ({ productId, publicId }) => ({
        url: `/api/admin/catalog/products/${productId}/image/${encodeURIComponent(publicId)}`,
        method: "DELETE",
      }),
      transformResponse: (response) => getItem(response) || response,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Product"),
        { type: "Product", id: arg?.productId },
      ],
    }),

    uploadAdminFamilyImage: builder.mutation({
      query: ({ familyId, file }) => ({
        url: `/api/admin/catalog/product-families/${familyId}/image`,
        method: "POST",
        data: toFormData("image", file),
        headers: { "Content-Type": "multipart/form-data" },
      }),
      transformResponse: (response) => getItem(response) || response,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Product"),
        listTag("ProductFamily"),
        { type: "ProductFamily", id: arg?.familyId },
      ],
    }),

    deleteAdminFamilyImage: builder.mutation({
      query: ({ familyId, publicId }) => ({
        url: `/api/admin/catalog/product-families/${familyId}/image/${encodeURIComponent(publicId)}`,
        method: "DELETE",
      }),
      transformResponse: (response) => getItem(response) || response,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Product"),
        listTag("ProductFamily"),
        { type: "ProductFamily", id: arg?.familyId },
      ],
    }),

    getDealerOrders: builder.query({
      query: (params = {}) => ({ url: "/api/dealer/orders", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("DealerOrder", response),
        listTag("Order"),
      ],
    }),

    getDealerOrder: builder.query({
      query: (orderId) => ({ url: `/api/dealer/orders/${orderId}` }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      transformResponse: (response) => getItem(response) || response,
      providesTags: (_result, _error, orderId) => [{ type: "DealerOrder", id: orderId }],
    }),

    createDealerOrder: builder.mutation({
      query: (payload) => ({
        url: "/api/orders",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: () => orderMutationTags(),
    }),

    getMyOrderOutstanding: builder.query({
      query: (orderId) => ({ url: `/api/dealer/orders/${orderId}/outstanding` }),
      providesTags: (_response, _error, orderId) => [
        { type: "DealerOrderOutstanding", id: orderId },
      ],
    }),

    getMyPayments: builder.query({
      query: (params = {}) => ({ url: "/api/dealer/payments", params }),
      providesTags: (response) => [
        ...listResponseTags("DealerPayment", response),
        listTag("DealerPayment"),
      ],
    }),

    submitMyPayment: builder.mutation({
      query: ({ orderId, ...payload }) => ({
        url: `/api/dealer/orders/${orderId}/payments`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        listTag("DealerPayment"),
        { type: "DealerOrderOutstanding", id: arg?.orderId },
        listTag("DealerOrder"),
      ],
    }),

    getDealerInventory: builder.query({
      query: (params = {}) => ({ url: "/api/dealer/inventory", params }),
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("DealerInventory", response),
        listTag("DealerInventory"),
      ],
    }),

    getDealerInventoryItem: builder.query({
      query: (productId) => ({ url: `/api/dealer/inventory/${productId}` }),
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      transformResponse: (response) => getItem(response) || response,
      providesTags: (_result, _error, productId) => [{ type: "DealerInventory", id: productId }],
    }),

    getDealerInventoryMovements: builder.query({
      query: ({ productId, ...params } = {}) => ({
        url: `/api/dealer/inventory/${productId}/movements`,
        params,
      }),
      providesTags: (_response, _error, arg) => [
        listTag("DealerInventoryMovement"),
        { type: "DealerInventoryMovement", id: arg?.productId },
      ],
    }),

    getDealerInventoryHistory: builder.query({
      query: (params = {}) => ({ url: "/api/dealer/inventory/history", params }),
      providesTags: () => [listTag("DealerInventoryMovement")],
    }),

    getPainterSales: builder.query({
      query: ({ painterId, ...params }) => ({ url: `/api/admin/painters/${painterId}/sales`, params }),
      providesTags: (_response, _error, arg) => [{ type: "Painter", id: `${arg?.painterId}:sales` }],
    }),

    getDealerSales: builder.query({
      query: (params = {}) => ({ url: "/api/dealer/sales", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("DealerSale", response),
        listTag("DealerSale"),
      ],
    }),

    getDealerSale: builder.query({
      query: (saleId) => ({ url: `/api/dealer/sales/${saleId}` }),
      transformResponse: getItem,
      providesTags: (_response, _error, saleId) => [{ type: "DealerSale", id: saleId }],
    }),

    createDealerSale: builder.mutation({
      query: (payload) => ({ url: "/api/dealer/sales", method: "POST", data: payload }),
      transformResponse: getItem,
      invalidatesTags: () => [
        listTag("DealerSale"),
        listTag("DealerInventory"),
        listTag("DealerInventoryMovement"),
      ],
    }),

    voidDealerSale: builder.mutation({
      query: ({ saleId, reason }) => ({
        url: `/api/dealer/sales/${saleId}/void`,
        method: "POST",
        data: { reason },
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [
        listTag("DealerSale"),
        { type: "DealerSale", id: arg?.saleId },
        listTag("DealerInventory"),
        listTag("DealerInventoryMovement"),
      ],
    }),

    getCouponPreview: builder.query({
      query: (token) => ({ url: `/api/dealer/coupons/${token}` }),
      transformResponse: getItem,
      providesTags: (_response, _error, token) => [{ type: "Coupon", id: token }],
    }),

    redeemCoupon: builder.mutation({
      query: ({ token, painterType, painterId }) => ({
        url: `/api/dealer/coupons/${token}/redeem`,
        method: "POST",
        data: { painterType, painterId: painterId || null },
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [{ type: "Coupon", id: arg?.token }],
    }),

    generateCoupons: builder.mutation({
      query: (payload) => ({ url: "/api/admin/coupons/generate", method: "POST", data: payload }),
      invalidatesTags: () => [listTag("Coupon")],
    }),

    getAdminCoupons: builder.query({
      query: (params = {}) => ({ url: "/api/admin/coupons", params }),
      providesTags: (response) => [
        ...listResponseTags("Coupon", response),
        listTag("Coupon"),
      ],
    }),

    getAdminCouponBatches: builder.query({
      query: (params = {}) => ({ url: "/api/admin/coupons/batches", params }),
      providesTags: () => [listTag("CouponBatch")],
    }),

    getCouponRedemptionHistory: builder.query({
      query: (params = {}) => ({ url: "/api/admin/coupons/redemptions", params }),
      providesTags: (response) => [
        ...listResponseTags("CouponRedemption", response),
        listTag("CouponRedemption"),
      ],
    }),

    getRewardSettings: builder.query({
      query: () => ({ url: "/api/admin/coupons/settings" }),
      transformResponse: getItem,
      providesTags: () => [{ type: "Coupon", id: "SETTINGS" }],
    }),

    updateRewardSettings: builder.mutation({
      query: (payload) => ({ url: "/api/admin/coupons/settings", method: "PATCH", data: payload }),
      transformResponse: getItem,
      invalidatesTags: () => [{ type: "Coupon", id: "SETTINGS" }],
    }),

    deleteCoupon: builder.mutation({
      query: (couponId) => ({ url: `/api/admin/coupons/${couponId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, couponId) => [listTag("Coupon"), listTag("CouponBatch"), { type: "Coupon", id: couponId }],
    }),

    deleteCouponBatch: builder.mutation({
      query: (batchId) => ({ url: `/api/admin/coupons/batches/${batchId}`, method: "DELETE" }),
      invalidatesTags: () => [listTag("Coupon"), listTag("CouponBatch")],
    }),

    deleteCouponBatches: builder.mutation({
      query: (batchIds) => ({ url: "/api/admin/coupons/batches", method: "DELETE", data: { batchIds } }),
      invalidatesTags: () => [listTag("Coupon"), listTag("CouponBatch")],
    }),

    getCouponAttempts: builder.query({
      query: (params = {}) => ({ url: "/api/admin/coupons/attempts", params }),
      providesTags: (response) => [
        ...listResponseTags("CouponAttempt", response),
        listTag("CouponAttempt"),
      ],
    }),

    getSettlementReport: builder.query({
      query: (params = {}) => ({ url: "/api/admin/coupons/settlement-report", params }),
      providesTags: () => [listTag("CouponSettlement")],
    }),

    getAdminSales: builder.query({
      query: (params = {}) => ({ url: "/api/admin/sales", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("AdminSale", response),
        listTag("AdminSale"),
      ],
    }),

    getAdminSale: builder.query({
      query: (saleId) => ({ url: `/api/admin/sales/${saleId}` }),
      transformResponse: getItem,
      providesTags: (_response, _error, saleId) => [{ type: "AdminSale", id: saleId }],
    }),

    getAdminOrders: builder.query({
      query: (params = {}) => ({ url: "/api/orders", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("AdminOrder", response),
        listTag("Order"),
        listTag("DealerOrder"),
        listTag("DispatcherOrder"),
      ],
    }),

    getAdminOrder: builder.query({
      query: (orderId) => ({ url: `/api/orders/${orderId}` }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response, _error, orderId) => [
        ...itemResponseTags("AdminOrder", response),
        { type: "Order", id: orderId },
      ],
    }),

    getAdminOrderStockCheck: builder.query({
      query: (orderId) => ({ url: `/api/orders/${orderId}/stock-check` }),
      transformResponse: getItem,
      keepUnusedDataFor: 15,
      providesTags: (_response, _error, orderId) => [
        listTag("Stock"),
        listTag("AdminOrder"),
        ...(orderId
          ? [
              { type: "Order", id: orderId },
              { type: "AdminOrder", id: orderId },
            ]
          : []),
      ],
    }),

    getAdminScopedOrders: builder.query({
      query: (params = {}) => ({ url: "/api/admin/orders", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("AdminOrder", response),
        ...listResponseTags("AdminDealerOrder", response),
        listTag("Order"),
        listTag("DealerOrder"),
      ],
    }),

    getAdminScopedOrder: builder.query({
      query: (orderId) => ({ url: `/api/admin/orders/${orderId}` }),
      transformResponse: getItem,
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (_response, _error, orderId) => [
        listTag("AdminOrder"),
        listTag("AdminDealerOrder"),
        { type: "AdminOrder", id: orderId },
        { type: "AdminDealerOrder", id: orderId },
        { type: "Order", id: orderId },
      ],
    }),

    verifyAdminOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/orders/${orderId}/verify`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    rejectAdminOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/orders/${orderId}/reject`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    // Phase 6 of the order-state-handling redesign - the one reversible
    // transition (admin verify only). Same invalidation shape as verify/
    // reject since it's just another status-changing mutation on the order.
    revertAdminOrderVerification: builder.mutation({
      query: (orderId) => ({
        url: `/api/orders/${orderId}/revert-verification`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, orderId) => orderMutationTags(orderId),
    }),

    // Assigns/returns the Proforma Invoice's frozen metadata - serialNumber
    // and generatedAt - called right before building the PI PDF, by Admin
    // or Factory. Idempotent on the backend: serialNumber is fixed forever
    // after the first call; generatedAt keeps refreshing while the order is
    // still pre-dispatch, then freezes permanently once it isn't.
    ensureProformaInvoiceMetadata: builder.mutation({
      query: (orderId) => ({
        url: `/api/orders/${orderId}/proforma-metadata`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, orderId) => orderMutationTags(orderId),
    }),

    amendAdminOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/orders/${orderId}/amend`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    deleteAdminOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/admin/orders/${orderId}`,
        method: "DELETE",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    getDispatcherOrders: builder.query({
      query: (params = {}) => ({ url: "/api/dispatchers/me/orders", params }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("DispatcherOrder", response),
        listTag("Order"),
        listTag("DealerOrder"),
        listTag("AdminOrder"),
      ],
    }),

    getDispatcherOrder: builder.query({
      query: (orderId) => ({ url: `/api/dispatchers/me/orders/${orderId}` }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response, _error, orderId) => [
        ...itemResponseTags("DispatcherOrder", response),
        { type: "Order", id: orderId },
      ],
    }),

    getDispatcherOrderStockCheck: builder.query({
      query: (orderId) => ({ url: `/api/dispatchers/me/orders/${orderId}/stock-check` }),
      transformResponse: getItem,
      keepUnusedDataFor: 15,
      providesTags: (_response, _error, orderId) => [
        listTag("DispatcherStock"),
        ...(orderId ? [{ type: "Order", id: orderId }] : []),
      ],
    }),

    getDispatcherOrdersArchive: builder.query({
      query: (params = {}) => ({
        url: "/api/dispatchers/me/orders/archive",
        params,
      }),
      keepUnusedDataFor: ORDER_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("DispatcherOrder", response),
        ...listResponseTags("DispatcherDealerOrder", response),
        listTag("Order"),
        listTag("DealerOrder"),
        listTag("AdminOrder"),
      ],
    }),

    verifyDispatcherOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/dispatchers/me/orders/${orderId}/verify`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    rejectDispatcherOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/dispatchers/me/orders/${orderId}/reject`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    amendDispatcherOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/dispatchers/me/orders/${orderId}/amend`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    dispatchDispatcherOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/dispatchers/me/orders/${orderId}/dispatch`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    completeDispatcherOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/dispatchers/me/orders/${orderId}/complete`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    getMyDispatcherStock: builder.query({
      query: (params = {}) => ({ url: "/api/dispatchers/me/stock", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: [listTag("DispatcherStock")],
    }),

    getMyDispatcherStockHistory: builder.query({
      query: (params = {}) => ({ url: "/api/dispatchers/me/stock/history", params }),
      providesTags: () => [listTag("DispatcherStockMovement")],
    }),

    getDispatcherReplenishmentCatalog: builder.query({
      query: (params = {}) => ({
        url: "/api/dispatchers/me/replenishment-catalog",
        params,
      }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: [listTag("DispatcherCatalog")],
    }),

    getDispatcherReplenishmentOrders: builder.query({
      query: (params = {}) => ({
        url: "/api/dispatchers/me/replenishment-orders",
        params,
      }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("DispatcherReplenishmentOrder", response),
    }),

    getDispatcherReplenishmentOrder: builder.query({
      query: (orderId) => ({ url: `/api/dispatchers/me/replenishment-orders/${orderId}` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (response, _error, orderId) => [
        ...itemResponseTags("DispatcherReplenishmentOrder", response),
        { type: "DispatcherReplenishmentOrder", id: orderId },
      ],
    }),

    createDispatcherReplenishmentOrder: builder.mutation({
      query: (payload) => ({
        url: "/api/dispatchers/me/replenishment-orders",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: () => orderMutationTags(),
    }),

    getAdminDealers: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dealers", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("Dealer", response),
    }),

    getAdminDealer: builder.query({
      query: (dealerId) => ({ url: `/api/admin/dealers/${dealerId}` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (response, _error, dealerId) => [
        ...itemResponseTags("DealerProfile", response),
        { type: "Dealer", id: dealerId },
      ],
    }),

    getAdminDealerAnalytics: builder.query({
      query: (dealerId) => ({ url: `/api/admin/dealers/${dealerId}/analytics` }),
      transformResponse: getItem,
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (_response, _error, dealerId) => [
        listTag("DealerProfile"),
        listTag("Insight"),
        { type: "DealerProfile", id: dealerId },
        { type: "Dealer", id: dealerId },
      ],
    }),

    getAdminDealerInventory: builder.query({
      query: (arg) => {
        const { dealerId, from, to } = typeof arg === "string" ? { dealerId: arg } : arg || {};
        return {
          url: `/api/admin/dealers/${dealerId}/inventory`,
          params: { limit: 200, ...(from ? { from } : {}), ...(to ? { to } : {}) },
        };
      },
      providesTags: (response, _error, arg) => {
        const dealerId = typeof arg === "string" ? arg : arg?.dealerId;
        return [...listResponseTags("DealerInventory", response), { type: "DealerInventory", id: dealerId }];
      },
    }),

    getAdminDealerInventoryMovements: builder.query({
      query: ({ dealerId, productId, ...params }) => ({
        url: `/api/admin/dealers/${dealerId}/inventory/${productId}/movements`,
        params,
      }),
      providesTags: (_response, _error, arg) => [
        { type: "DealerInventoryMovement", id: `${arg?.dealerId}:${arg?.productId}` },
      ],
    }),

    updateAdminDealer: builder.mutation({
      query: ({ dealerId, payload }) => ({
        url: `/api/admin/dealers/${dealerId}`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dealerMutationTags(arg?.dealerId),
    }),

    updateAdminDealerStatus: builder.mutation({
      query: ({ dealerId, status }) => ({
        url: `/api/admin/dealers/${dealerId}/status`,
        method: "PATCH",
        data: { status },
      }),
      invalidatesTags: (_result, _error, arg) => dealerMutationTags(arg?.dealerId),
    }),

    deleteAdminDealer: builder.mutation({
      query: ({ dealerId, payload }) => ({
        url: `/api/admin/dealers/${dealerId}`,
        method: "DELETE",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dealerMutationTags(arg?.dealerId),
    }),

    undoDeleteAdminDealer: builder.mutation({
      query: (dealerId) => ({
        url: `/api/admin/dealers/${dealerId}/undo-delete`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, dealerId) => dealerMutationTags(dealerId),
    }),

    updateAdminDealerRouting: builder.mutation({
      query: ({ dealerId, payload }) => ({
        url: `/api/admin/dealers/${dealerId}/routing`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dealerMutationTags(arg?.dealerId),
    }),

    resendDealerSetupEmail: builder.mutation({
      query: (dealerUserId) => ({
        url: `/api/admin/dealers/${dealerUserId}/resend-setup-email`,
        method: "POST",
      }),
      invalidatesTags: () => [listTag("DealerProfile")],
    }),

    assignDispatcherToDealer: builder.mutation({
      query: ({ dealerId, dispatcherId }) => ({
        url: `/api/admin/dealers/${dealerId}/assign-dispatcher`,
        method: "POST",
        data: { dispatcherId },
      }),
      invalidatesTags: (_result, _error, arg) => dealerMutationTags(arg?.dealerId),
    }),

    unassignDispatcherFromDealer: builder.mutation({
      query: (dealerId) => ({
        url: `/api/admin/dealers/${dealerId}/unassign-dispatcher`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, dealerId) => dealerMutationTags(dealerId),
    }),

    getAdminDealerApplications: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dealer-applications", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("DealerApplication", response),
    }),

    getAdminDealerApplication: builder.query({
      query: (applicationId) => ({
        url: `/api/admin/dealer-applications/${applicationId}`,
      }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response, _error, applicationId) => [
        ...itemResponseTags("DealerApplication", response),
        { type: "DealerApplication", id: applicationId },
      ],
    }),

    approveDealerApplication: builder.mutation({
      query: ({ applicationId, payload }) => ({
        url: `/api/admin/dealer-applications/${applicationId}/verify`,
        method: "POST",
        data: payload,
        headers: { "Content-Type": "application/json" },
      }),
      invalidatesTags: (_result, _error, arg) => [
        listTag("DealerApplication"),
        { type: "DealerApplication", id: arg?.applicationId },
        listTag("Dealer"),
        listTag("DispatcherDealer"),
        listTag("Dashboard"),
        listTag("AdminDashboard"),
        listTag("Insight"),
        listTag("AdminInsight"),
        listTag("Notification"),
      ],
    }),

    rejectDealerApplication: builder.mutation({
      query: ({ applicationId, payload }) => ({
        url: `/api/admin/dealer-applications/${applicationId}/reject`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        listTag("DealerApplication"),
        { type: "DealerApplication", id: arg?.applicationId },
        listTag("Dashboard"),
        listTag("AdminDashboard"),
        listTag("Notification"),
      ],
    }),

    deleteDealerApplication: builder.mutation({
      query: ({ applicationId, payload }) => ({
        url: `/api/admin/dealer-applications/${applicationId}`,
        method: "DELETE",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        listTag("DealerApplication"),
        { type: "DealerApplication", id: arg?.applicationId },
        listTag("Dashboard"),
        listTag("AdminDashboard"),
        listTag("Notification"),
      ],
    }),

    getAdminDispatchers: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dispatchers", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("Dispatcher", response),
    }),

    getAdminDispatcherApplications: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dispatcher-applications", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("DispatcherApplication", response),
    }),

    getVerifiedDispatchers: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dispatchers/verified", params }),
      keepUnusedDataFor: VERIFIED_DISPATCHERS_CACHE_SECONDS,
      providesTags: (response) => [
        { type: "Dispatcher", id: "VERIFIED_LIST" },
        ...listResponseTags("Dispatcher", response),
      ],
    }),

    getAdminDispatcher: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (response, _error, dispatcherId) => [
        ...itemResponseTags("Dispatcher", response),
        { type: "Dispatcher", id: dispatcherId },
      ],
    }),

    getAdminDispatcherStock: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}/stock` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (_response, _error, dispatcherId) => [
        listTag("DispatcherStock"),
        { type: "DispatcherStock", id: dispatcherId },
      ],
    }),

    getAdminDispatcherAnalytics: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}/analytics` }),
      transformResponse: getItem,
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (_response, _error, dispatcherId) => [
        listTag("Dispatcher"),
        { type: "Dispatcher", id: dispatcherId },
      ],
    }),

    getAdminDispatcherOwnOrders: builder.query({
      query: ({ dispatcherId, ...params }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/own-orders`,
        params,
      }),
      providesTags: (_response, _error, arg) => [
        { type: "DispatcherOwnOrder", id: arg?.dispatcherId },
      ],
    }),

    getAdminDispatcherFulfilledOrders: builder.query({
      query: ({ dispatcherId, ...params }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/fulfilled-orders`,
        params,
      }),
      providesTags: (_response, _error, arg) => [
        { type: "DispatcherFulfilledOrder", id: arg?.dispatcherId },
      ],
    }),

    getAdminDispatcherDealerStats: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}/dealer-stats` }),
      providesTags: (_response, _error, dispatcherId) => [
        { type: "DispatcherDealerStats", id: dispatcherId },
      ],
    }),

    getAdminDispatcherProductSummary: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}/product-summary` }),
      providesTags: (_response, _error, dispatcherId) => [
        { type: "DispatcherProductSummary", id: dispatcherId },
      ],
    }),

    getAdminDispatcherProductMovements: builder.query({
      query: ({ dispatcherId, productId }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/products/${productId}/movements`,
      }),
      providesTags: (_response, _error, arg) => [
        { type: "DispatcherProductMovement", id: `${arg?.dispatcherId}:${arg?.productId}` },
      ],
    }),

    resendDispatcherSetupEmail: builder.mutation({
      query: (dispatcherUserId) => ({
        url: `/api/admin/dispatchers/${dispatcherUserId}/resend-setup-email`,
        method: "POST",
      }),
      invalidatesTags: () => [listTag("Dispatcher")],
    }),

    getDispatcherPricingSummary: builder.query({
      query: () => ({ url: "/api/admin/dispatchers/pricing-summary" }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: () => [listTag("DispatcherPricing")],
    }),

    getDispatcherPricing: builder.query({
      query: (dispatcherId) => ({ url: `/api/admin/dispatchers/${dispatcherId}/pricing` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (_response, _error, dispatcherId) => [
        { type: "DispatcherPricing", id: dispatcherId },
      ],
    }),

    updateDispatcherPricing: builder.mutation({
      query: ({ dispatcherId, payload }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/pricing`,
        method: "PUT",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        listTag("DispatcherPricing"),
        { type: "DispatcherPricing", id: arg?.dispatcherId },
      ],
    }),

    approveDispatcher: builder.mutation({
      query: ({ dispatcherId, payload }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/verify`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dispatcherMutationTags(arg?.dispatcherId),
    }),

    rejectDispatcher: builder.mutation({
      query: ({ dispatcherId, payload }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/reject`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dispatcherMutationTags(arg?.dispatcherId),
    }),

    setAdminDispatcherActive: builder.mutation({
      query: ({ dispatcherId, isActive }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/active`,
        method: "PATCH",
        data: { isActive },
      }),
      invalidatesTags: (_result, _error, arg) => dispatcherMutationTags(arg?.dispatcherId),
    }),

    updateAdminDispatcher: builder.mutation({
      query: ({ dispatcherId, payload }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dispatcherMutationTags(arg?.dispatcherId),
    }),

    deleteAdminDispatcher: builder.mutation({
      query: ({ dispatcherId, payload }) => ({
        url: `/api/admin/dispatchers/${dispatcherId}`,
        method: "DELETE",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => dispatcherMutationTags(arg?.dispatcherId),
    }),

    undoAdminDispatcherDeletion: builder.mutation({
      query: (dispatcherId) => ({
        url: `/api/admin/dispatchers/${dispatcherId}/undo-delete`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, dispatcherId) => dispatcherMutationTags(dispatcherId),
    }),

    getMyDispatcherProfile: builder.query({
      query: () => ({ url: "/api/dispatchers/me" }),
      transformResponse: getItem,
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (response) => {
        const id = response?._id || response?.id || "ME";
        return [listTag("DispatcherProfile"), { type: "DispatcherProfile", id }];
      },
    }),

    getDispatcherDealers: builder.query({
      query: (params = {}) => ({ url: "/api/dispatchers/me/dealers", params }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("DispatcherDealer", response),
    }),

    getDispatcherDealer: builder.query({
      query: (dealerId) => ({ url: `/api/dispatchers/me/dealers/${dealerId}` }),
      keepUnusedDataFor: PROFILE_CACHE_SECONDS,
      providesTags: (response, _error, dealerId) => [
        ...itemResponseTags("DispatcherDealer", response),
        { type: "DispatcherDealer", id: dealerId },
      ],
    }),

    getFactoryDashboard: builder.query({
      query: () => ({ url: "/api/factory/dashboard" }),
      transformResponse: getItem,
      keepUnusedDataFor: FACTORY_CACHE_SECONDS,
      providesTags: () => [listTag("FactoryDashboard")],
    }),

    getStock: builder.query({
      query: (params = {}) => ({ url: "/api/stock", params }),
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      providesTags: (response) => [
        ...listResponseTags("Stock", response),
        listTag("StockHistory"),
      ],
    }),

    getStockDetail: builder.query({
      query: (productId) => ({ url: `/api/stock/${productId}` }),
      transformResponse: getItem,
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      providesTags: (response) => {
        const id = response?._id || response?.productId || response?.id;
        return id ? [listTag("Stock"), { type: "Stock", id }] : [listTag("Stock")];
      },
    }),

    getStockHistory: builder.query({
      query: ({ productId, ...params }) => ({
        url: `/api/stock/${productId}/history`,
        params,
      }),
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      providesTags: (_response, _error, arg) => [
        listTag("StockHistory"),
        ...(arg?.productId ? [{ type: "StockHistory", id: arg.productId }] : []),
      ],
    }),

    getAllStockHistory: builder.query({
      query: (params = {}) => ({ url: "/api/stock/history", params }),
      keepUnusedDataFor: STOCK_CACHE_SECONDS,
      providesTags: () => [listTag("StockHistory"), listTag("StockAdjustment")],
    }),

    updateStockQuantity: builder.mutation({
      query: ({ productId, payload }) => ({
        url: `/api/stock/${productId}`,
        method: "PATCH",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Stock"),
        listTag("StockHistory"),
        listTag("StockAdjustment"),
        listTag("FactoryDashboard"),
        ...(arg?.productId
          ? [
              { type: "Stock", id: arg.productId },
              { type: "StockHistory", id: arg.productId },
            ]
          : []),
      ],
    }),

    updateStockThreshold: builder.mutation({
      query: ({ productId, payload }) => ({
        url: `/api/stock/${productId}/threshold`,
        method: "PATCH",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [
        listTag("Stock"),
        listTag("StockHistory"),
        listTag("StockAdjustment"),
        listTag("FactoryDashboard"),
        ...(arg?.productId
          ? [
              { type: "Stock", id: arg.productId },
              { type: "StockHistory", id: arg.productId },
            ]
          : []),
      ],
    }),

    bulkUpdateStock: builder.mutation({
      query: (payload) => ({
        url: "/api/stock/bulk",
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: () => [
        listTag("Stock"),
        listTag("StockHistory"),
        listTag("StockAdjustment"),
        listTag("FactoryDashboard"),
      ],
    }),

    getFactoryOrders: builder.query({
      query: (params = {}) => ({ url: "/api/factory/orders", params }),
      keepUnusedDataFor: FACTORY_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("FactoryOrder", response),
    }),

    // Full verified-dealer directory, for the Invoice Center's Dealer filter
    // dropdown - mirrors useGetVerifiedDispatchersQuery's shape/usage on the
    // admin orders page (no pagination, populated once, cached).
    getFactoryDealers: builder.query({
      query: () => ({ url: "/api/factory/dealers" }),
      keepUnusedDataFor: FACTORY_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("FactoryDealer", response),
    }),

    getFactoryOrder: builder.query({
      query: (orderId) => ({ url: `/api/factory/orders/${orderId}` }),
      transformResponse: getItem,
      keepUnusedDataFor: FACTORY_CACHE_SECONDS,
      providesTags: (response) => itemResponseTags("FactoryOrder", response),
    }),

    markFactoryOrderOutForDelivery: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/factory/orders/${orderId}/mark-out-for-delivery`,
        method: "POST",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => [
        ...orderMutationTags(arg?.orderId),
        listTag("Stock"),
        listTag("StockHistory"),
        listTag("StockAdjustment"),
      ],
    }),

    markFactoryOrderDelivered: builder.mutation({
      query: ({ orderId, payload = {} }) => ({
        url: `/api/factory/orders/${orderId}/mark-delivered`,
        method: "POST",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    rejectFactoryOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/factory/orders/${orderId}/reject`,
        method: "POST",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    amendFactoryOrder: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/factory/orders/${orderId}/amend`,
        method: "POST",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    updateFactoryDispatchPrep: builder.mutation({
      query: ({ orderId, payload }) => ({
        url: `/api/factory/orders/${orderId}/dispatch-prep`,
        method: "PATCH",
        data: payload,
      }),
      transformResponse: getItem,
      invalidatesTags: (_result, _error, arg) => orderMutationTags(arg?.orderId),
    }),

    getProformaInvoice: builder.query({
      query: (orderId) => ({ url: `/api/factory/orders/${orderId}/proforma` }),
      transformResponse: getItem,
      keepUnusedDataFor: FACTORY_CACHE_SECONDS,
      providesTags: (_result, _error, orderId) => [
        listTag("FactoryInvoice"),
        listTag("ProformaInvoice"),
        ...(orderId ? [{ type: "FactoryInvoice", id: orderId }] : []),
        ...(orderId ? [{ type: "ProformaInvoice", id: orderId }] : []),
      ],
    }),

    issueFactoryInvoice: builder.mutation({
      query: (orderId) => ({
        url: `/api/factory/orders/${orderId}/invoice`,
        method: "POST",
      }),
      transformResponse: getItem,
      invalidatesTags: () => [listTag("FactoryOrder")],
    }),

    getAdminOrderStatementReport: builder.query({
      query: (params = {}) => ({
        url: "/api/admin/reports/order-statements",
        params,
      }),
      transformResponse: getItem,
      keepUnusedDataFor: REPORT_CACHE_SECONDS,
      providesTags: () => [listTag("Report"), { type: "Report", id: "ADMIN_ORDER_STATEMENT" }],
    }),

    getAdminInsights: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    // Account-keeping rebuild (see admin.insights.routes.js) - per-section
    // endpoints, lazy-loaded per active tab, rather than the single
    // combined getAdminInsights blob above.
    // Shared by create/update/delete: every one of them moves reserved
    // factory stock and changes what the factory queue is holding.
    getSchemeRecipients: builder.query({
      query: () => ({ url: "/api/admin/scheme-orders/recipients" }),
      transformResponse: getItems,
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: () => [listTag("SchemeOrder")],
    }),

    getSchemeOrders: builder.query({
      query: (params = {}) => ({ url: "/api/admin/scheme-orders", params }),
      transformResponse: getItems,
      providesTags: () => [listTag("SchemeOrder")],
    }),

    createSchemeOrder: builder.mutation({
      query: (body) => ({ url: "/api/admin/scheme-orders", method: "POST", body }),
      // A scheme reserves factory stock and lands in the factory queue,
      // so orders, stock and insights all change with it.
      invalidatesTags: () => SCHEME_ORDER_INVALIDATES,
    }),

    // Both only apply while the scheme is still in the factory's queue; the
    // server refuses once it has been dispatched. They invalidate the same
    // set as create - an amended basket moves reserved stock, and a deleted
    // scheme hands it back.
    updateSchemeOrder: builder.mutation({
      query: ({ orderId, ...body }) => ({
        url: `/api/admin/scheme-orders/${orderId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        ...SCHEME_ORDER_INVALIDATES,
        { type: "AdminOrder", id: arg?.orderId },
        { type: "Order", id: arg?.orderId },
      ],
    }),

    deleteSchemeOrder: builder.mutation({
      query: ({ orderId, reason = "" }) => ({
        url: `/api/admin/scheme-orders/${orderId}`,
        method: "DELETE",
        body: { reason },
      }),
      invalidatesTags: () => SCHEME_ORDER_INVALIDATES,
    }),

    getAdminInventoryOverview: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/inventory/overview", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminInsight")],
    }),

    getAdminFactoryStock: builder.query({
      query: () => ({ url: "/api/admin/insights/inventory/factory" }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminInsight")],
    }),

    getAdminDispatcherStockLevels: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/inventory/dispatcher", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminInsight")],
    }),

    getAdminDealerStockLevels: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/inventory/dealer", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminInsight")],
    }),

    getAdminStockMovements: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/inventory/movements", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminInsight")],
    }),

    getAdminPayablePartyList: builder.query({
      query: () => ({ url: "/api/admin/insights/payments/parties" }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminPayment")],
    }),

    getAdminPaymentLedger: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/payments", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminPayment")],
    }),

    getAdminPartyDues: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/payments/dues", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("AdminPayment")],
    }),

    getAdminAllocationPreview: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/payments/allocation-preview", params }),
      transformResponse: getItem,
    }),

    createAdminPayment: builder.mutation({
      query: (body) => ({ url: "/api/admin/insights/payments", method: "POST", body }),
      // A recorded payment changes AR, aging, reconciliation and cash
      // position, so the whole insights surface is invalidated with it.
      invalidatesTags: () => [listTag("AdminPayment"), listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminCashPosition: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/cash-position", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminPaymentReconciliation: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/reconciliation", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight"), listTag("Payment")],
    }),

    getAdminOrderAnalytics: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/orders", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    // Performance sub-tabs (see admin.insights.routes.js). Dealers
    // deliberately calls the existing, previously-orphaned dealer
    // leaderboard endpoint directly rather than a new insights-domain
    // proxy - it was already correct, just unwired to any frontend.
    getAdminDealerLeaderboard: builder.query({
      query: (params = {}) => ({ url: "/api/admin/dealers/analytics/leaderboard", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminProductPerformance: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/performance/products", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminDispatcherPerformance: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/performance/dispatchers", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminRoutingPerformance: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/performance/routing", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminArSummary: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/ar/summary", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminArAging: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights/ar/aging", params }),
      transformResponse: getItems,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),

    // Payments (verification queue) - the Payment model/routes were already
    // backend-complete but had zero frontend consumers before this section.
    getAdminPayments: builder.query({
      query: (params = {}) => ({ url: "/api/admin/payments", params }),
      transformResponse: (response) => ({
        items: response?.items || [],
        total: response?.total || 0,
        page: response?.page || 1,
        limit: response?.limit || 20,
      }),
      keepUnusedDataFor: WORKFLOW_CACHE_SECONDS,
      providesTags: (response) => listResponseTags("Payment", response),
    }),

    verifyAdminPayment: builder.mutation({
      query: ({ paymentId, note = "" }) => ({
        url: `/api/admin/payments/${paymentId}/verify`,
        method: "POST",
        data: { note },
      }),
      invalidatesTags: () => [listTag("Payment"), listTag("Insight"), listTag("AdminInsight")],
    }),

    rejectAdminPayment: builder.mutation({
      query: ({ paymentId, note = "" }) => ({
        url: `/api/admin/payments/${paymentId}/reject`,
        method: "POST",
        data: { note },
      }),
      invalidatesTags: () => [listTag("Payment"), listTag("Insight"), listTag("AdminInsight")],
    }),

    getAdminPointsCatalogProducts: builder.query({
      query: (params = {}) => ({ url: "/api/admin/points-catalog-products", params }),
      providesTags: (response) => listResponseTags("PointsCatalogProduct", response),
    }),

    getAdminPointsCatalogProduct: builder.query({
      query: (productId) => ({ url: `/api/admin/points-catalog-products/${productId}` }),
      providesTags: (_response, _error, productId) => [{ type: "PointsCatalogProduct", id: productId }],
    }),

    createPointsCatalogProduct: builder.mutation({
      query: (payload) => ({
        url: "/api/admin/points-catalog-products",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: () => [listTag("PointsCatalogProduct")],
    }),

    updatePointsCatalogProduct: builder.mutation({
      query: ({ productId, payload }) => ({
        url: `/api/admin/points-catalog-products/${productId}`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [listTag("PointsCatalogProduct"), { type: "PointsCatalogProduct", id: arg?.productId }],
    }),

    deletePointsCatalogProduct: builder.mutation({
      query: (productId) => ({
        url: `/api/admin/points-catalog-products/${productId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, productId) => [listTag("PointsCatalogProduct"), { type: "PointsCatalogProduct", id: productId }],
    }),

    getAdminPainters: builder.query({
      query: (params = {}) => ({ url: "/api/admin/painters", params }),
      providesTags: (response) => listResponseTags("Painter", response),
    }),

    getAdminPainter: builder.query({
      query: (painterId) => ({ url: `/api/admin/painters/${painterId}` }),
      providesTags: (_response, _error, painterId) => [{ type: "Painter", id: painterId }],
    }),

    createPainter: builder.mutation({
      query: (payload) => ({
        url: "/api/admin/painters",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: () => [listTag("Painter")],
    }),

    updatePainter: builder.mutation({
      query: ({ painterId, payload }) => ({
        url: `/api/admin/painters/${painterId}`,
        method: "PATCH",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [listTag("Painter"), { type: "Painter", id: arg?.painterId }],
    }),

    deletePainter: builder.mutation({
      query: (painterId) => ({
        url: `/api/admin/painters/${painterId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, painterId) => [listTag("Painter"), { type: "Painter", id: painterId }],
    }),

    promotePainterToTtp: builder.mutation({
      query: ({ painterId, payload }) => ({
        url: `/api/admin/painters/${painterId}/promote`,
        method: "POST",
        data: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [listTag("Painter"), { type: "Painter", id: arg?.painterId }],
    }),

    getPainterPoints: builder.query({
      query: ({ painterId, ...params }) => ({ url: `/api/admin/painters/${painterId}/points`, params }),
      providesTags: (_response, _error, arg) => [{ type: "Painter", id: `${arg?.painterId}:points` }],
    }),

    // Returns a fresh, short-lived Cloudinary download URL each call - never
    // cached/tagged, since a stale cached URL would just expire and 401.
    // Always triggered lazily (useLazyGetPainterIdCardUrlQuery) from a
    // button click, not rendered eagerly.
    getPainterIdCardUrl: builder.query({
      query: (painterId) => ({ url: `/api/admin/painters/${painterId}/id-card` }),
    }),

    // Same short-lived-signed-URL pattern as above, for the painter's saved
    // headshot - directly usable as an <img src> to show the real photo in
    // the "already generated" preview.
    getPainterIdCardPhotoUrl: builder.query({
      query: (painterId) => ({ url: `/api/admin/painters/${painterId}/id-card-photo` }),
    }),

    // The exact template artwork, unmodified - fetched once (lazily, on
    // first use of the photo-adjustment modal) and reused as the preview
    // backdrop so the "final card" preview is backed by the real design,
    // not a hand-recreated approximation. Same asset for every painter, so
    // RTK Query's default caching means this only ever hits the network once
    // per session.
    getPainterIdCardTemplate: builder.query({
      query: () => ({ url: "/api/admin/painters/id-card-template" }),
    }),

    // Regenerates the ID card with a headshot composited in. The photo is
    // never persisted server-side (see painter.service.js's comment) - it's
    // only ever this one multipart upload, used once to render the PDF.
    regeneratePainterIdCardWithPhoto: builder.mutation({
      query: ({ painterId, photoBlob }) => {
        const formData = new FormData();
        formData.append("photo", photoBlob, "photo.jpg");
        return {
          url: `/api/admin/painters/${painterId}/id-card`,
          method: "POST",
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: (_result, _error, arg) => [{ type: "Painter", id: arg?.painterId }],
    }),

    searchPainters: builder.query({
      query: (params) => ({ url: "/api/dealer/painters/search", params }),
      providesTags: () => [listTag("DealerPainterSearch")],
    }),

    registerRtpPainter: builder.mutation({
      query: (payload) => ({ url: "/api/dealer/painters", method: "POST", data: payload }),
      transformResponse: getItem,
      invalidatesTags: () => [listTag("DealerPainterSearch")],
    }),
  }),
});

export const {
  useGetNotificationSummaryQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useGetVapidPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useGetProductsQuery,
  useGetProductCategoriesQuery,
  useGetProductFamiliesQuery,
  useGetAdminProductCategoriesQuery,
  useRenameProductCategoryMutation,
  useGetAdminAnnouncementsQuery,
  useSendAdminAnnouncementMutation,
  usePreviewAnnouncementEmailMutation,
  useGetAdminProductFamiliesQuery,
  useGetAdminProductsQuery,
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useDeleteAdminProductMutation,
  useRestoreAdminProductMutation,
  useUploadAdminProductImageMutation,
  useDeleteAdminProductImageMutation,
  useUploadAdminFamilyImageMutation,
  useDeleteAdminFamilyImageMutation,
  useGetDealerOrdersQuery,
  useGetDealerOrderQuery,
  useCreateDealerOrderMutation,
  useGetMyOrderOutstandingQuery,
  useGetMyPaymentsQuery,
  useSubmitMyPaymentMutation,
  useGetDealerInventoryQuery,
  useGetDealerInventoryItemQuery,
  useGetDealerInventoryMovementsQuery,
  useGetDealerInventoryHistoryQuery,
  useGetDealerSalesQuery,
  useGetDealerSaleQuery,
  useCreateDealerSaleMutation,
  useVoidDealerSaleMutation,
  useGetCouponPreviewQuery,
  useRedeemCouponMutation,
  useGenerateCouponsMutation,
  useGetAdminCouponsQuery,
  useGetAdminCouponBatchesQuery,
  useGetCouponRedemptionHistoryQuery,
  useGetRewardSettingsQuery,
  useUpdateRewardSettingsMutation,
  useDeleteCouponMutation,
  useDeleteCouponBatchMutation,
  useDeleteCouponBatchesMutation,
  useGetCouponAttemptsQuery,
  useGetSettlementReportQuery,
  useGetAdminSalesQuery,
  useGetAdminSaleQuery,
  useGetAdminOrdersQuery,
  useGetAdminOrderQuery,
  useGetAdminOrderStockCheckQuery,
  useGetAdminScopedOrdersQuery,
  useGetAdminScopedOrderQuery,
  useLazyGetAdminScopedOrderQuery,
  useVerifyAdminOrderMutation,
  useRevertAdminOrderVerificationMutation,
  useEnsureProformaInvoiceMetadataMutation,
  useRejectAdminOrderMutation,
  useAmendAdminOrderMutation,
  useDeleteAdminOrderMutation,
  useGetDispatcherOrdersQuery,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrderStockCheckQuery,
  useGetDispatcherOrdersArchiveQuery,
  useVerifyDispatcherOrderMutation,
  useRejectDispatcherOrderMutation,
  useAmendDispatcherOrderMutation,
  useDispatchDispatcherOrderMutation,
  useCompleteDispatcherOrderMutation,
  useGetMyDispatcherStockQuery,
  useGetMyDispatcherStockHistoryQuery,
  useGetDispatcherReplenishmentCatalogQuery,
  useGetDispatcherReplenishmentOrdersQuery,
  useGetDispatcherReplenishmentOrderQuery,
  useCreateDispatcherReplenishmentOrderMutation,
  useGetAdminDealersQuery,
  useGetAdminDealerQuery,
  useGetAdminDealerAnalyticsQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminDealerInventoryMovementsQuery,
  useUpdateAdminDealerMutation,
  useUpdateAdminDealerStatusMutation,
  useDeleteAdminDealerMutation,
  useUndoDeleteAdminDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useResendDealerSetupEmailMutation,
  useAssignDispatcherToDealerMutation,
  useUnassignDispatcherFromDealerMutation,
  useGetAdminDealerApplicationsQuery,
  useGetAdminDealerApplicationQuery,
  useApproveDealerApplicationMutation,
  useRejectDealerApplicationMutation,
  useDeleteDealerApplicationMutation,
  useGetAdminDispatchersQuery,
  useGetAdminDispatcherApplicationsQuery,
  useGetVerifiedDispatchersQuery,
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherStockQuery,
  useGetAdminDispatcherAnalyticsQuery,
  useGetAdminDispatcherOwnOrdersQuery,
  useGetAdminDispatcherFulfilledOrdersQuery,
  useGetAdminDispatcherDealerStatsQuery,
  useGetAdminDispatcherProductSummaryQuery,
  useGetAdminDispatcherProductMovementsQuery,
  useResendDispatcherSetupEmailMutation,
  useGetDispatcherPricingSummaryQuery,
  useGetDispatcherPricingQuery,
  useUpdateDispatcherPricingMutation,
  useApproveDispatcherMutation,
  useRejectDispatcherMutation,
  useSetAdminDispatcherActiveMutation,
  useUpdateAdminDispatcherMutation,
  useDeleteAdminDispatcherMutation,
  useUndoAdminDispatcherDeletionMutation,
  useGetMyDispatcherProfileQuery,
  useGetDispatcherDealersQuery,
  useGetDispatcherDealerQuery,
  useGetFactoryDashboardQuery,
  useGetStockQuery,
  useGetStockDetailQuery,
  useGetStockHistoryQuery,
  useGetAllStockHistoryQuery,
  useUpdateStockQuantityMutation,
  useUpdateStockThresholdMutation,
  useBulkUpdateStockMutation,
  useGetFactoryOrdersQuery,
  useGetFactoryDealersQuery,
  useGetFactoryOrderQuery,
  useMarkFactoryOrderOutForDeliveryMutation,
  useMarkFactoryOrderDeliveredMutation,
  useRejectFactoryOrderMutation,
  useAmendFactoryOrderMutation,
  useUpdateFactoryDispatchPrepMutation,
  useGetProformaInvoiceQuery,
  useLazyGetProformaInvoiceQuery,
  useIssueFactoryInvoiceMutation,
  useLazyGetAdminOrderStatementReportQuery,
  useGetAdminInsightsQuery,
  useGetAdminCashPositionQuery,
  useGetAdminPaymentReconciliationQuery,
  useGetAdminOrderAnalyticsQuery,
  useGetAdminDealerLeaderboardQuery,
  useGetAdminProductPerformanceQuery,
  useGetAdminDispatcherPerformanceQuery,
  useGetAdminRoutingPerformanceQuery,
  useGetAdminArSummaryQuery,
  useGetAdminArAgingQuery,
  useGetAdminPaymentsQuery,
  useGetAdminPaymentLedgerQuery,
  useGetAdminInventoryOverviewQuery,
  useGetSchemeRecipientsQuery,
  useGetSchemeOrdersQuery,
  useCreateSchemeOrderMutation,
  useUpdateSchemeOrderMutation,
  useDeleteSchemeOrderMutation,
  useGetAdminFactoryStockQuery,
  useGetAdminDispatcherStockLevelsQuery,
  useGetAdminDealerStockLevelsQuery,
  useGetAdminStockMovementsQuery,
  useGetAdminPayablePartyListQuery,
  useGetAdminPartyDuesQuery,
  useGetAdminAllocationPreviewQuery,
  useCreateAdminPaymentMutation,
  useVerifyAdminPaymentMutation,
  useRejectAdminPaymentMutation,
  useGetAdminPointsCatalogProductsQuery,
  useGetAdminPointsCatalogProductQuery,
  useCreatePointsCatalogProductMutation,
  useUpdatePointsCatalogProductMutation,
  useDeletePointsCatalogProductMutation,
  useGetAdminPaintersQuery,
  useGetAdminPainterQuery,
  useCreatePainterMutation,
  useUpdatePainterMutation,
  useDeletePainterMutation,
  useGetPainterSalesQuery,
  usePromotePainterToTtpMutation,
  useGetPainterPointsQuery,
  useLazyGetPainterIdCardUrlQuery,
  useLazyGetPainterIdCardPhotoUrlQuery,
  useLazyGetPainterIdCardTemplateQuery,
  useRegeneratePainterIdCardWithPhotoMutation,
  useSearchPaintersQuery,
  useLazySearchPaintersQuery,
  useRegisterRtpPainterMutation,
} = meituApi;
