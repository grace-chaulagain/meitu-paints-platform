import {
  updateCurrentUserProfile,
  changeCurrentUserPassword,
  uploadUserAvatar,
} from "../services/user.service.js";

// POST /api/users/me/avatar
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "Image file is required",
      });
    }

    const user = await uploadUserAvatar(req.user.sub, req.file);

    return res.status(200).json({
      ok: true,
      message: "Profile photo updated successfully",
      avatarUrl: user.avatar?.url || null,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: err?.message || "Failed to upload profile photo",
    });
  }
};

// PATCH /api/users/me
export const updateMe = async (req, res) => {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user.sub;
    const role = req.user.role;
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    const result = await updateCurrentUserProfile(userId, role, payload);

    return res.status(200).json({
      ok: true,
      message: "Profile updated successfully",
      user: result.user,
      dealerProfile: result.dealerProfile,
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: err?.message || "Failed to update profile",
    });
  }
};

// POST /api/users/change-password
export const changePassword = async (req, res) => {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user.sub;
    const { currentPassword, newPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        message: "Invalid password input",
      });
    }

    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();

    if (!trimmedCurrentPassword || !trimmedNewPassword) {
      return res.status(400).json({
        ok: false,
        message: "Both passwords are required",
      });
    }

    if (trimmedNewPassword.length < 8) {
      return res.status(400).json({
        ok: false,
        message: "New password must be at least 8 characters long",
      });
    }

    if (trimmedCurrentPassword === trimmedNewPassword) {
      return res.status(400).json({
        ok: false,
        message: "New password must be different from current password",
      });
    }

    await changeCurrentUserPassword(
      userId,
      trimmedCurrentPassword,
      trimmedNewPassword,
    );

    return res.status(200).json({
      ok: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: err?.message || "Failed to update password",
    });
  }
};
