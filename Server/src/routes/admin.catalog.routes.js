import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";
import { upload } from "../middlewares/upload.js";
import {
  listCategories,
  listFamilies,
  createFamily,
  updateFamily,
  deleteFamily,
  restoreFamily,
  uploadFamilyImage,
  setPrimaryFamilyImage,
  deleteFamilyImage,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
} from "../controllers/admin.catalog.controller.js";

const router = Router();

router.use(auth, requireRole("ADMIN"));

router.get("/categories", listCategories);

/* -----------------------------
   Product Families
----------------------------- */
router.get("/product-families", listFamilies);
router.post("/product-families", createFamily);
router.patch("/product-families/:familyId", updateFamily);
router.delete("/product-families/:familyId", deleteFamily);
router.post("/product-families/:familyId/restore", restoreFamily);

router.post(
  "/product-families/:familyId/image",
  upload.single("image"),
  uploadFamilyImage,
);
router.patch(
  "/product-families/:familyId/image/primary",
  setPrimaryFamilyImage,
);
router.delete(
  "/product-families/:familyId/image/:publicId",
  deleteFamilyImage,
);

/* -----------------------------
   Products
----------------------------- */
router.get("/products", listProducts);
router.post("/products", createProduct);
router.patch("/products/:productId", updateProduct);
router.delete("/products/:productId", deleteProduct);
router.post("/products/:productId/restore", restoreProduct);

export default router;
