import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./baseQuery.js";

const CATALOG_CACHE_SECONDS = 20 * 60;

function getItems(response) {
  return response?.items || response?.products || [];
}

function getItem(response) {
  return response?.item || null;
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

export const meituApi = createApi({
  reducerPath: "meituApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Product", "ProductCategory", "ProductFamily"],
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
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
  }),
});

export const {
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
} = meituApi;
