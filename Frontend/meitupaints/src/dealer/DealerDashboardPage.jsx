import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { DashboardUIStyles } from "../components/dashboard/DashboardUI.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

const SECTIONS = {
  CATALOG: "catalog",
  CART: "cart",
  ORDERS: "orders",
  INVENTORY: "inventory",
  SALES: "sales",
  LOGOUT: "logout",
};

const ROUTES = {
  [SECTIONS.CATALOG]: "/dealer/catalog",
  [SECTIONS.CART]: "/dealer/cart",
  [SECTIONS.ORDERS]: "/dealer/orders",
  [SECTIONS.INVENTORY]: "/dealer/inventory",
  [SECTIONS.SALES]: "/dealer/sales",
};

function sectionFromPath(pathname = "") {
  if (pathname.startsWith(ROUTES[SECTIONS.ORDERS])) return SECTIONS.ORDERS;
  if (pathname.startsWith(ROUTES[SECTIONS.CART])) return SECTIONS.CART;
  if (pathname.startsWith(ROUTES[SECTIONS.INVENTORY])) return SECTIONS.INVENTORY;
  if (pathname.startsWith(ROUTES[SECTIONS.SALES])) return SECTIONS.SALES;
  return SECTIONS.CATALOG;
}

export default function DealerDashboardPage({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const dealerProfile = useSelector((state) => state?.user?.dealerProfile || null);

  const active = sectionFromPath(location.pathname);

  const navGroups = [
    {
      label: "Sell",
      items: [
        { key: SECTIONS.CATALOG, title: "Catalog", icon: "store" },
        { key: SECTIONS.CART, title: "Cart", icon: "package" },
        { key: SECTIONS.ORDERS, title: "Orders", icon: "orders" },
      ],
    },
    {
      label: "Sales",
      items: [{ key: SECTIONS.SALES, title: "Sales Register", icon: "chart" }],
    },
    {
      label: "Inventory",
      items: [{ key: SECTIONS.INVENTORY, title: "Inventory", icon: "stock" }],
    },
    {
      label: "Session",
      items: [{ key: SECTIONS.LOGOUT, title: "Logout", icon: "logout" }],
    },
  ];

  function handleNavigate(item) {
    if (item.key === SECTIONS.LOGOUT) {
      logout();
      return;
    }
    navigate(ROUTES[item.key] || ROUTES[SECTIONS.CATALOG]);
  }

  return (
    <DashboardShell
      eyebrow="Meitu Dealer"
      title="Dealer Dashboard"
      accountLabel={dealerProfile?.contactName || user?.email || user?.username || "Dealer"}
      navGroups={navGroups}
      activeKey={active}
      onNavigate={handleNavigate}
    >
      <DashboardUIStyles />
      {children}
    </DashboardShell>
  );
}
