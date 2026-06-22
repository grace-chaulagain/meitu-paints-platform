import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";

export function getDealerProductOrderPath(productName = "") {
  const name = String(productName || "").trim();
  if (!name) return "/dealer/catalog";

  const params = new URLSearchParams();
  params.set("search", name);
  return `/dealer/catalog?${params.toString()}`;
}

export function getDealerProductLoginPath(productName = "") {
  const returnTo = getDealerProductOrderPath(productName);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export default function ProductOrderLink({
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
          ? getDealerProductOrderPath(productName)
          : getDealerProductLoginPath(productName)
      }
      className={className}
      {...props}
    >
      {children || (isDealer ? orderLabel : loginLabel)}
    </Link>
  );
}
