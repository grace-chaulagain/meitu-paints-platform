import { meituApi } from "./meituApi.js";

const EMPTY_ARRAY = [];

export const selectProductsResult = meituApi.endpoints.getProducts.select();
export const selectProductCategoriesResult =
  meituApi.endpoints.getProductCategories.select();
export const selectProductFamiliesResult =
  meituApi.endpoints.getProductFamilies.select();
export const selectAdminProductsResult = meituApi.endpoints.getAdminProducts.select();
export const selectAdminProductCategoriesResult =
  meituApi.endpoints.getAdminProductCategories.select();
export const selectAdminProductFamiliesResult =
  meituApi.endpoints.getAdminProductFamilies.select();

export const selectProducts = (state) =>
  selectProductsResult(state)?.data || EMPTY_ARRAY;

export const selectProductCategories = (state) =>
  selectProductCategoriesResult(state)?.data || EMPTY_ARRAY;

export const selectProductFamilies = (state) =>
  selectProductFamiliesResult(state)?.data || EMPTY_ARRAY;

export const selectAdminProducts = (state) =>
  selectAdminProductsResult(state)?.data || EMPTY_ARRAY;

export const selectAdminProductCategories = (state) =>
  selectAdminProductCategoriesResult(state)?.data || EMPTY_ARRAY;

export const selectAdminProductFamilies = (state) =>
  selectAdminProductFamiliesResult(state)?.data || EMPTY_ARRAY;

export function getQueryErrorMessage(error, fallback = "Request failed") {
  return (
    error?.message ||
    error?.data?.error ||
    error?.data?.message ||
    error?.error ||
    fallback
  );
}
