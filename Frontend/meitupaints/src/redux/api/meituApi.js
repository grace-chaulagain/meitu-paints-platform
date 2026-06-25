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
      ]
    : [];

  return [
    listTag("Order"),
    listTag("AdminOrder"),
    listTag("DealerOrder"),
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
    "Notification",
    "Dashboard",
    "AdminDashboard",
    "DispatcherDashboard",
    "Report",
    "Insight",
    "AdminInsight",
  ],
  keepUnusedDataFor: 60,
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

    createDealerOrder: builder.mutation({
      query: (payload) => ({
        url: "/api/orders",
        method: "POST",
        data: payload,
      }),
      invalidatesTags: () => orderMutationTags(),
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

    resendDispatcherSetupEmail: builder.mutation({
      query: (dispatcherUserId) => ({
        url: `/api/admin/dispatchers/${dispatcherUserId}/resend-setup-email`,
        method: "POST",
      }),
      invalidatesTags: () => [listTag("Dispatcher")],
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

    getAdminOrderStatementReport: builder.query({
      query: (params = {}) => ({
        url: "/api/admin/reports/order-statements",
        params,
      }),
      transformResponse: getItem,
      keepUnusedDataFor: REPORT_CACHE_SECONDS,
      providesTags: () => [listTag("Report"), { type: "Report", id: "ADMIN_ORDER_STATEMENT" }],
    }),

    getDealerOrderStatementReport: builder.query({
      query: (params = {}) => ({
        url: "/api/dealer/reports/order-statements",
        params,
      }),
      transformResponse: getItem,
      keepUnusedDataFor: REPORT_CACHE_SECONDS,
      providesTags: () => [listTag("Report"), { type: "Report", id: "DEALER_ORDER_STATEMENT" }],
    }),

    getAdminInsights: builder.query({
      query: (params = {}) => ({ url: "/api/admin/insights", params }),
      transformResponse: getItem,
      keepUnusedDataFor: INSIGHT_CACHE_SECONDS,
      providesTags: () => [listTag("Insight"), listTag("AdminInsight")],
    }),
  }),
});

export const {
  useGetNotificationSummaryQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useGetProductsQuery,
  useGetProductCategoriesQuery,
  useGetProductFamiliesQuery,
  useGetAdminProductCategoriesQuery,
  useGetAdminProductFamiliesQuery,
  useGetAdminProductsQuery,
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useDeleteAdminProductMutation,
  useRestoreAdminProductMutation,
  useUploadAdminProductImageMutation,
  useUploadAdminFamilyImageMutation,
  useDeleteAdminFamilyImageMutation,
  useGetDealerOrdersQuery,
  useCreateDealerOrderMutation,
  useGetAdminOrdersQuery,
  useGetAdminOrderQuery,
  useGetAdminScopedOrdersQuery,
  useGetAdminScopedOrderQuery,
  useLazyGetAdminScopedOrderQuery,
  useVerifyAdminOrderMutation,
  useRejectAdminOrderMutation,
  useAmendAdminOrderMutation,
  useDeleteAdminOrderMutation,
  useGetDispatcherOrdersQuery,
  useGetDispatcherOrderQuery,
  useGetDispatcherOrdersArchiveQuery,
  useVerifyDispatcherOrderMutation,
  useRejectDispatcherOrderMutation,
  useAmendDispatcherOrderMutation,
  useGetAdminDealersQuery,
  useGetAdminDealerQuery,
  useGetAdminDealerAnalyticsQuery,
  useUpdateAdminDealerMutation,
  useUpdateAdminDealerStatusMutation,
  useDeleteAdminDealerMutation,
  useUndoDeleteAdminDealerMutation,
  useUpdateAdminDealerRoutingMutation,
  useResendDealerSetupEmailMutation,
  useAssignDispatcherToDealerMutation,
  useUnassignDispatcherFromDealerMutation,
  useGetAdminDealerApplicationsQuery,
  useApproveDealerApplicationMutation,
  useRejectDealerApplicationMutation,
  useDeleteDealerApplicationMutation,
  useGetAdminDispatchersQuery,
  useGetAdminDispatcherApplicationsQuery,
  useGetVerifiedDispatchersQuery,
  useGetAdminDispatcherQuery,
  useResendDispatcherSetupEmailMutation,
  useApproveDispatcherMutation,
  useRejectDispatcherMutation,
  useSetAdminDispatcherActiveMutation,
  useUpdateAdminDispatcherMutation,
  useDeleteAdminDispatcherMutation,
  useUndoAdminDispatcherDeletionMutation,
  useGetMyDispatcherProfileQuery,
  useGetDispatcherDealersQuery,
  useLazyGetAdminOrderStatementReportQuery,
  useLazyGetDealerOrderStatementReportQuery,
  useGetAdminInsightsQuery,
} = meituApi;
