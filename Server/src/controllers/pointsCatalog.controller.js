import { asyncHandler } from "../utils/asyncHandler.js";
import * as pointsCatalogService from "../services/pointsCatalog.service.js";

export const listCatalogProductsController = asyncHandler(async (req, res) => {
  const { q, category, page, limit } = req.query || {};
  const out = await pointsCatalogService.listCatalogProducts({ q, category, page, limit });
  res.status(200).json({ ok: true, ...out });
});

export const getCatalogProductController = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const out = await pointsCatalogService.getCatalogProductById(productId);
  res.status(200).json({ ok: true, ...out });
});

export const createCatalogProductController = asyncHandler(async (req, res) => {
  const out = await pointsCatalogService.createCatalogProduct(req.body || {});
  res.status(201).json({ ok: true, ...out });
});

export const updateCatalogProductController = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const out = await pointsCatalogService.updateCatalogProduct(productId, req.body || {});
  res.status(200).json({ ok: true, ...out });
});

export const deleteCatalogProductController = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const out = await pointsCatalogService.deleteCatalogProduct(productId);
  res.status(200).json({ ok: true, ...out });
});
