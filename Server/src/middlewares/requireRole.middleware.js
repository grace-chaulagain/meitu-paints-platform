import ApiError from "../utils/apiError.js";
import { ROLES } from "../constants/roles.js";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const requireRole = (...allowedRoles) => {
  return (req, _, next) => {
    const role = String(req.user?.role || "").toUpperCase();

    if (!role) {
      return next(
        new ApiError(401, "Authentication required", {
          code: "AUTH_REQUIRED",
        }),
      );
    }

    const normalizedAllowed = allowedRoles.map((r) =>
      String(r || "").toUpperCase(),
    );

    if (!normalizedAllowed.includes(role)) {
      return next(
        new ApiError(403, "Forbidden", {
          code: "FORBIDDEN",
        }),
      );
    }

    return next();
  };
};

export const requireRoleWithReadOnlyAdmin = (...allowedRoles) => {
  return (req, _, next) => {
    const role = String(req.user?.role || "").toUpperCase();

    if (!role) {
      return next(
        new ApiError(401, "Authentication required", {
          code: "AUTH_REQUIRED",
        }),
      );
    }

    const normalizedAllowed = allowedRoles.map((r) =>
      String(r || "").toUpperCase(),
    );

    if (normalizedAllowed.includes(role)) {
      return next();
    }

    const method = String(req.method || "").toUpperCase();
    const readOnlyAdminCanReadAdminRoute =
      role === ROLES.READ_ONLY_ADMIN &&
      normalizedAllowed.includes(ROLES.ADMIN) &&
      READ_ONLY_METHODS.has(method);

    if (readOnlyAdminCanReadAdminRoute) {
      return next();
    }

    return next(
      new ApiError(
        403,
        role === ROLES.READ_ONLY_ADMIN
          ? "Read-only admin cannot modify data"
          : "Forbidden",
        {
          code:
            role === ROLES.READ_ONLY_ADMIN
              ? "READ_ONLY_ADMIN_WRITE_BLOCKED"
              : "FORBIDDEN",
        },
      ),
    );
  };
};
