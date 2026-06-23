import {
  listActiveProducts,
  listProductCategories,
} from "../services/product.service.js";
import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import Product from "../models/Product.model.js";

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "meitu-products" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

export const uploadProductImage = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!req.file) throw new Error("No file uploaded");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    const result = await uploadToCloudinary(req.file.buffer);

    product.images.push({
      url: result.secure_url,
      publicId: result.public_id,
      alt: product.name,
      isPrimary: product.images.length === 0,
    });

    await product.save();

    res.json({
      ok: true,
      images: product.images,
    });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export async function listProductsController(req, res, next) {
  try {
    const { q, category } = req.query;

    const items = await listActiveProducts({ q, category });

    res.status(200).json({
      ok: true,
      items,
    });
  } catch (error) {
    next(error);
  }
}

export async function listProductCategoriesController(req, res, next) {
  try {
    const items = await listProductCategories();

    res.status(200).json({
      ok: true,
      items,
    });
  } catch (error) {
    next(error);
  }
}
