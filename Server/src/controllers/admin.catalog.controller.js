import {
  listAllFamiliesService,
  createFamilyService,
  updateFamilyService,
  deleteFamilyService,
  restoreFamilyService,
  uploadFamilyImageService,
  setPrimaryFamilyImageService,
  deleteFamilyImageService,
  listAllProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
  restoreProductService,
} from "../services/admin.catalog.service.js";
import { listProductCategories } from "../services/product.service.js";

function handleError(res, error, fallback = "Request failed") {
  return res.status(400).json({
    ok: false,
    message: error.message || fallback,
  });
}

export async function listCategories(req, res) {
  try {
    const items = await listProductCategories({ includeInactive: true });
    return res.json({ ok: true, items });
  } catch (error) {
    return handleError(res, error, "Failed to fetch product categories");
  }
}

/* -----------------------------
   Product Family
----------------------------- */
export async function listFamilies(req, res) {
  try {
    const items = await listAllFamiliesService();
    return res.json({ ok: true, items });
  } catch (error) {
    return handleError(res, error, "Failed to fetch product families");
  }
}

export async function createFamily(req, res) {
  try {
    const item = await createFamilyService(req.body);
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to create product family");
  }
}

export async function updateFamily(req, res) {
  try {
    const item = await updateFamilyService(req.params.familyId, req.body);
    return res.json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to update product family");
  }
}

export async function deleteFamily(req, res) {
  try {
    const item = await deleteFamilyService(req.params.familyId);
    return res.json({ ok: true, item, message: "Product family deactivated" });
  } catch (error) {
    return handleError(res, error, "Failed to deactivate product family");
  }
}

export async function restoreFamily(req, res) {
  try {
    const item = await restoreFamilyService(req.params.familyId);
    return res.json({ ok: true, item, message: "Product family restored" });
  } catch (error) {
    return handleError(res, error, "Failed to restore product family");
  }
}

export async function uploadFamilyImage(req, res) {
  try {
    const item = await uploadFamilyImageService(req.params.familyId, req.file);
    return res.json({ ok: true, item, message: "Family image uploaded" });
  } catch (error) {
    return handleError(res, error, "Failed to upload family image");
  }
}

export async function setPrimaryFamilyImage(req, res) {
  try {
    const item = await setPrimaryFamilyImageService(
      req.params.familyId,
      req.body.publicId,
    );
    return res.json({ ok: true, item, message: "Primary image updated" });
  } catch (error) {
    return handleError(res, error, "Failed to set primary image");
  }
}

export async function deleteFamilyImage(req, res) {
  try {
    const item = await deleteFamilyImageService(
      req.params.familyId,
      req.params.publicId,
    );
    return res.json({ ok: true, item, message: "Family image deleted" });
  } catch (error) {
    return handleError(res, error, "Failed to delete family image");
  }
}

/* -----------------------------
   Product
----------------------------- */
export async function listProducts(req, res) {
  try {
    const items = await listAllProductsService();
    return res.json({ ok: true, items });
  } catch (error) {
    return handleError(res, error, "Failed to fetch products");
  }
}

export async function createProduct(req, res) {
  try {
    const item = await createProductService(req.body);
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to create product");
  }
}

export async function updateProduct(req, res) {
  try {
    const item = await updateProductService(req.params.productId, req.body);
    return res.json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to update product");
  }
}

export async function deleteProduct(req, res) {
  try {
    const item = await deleteProductService(req.params.productId);
    return res.json({ ok: true, item, message: "Product deactivated" });
  } catch (error) {
    return handleError(res, error, "Failed to deactivate product");
  }
}

export async function restoreProduct(req, res) {
  try {
    const item = await restoreProductService(req.params.productId);
    return res.json({ ok: true, item, message: "Product restored" });
  } catch (error) {
    return handleError(res, error, "Failed to restore product");
  }
}
