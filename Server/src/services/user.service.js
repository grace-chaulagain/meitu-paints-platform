import streamifier from "streamifier";
import User from "../models/User.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import cloudinary from "../utils/cloudinary.js";
import bcrypt from "bcrypt";

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "meitu-user-avatars", resource_type: "image", ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export const uploadUserAvatar = async (userId, file) => {
  if (!file?.buffer) throw new Error("Image file is required");
  if (!String(file.mimetype || "").startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const previousPublicId = user.avatar?.publicId || "";

  const result = await uploadBufferToCloudinary(file.buffer, {
    public_id: `avatar-${userId}-${Date.now()}`,
    overwrite: false,
  });

  user.avatar = { url: result.secure_url, publicId: result.public_id };
  await user.save();

  if (previousPublicId) {
    try {
      await cloudinary.uploader.destroy(previousPublicId);
    } catch (error) {
      console.warn("[user] Failed to delete replaced avatar from Cloudinary:", error?.message || error);
    }
  }

  return user;
};

export const updateCurrentUserProfile = async (userId, role, payload = {}) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const safePayload = payload && typeof payload === "object" ? payload : {};
  const normalizedRole = String(role || "").toUpperCase();

  let updatedUser = user;
  let updatedDealerProfile = null;

  if (normalizedRole === "DEALER") {
    const allowedFields = ["contactName", "phone", "address"];

    const dealer = await DealerProfile.findById(user.dealerId);
    if (!dealer) throw new Error("Dealer profile not found");

    allowedFields.forEach((field) => {
      if (safePayload[field] !== undefined) {
        dealer[field] = safePayload[field];
      }
    });

    await dealer.save();
    updatedDealerProfile = dealer;
  }

  if (normalizedRole === "ADMIN") {
    const allowedFields = ["username", "phone"];

    allowedFields.forEach((field) => {
      if (safePayload[field] !== undefined) {
        updatedUser[field] = safePayload[field];
      }
    });

    await updatedUser.save();
  }

  return {
    user: updatedUser,
    dealerProfile: updatedDealerProfile,
  };
};

export const changeCurrentUserPassword = async (
  userId,
  currentPassword,
  newPassword,
) => {
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    throw new Error("Invalid password input");
  }

  const trimmedCurrentPassword = currentPassword.trim();
  const trimmedNewPassword = newPassword.trim();

  if (!trimmedCurrentPassword || !trimmedNewPassword) {
    throw new Error("Both passwords are required");
  }

  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new Error("User not found");

  if (!user.passwordHash || typeof user.passwordHash !== "string") {
    throw new Error("Stored password not available for verification");
  }

  const isMatch = await bcrypt.compare(
    trimmedCurrentPassword,
    user.passwordHash,
  );

  if (!isMatch) {
    throw new Error("Current password is incorrect");
  }

  const hashed = await bcrypt.hash(trimmedNewPassword, 10);
  user.passwordHash = hashed;
  user.passwordSetAt = new Date();

  await user.save();

  return true;
};
