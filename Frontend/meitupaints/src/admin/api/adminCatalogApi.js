import { api } from "../../api/client.js";

function getItems(res) {
  return res?.data?.items || [];
}

function getItem(res) {
  return res?.data?.item || null;
}

function getPayload(res) {
  return res?.data || null;
}

/* =========================================================
   PRODUCT FAMILY APIs
========================================================= */

export async function getProductCategories() {
  const res = await api.get("/api/admin/catalog/categories");
  return getItems(res);
}

export async function getProductFamilies() {
  const res = await api.get("/api/admin/catalog/product-families");
  return getItems(res);
}

export async function createProductFamily(payload) {
  const res = await api.post("/api/admin/catalog/product-families", payload);
  return getItem(res);
}

export async function updateProductFamily(familyId, payload) {
  const res = await api.patch(
    `/api/admin/catalog/product-families/${familyId}`,
    payload,
  );
  return getItem(res);
}

export async function deleteProductFamily(familyId) {
  const res = await api.delete(
    `/api/admin/catalog/product-families/${familyId}`,
  );
  return getPayload(res);
}

export async function restoreProductFamily(familyId) {
  const res = await api.post(
    `/api/admin/catalog/product-families/${familyId}/restore`,
  );
  return getItem(res);
}

export async function uploadFamilyImage(familyId, file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await api.post(
    `/api/admin/catalog/product-families/${familyId}/image`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return getItem(res) || getPayload(res);
}

export async function setPrimaryFamilyImage(familyId, publicId) {
  const res = await api.patch(
    `/api/admin/catalog/product-families/${familyId}/image/primary`,
    { publicId },
  );

  return getItem(res) || getPayload(res);
}

export async function deleteFamilyImage(familyId, publicId) {
  const encodedPublicId = encodeURIComponent(publicId);
  const res = await api.delete(
    `/api/admin/catalog/product-families/${familyId}/image/${encodedPublicId}`,
  );

  return getItem(res) || getPayload(res);
}

/* =========================================================
   PRODUCT (VARIANT) APIs
========================================================= */

export async function getProducts() {
  const res = await api.get("/api/admin/catalog/products");
  return getItems(res);
}

export async function createProduct(payload) {
  const res = await api.post("/api/admin/catalog/products", payload);
  return getItem(res);
}

export async function updateProduct(productId, payload) {
  const res = await api.patch(
    `/api/admin/catalog/products/${productId}`,
    payload,
  );
  return getItem(res);
}

export async function deleteProduct(productId) {
  const res = await api.delete(`/api/admin/catalog/products/${productId}`);
  return getPayload(res);
}

export async function restoreProduct(productId) {
  const res = await api.post(
    `/api/admin/catalog/products/${productId}/restore`,
  );
  return getItem(res);
}

export async function uploadProductImage(productId, file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await api.post(
    `/api/admin/catalog/products/${productId}/image`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return getItem(res) || getPayload(res);
}

export async function setPrimaryProductImage(productId, publicId) {
  const res = await api.patch(
    `/api/admin/catalog/products/${productId}/image/primary`,
    { publicId },
  );

  return getItem(res) || getPayload(res);
}

export async function deleteProductImage(productId, publicId) {
  const encodedPublicId = encodeURIComponent(publicId);
  const res = await api.delete(
    `/api/admin/catalog/products/${productId}/image/${encodedPublicId}`,
  );

  return getItem(res) || getPayload(res);
}
