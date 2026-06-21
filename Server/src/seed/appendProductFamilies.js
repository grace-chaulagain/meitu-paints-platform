import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import ProductFamily from "../models/ProductFamily.model.js";
import { MONGO_URI as CONFIG_MONGO_URI } from "../config/env.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "Append-meitu-productsFamily.json");

const normalizeText = (value = "") =>
  typeof value === "string" ? value.trim() : "";

const normalizeBoolean = (value, fallback = true) =>
  typeof value === "boolean" ? value : fallback;

const validateSeedDoc = (doc) => {
  if (!doc.code) throw new Error("Missing code in product family");
  if (!doc.name) throw new Error(`Missing name for family code ${doc.code}`);
  if (!doc.category) {
    throw new Error(`Missing category for family code ${doc.code}`);
  }

  if (!Array.isArray(doc.images)) {
    throw new Error(`Images must be an array for family code ${doc.code}`);
  }

  const primaryImages = doc.images.filter((img) => img.isPrimary);
  if (primaryImages.length > 1) {
    throw new Error(
      `Multiple primary images found for family code ${doc.code}`,
    );
  }
};

const normalizeImages = (images = [], familyName = "") => {
  if (!Array.isArray(images)) return [];

  const cleaned = images
    .filter((img) => img && typeof img === "object")
    .map((img) => ({
      url: normalizeText(img.url),
      publicId: normalizeText(img.publicId),
      alt: normalizeText(img.alt) || familyName,
      isPrimary: Boolean(img.isPrimary),
    }))
    .filter((img) => img.url && img.publicId);

  if (cleaned.length > 0 && !cleaned.some((img) => img.isPrimary)) {
    cleaned[0].isPrimary = true;
  }

  return cleaned;
};

const buildFamilyDocs = (parsed) => {
  if (!Array.isArray(parsed)) {
    throw new Error("Family append file must be a JSON array");
  }

  const seenCodes = new Set();

  return parsed.map((family) => {
    const code = normalizeText(family.code).toUpperCase();
    const name = normalizeText(family.name);
    const category = normalizeText(family.category);
    const description = normalizeText(family.description);
    const copyrightText = normalizeText(family.copyrightText);

    if (seenCodes.has(code)) {
      throw new Error(`Duplicate family code found in append file: ${code}`);
    }
    seenCodes.add(code);

    const doc = {
      code,
      name,
      category,
      description,
      copyrightText,
      images: normalizeImages(family.images, name),
      isActive: normalizeBoolean(family.isActive, true),
      meta: {
        source: normalizeText(family.meta?.source),
        notes: normalizeText(family.meta?.notes),
      },
    };

    validateSeedDoc(doc);
    return doc;
  });
};

const assertFamiliesDoNotExist = async (familyDocs) => {
  const codes = familyDocs.map((family) => family.code);
  const existingFamilies = await ProductFamily.find(
    { code: { $in: codes } },
    { code: 1, _id: 0 },
  ).lean();

  if (existingFamilies.length > 0) {
    const existingCodes = existingFamilies.map((family) => family.code).join(", ");
    throw new Error(
      `Cannot append product families because these codes already exist: ${existingCodes}`,
    );
  }
};

const appendProductFamilies = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || CONFIG_MONGO_URI;

    if (!mongoUri || typeof mongoUri !== "string") {
      throw new Error(
        "MONGO_URI is missing. Add it to Server/.env as MONGO_URI=... or ensure ../config/env.js exports it.",
      );
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB Connected");

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(rawData);

    const familyDocs = buildFamilyDocs(parsed);

    console.log(`Found ${familyDocs.length} product family documents to append`);

    await assertFamiliesDoNotExist(familyDocs);

    if (familyDocs.length === 0) {
      console.log("No product families to append");
      process.exit(0);
    }

    await ProductFamily.insertMany(familyDocs);
    console.log("Product families appended successfully");

    process.exit(0);
  } catch (error) {
    console.error("Family append failed");
    console.error(error.message);
    process.exit(1);
  }
};

appendProductFamilies();
