import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";

export function getDealerProductSearchTerm(product = null, fallbackName = "") {
  const id = String(product?.id || "").trim().toLowerCase();
  const category = String(product?.category || "").trim().toLowerCase();
  const name = String(product?.name || fallbackName || "").trim();
  const normalizedName = name.toLowerCase();

  if (category === "3d" || id.includes("3d") || normalizedName.includes("3d")) {
    return "3D";
  }

  if (
    category === "liquid" ||
    id.includes("liquid") ||
    normalizedName.includes("2d")
  ) {
    return "2D";
  }

  if (
    category === "floor" ||
    id.includes("floor") ||
    normalizedName.includes("floor paint")
  ) {
    return "Floor Paint";
  }

  if (
    category === "realstone" ||
    id.includes("realstone") ||
    normalizedName.includes("real stone")
  ) {
    return "Real Stone";
  }

  return name;
}

export function getDealerProductOrderPath(productName = "", product = null) {
  const name = getDealerProductSearchTerm(product, productName);
  if (!name) return "/dealer/catalog";

  const params = new URLSearchParams();
  params.set("search", name);
  return `/dealer/catalog?${params.toString()}`;
}

export function getDealerProductLoginPath(productName = "", product = null) {
  const returnTo = getDealerProductOrderPath(productName, product);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export default function ProductOrderLink({
  product,
  productName,
  className,
  orderLabel = "Order this product",
  loginLabel = "Login to order",
  children,
  ...props
}) {
  const { user } = useAuth();
  const isDealer = String(user?.role || "").toUpperCase() === "DEALER";

  return (
    <Link
      to={
        isDealer
          ? getDealerProductOrderPath(productName, product)
          : getDealerProductLoginPath(productName, product)
      }
      className={className}
      {...props}
    >
      {children || (isDealer ? orderLabel : loginLabel)}
    </Link>
  );
}
