/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import RoomMaskTest from "./components/RoomMaskTest";
import NavBar from "./components/NavBar.jsx";
import Home from "./Home.jsx";
import RateCalculator from "./pages/RateCalculator.jsx";
import Dealership from "./pages/Dealership.jsx";
import DealershipRegistration from "./pages/DealershipRegistration.jsx";
import Horoscope from "./pages/Horoscope.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import Support from "./pages/Support.jsx";
import About from "./pages/About.jsx";
import Products from "./pages/Products.jsx";
import Granite from "./productsPages/Granite.jsx";
import Primer from "./productsPages/Primer.jsx";
import Specialty from "./productsPages/Specialty.jsx";
import Putting from "./productsPages/Putting.jsx";
import Regular from "./productsPages/Regular.jsx";
import Utilities from "./productsPages/Utilities.jsx";
import UtilitiesProducts from "./productsPages/UtilitiesProducts.jsx";
import RegularProducts from "./productsPages/RegularProducts.jsx";
import GraniteProducts from "./productsPages/GraniteProducts.jsx";
import PrimerProducts from "./productsPages/PrimerProducts.jsx";
import SpecialtyProducts from "./productsPages/SpecialtyProducts.jsx";
import PuttingProducts from "./productsPages/PuttingProducts.jsx";
import InquiryForm from "./productsPages/InquiryForm.jsx";
import ZodiacDetails from "./pages/ZodiacDetails.jsx";
import MeituColors from "./productsPages/meituColors.jsx";
import MeituTextures from "./productsPages/meituTextures.jsx";

import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
  Link,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import ScrollToTop from "./components/ScrollToTop.jsx";
import Footer from "./components/Footer.jsx";
import DraftOrderUtilityPage from "./components/dashboard/DraftOrderUtilityPage.jsx";

import { AuthProvider } from "./auth/AuthProvider.jsx";
import { useAuth } from "./auth/AuthProvider.jsx";
import { NotificationProvider } from "./notifications/NotificationProvider.jsx";

import UserLogin from "./pages/UserLogin.jsx";
import SetPassword from "./pages/SetPassword.jsx";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  ResendSetupLinkPage,
} from "./pages/AuthRecoveryPages.jsx";
import AdminDashboard from "./admin/dashboard/AdminDashboardPage.jsx";

import DealerDashboardPage from "./dealer/DealerDashboardPage.jsx";
import DealerHomePage from "./dealer/DealerHomePage.jsx";
import DealerCatalogPage from "./dealer/DealerCatalogPage.jsx";
import DealerCartPage from "./dealer/DealerCartPage.jsx";
import DealerOrdersPage from "./dealer/DealerOrdersPage.jsx";
import DealerOrderDetailPage from "./dealer/DealerOrderDetailPage.jsx";
import DealerInventoryPage from "./dealer/inventory/DealerInventoryPage.jsx";
import DealerInventoryDetailPage from "./dealer/inventory/DealerInventoryDetailPage.jsx";
import DealerSalesPage from "./dealer/sales/DealerSalesPage.jsx";
import CouponRedeemPage from "./dealer/coupons/CouponRedeemPage.jsx";

import { Provider } from "react-redux";
import store from "./redux/store.js";

import ProfilePage from "./profile/ProfilePage.jsx";
import NotificationCenterPage from "./notifications/NotificationCenterPage.jsx";

import AdminProductsPage from "./admin/catalog/AdminProductsPage.jsx";

import DispatcherOverviewPage from "./dispatcher/dashboard/DispatcherOverviewPage.jsx";
import DispatcherOrdersPage from "./dispatcher/dashboard/orders/DispatcherOrdersPage.jsx";
import DispatcherOrderDetailPage from "./dispatcher/dashboard/orders/DispatcherOrderDetailPage.jsx";
import DispatcherDealersPage from "./dispatcher/dashboard/dealers/DispatcherDealersPage.jsx";
import DispatcherDealerProfilePage from "./dispatcher/dashboard/dealers/DispatcherDealerProfilePage.jsx";
import DispatcherDealerOrdersPage from "./dispatcher/dashboard/dealers/DispatcherDealerOrdersPage.jsx";
import DispatcherProfileWorkspacePage from "./dispatcher/dashboard/DispatcherProfileWorkspacePage.jsx";
import DispatcherStockPage from "./dispatcher/dashboard/stock/DispatcherStockPage.jsx";
import DispatcherOrderCatalogPage from "./dispatcher/dashboard/order/DispatcherOrderCatalogPage.jsx";
import DispatcherOrderCartPage from "./dispatcher/dashboard/order/DispatcherOrderCartPage.jsx";
import DispatcherOrderHistoryPage from "./dispatcher/dashboard/order/DispatcherOrderHistoryPage.jsx";
import DispatcherRegisterPage from "./dispatcher/DispatcherRegisterPage.jsx";
import DispatcherDashboardPage from "./dispatcher/dashboard/DispatcherDashboardPage.jsx";
import DispatcherShopPage from "./dispatcher/DispatcherShopPage.jsx";
import DispatcherHomePage from "./dispatcher/DispatcherHomePage.jsx";
import FactoryDashboardPage from "./factory/FactoryDashboardPage.jsx";
import "./index.css";

function Layout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

function withFooter(element) {
  return (
    <>
      {element}
      <Footer />
    </>
  );
}

function RequireAdmin({ children }) {
  const { recoveringSession, user, sessionExpired } = useAuth();
  if (recoveringSession) return null;
  if (!user) return sessionExpired ? <SessionExpiredPrompt /> : <LoginRedirect />;
  if (String(user.role || "").toUpperCase() !== "ADMIN")
    return <NotFoundPage />;
  return children;
}

function RequireAuthenticated({ children }) {
  const { recoveringSession, user, sessionExpired } = useAuth();
  if (recoveringSession) return null;
  if (!user) return sessionExpired ? <SessionExpiredPrompt /> : <LoginRedirect />;
  return children;
}

function RequireDealer({ children }) {
  const { recoveringSession, user, sessionExpired } = useAuth();
  if (recoveringSession) return null;
  if (!user) return sessionExpired ? <SessionExpiredPrompt /> : <LoginRedirect />;
  if (String(user.role || "").toUpperCase() !== "DEALER")
    return <NotFoundPage />;
  return children;
}

function RequireDispatcher({ children }) {
  const { recoveringSession, user, sessionExpired } = useAuth();
  if (recoveringSession) return null;
  if (!user) return sessionExpired ? <SessionExpiredPrompt /> : <LoginRedirect />;
  if (String(user.role || "").toUpperCase() !== "DISPATCHER")
    return <NotFoundPage />;
  return children;
}

function RequireFactory({ children }) {
  const { recoveringSession, user, sessionExpired } = useAuth();
  if (recoveringSession) return null;
  if (!user) return sessionExpired ? <SessionExpiredPrompt /> : <LoginRedirect />;
  if (String(user.role || "").toUpperCase() !== "FACTORY")
    return <NotFoundPage />;
  return children;
}

function SessionExpiredPrompt() {
  return (
    <>
      <NavBar />
      <main className="se-root" aria-label="Session expired">
        <section className="se-card">
          <div className="se-status" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 11V7.5a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="se-kicker">Session ended</div>
          <h1 className="se-title">Please sign in again</h1>
          <p className="se-sub">
            Your session expired for security. Sign back in to pick up right where you left off.
          </p>

          <div className="se-actions">
            <Link className="se-btn primary" to="/login">
              Sign in
              <span aria-hidden="true">›</span>
            </Link>
            <Link className="se-btn text" to="/">
              Back to home
            </Link>
          </div>
        </section>
      </main>
      <style>{`
        .se-root{
          min-height: calc(100vh - 44px);
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(760px 420px at 50% 0%, rgba(0,113,227,.07), transparent 62%),
            var(--color-fog, #f5f5f7);
          font-family: var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif);
        }

        .se-card{
          width: min(420px, 100%);
          border-radius: 28px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          background: var(--color-snow, #ffffff);
          box-shadow: none;
          padding: clamp(26px, 5vw, 34px);
          text-align: center;
        }

        .se-status{
          width: 48px;
          height: 48px;
          margin: 0 auto;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--color-fog, #f5f5f7);
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          color: var(--color-ink, #1d1d1f);
        }

        .se-kicker{
          margin: 18px 0 0;
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          font-weight: 600;
          color: var(--color-graphite, #707070);
        }

        .se-title{
          margin: 8px 0 0;
          font-family: var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif);
          font-size: clamp(26px, 4vw, 32px);
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 700;
          color: var(--color-ink, #1d1d1f);
        }

        .se-sub{
          margin: 10px 0 0;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 400;
          color: var(--color-graphite, #707070);
        }

        .se-actions{
          margin-top: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .se-btn{
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 999px;
          padding: 0 20px;
          font-size: 16px;
          line-height: 1;
          letter-spacing: -0.1px;
          font-weight: 400;
          text-decoration: none;
          cursor: pointer;
          transition: opacity .1s ease, transform .1s ease;
        }

        .se-btn:hover{
          transform: translateY(-1px);
        }

        .se-btn.primary{
          background: var(--color-azure, #0071e3);
          color: #fff;
        }

        .se-btn.text{
          padding-inline: 0;
          background: transparent;
          color: var(--color-cobalt-link, #0066cc);
        }

        @media (prefers-reduced-motion: reduce){
          .se-btn{
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

function LoginRedirect() {
  const path =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search || ""}`;
  const returnTo = path && path !== "/login" ? path : "/";
  return (
    <Navigate
      to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
      replace
    />
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: withFooter(<Home />) },
      { path: "/ratecalculator", element: withFooter(<RateCalculator />) },
      { path: "/dealership", element: withFooter(<Dealership />) },
      {
        path: "/dealership/register",
        element: withFooter(<DealershipRegistration />),
      },
      { path: "/horoscope", element: withFooter(<Horoscope />) },
      { path: "/horoscope/:zodiac", element: withFooter(<ZodiacDetails />) },
      { path: "/support", element: withFooter(<Support />) },
      { path: "/about", element: withFooter(<About />) },
      { path: "/aboutus", element: withFooter(<About />) },
      { path: "/regular", element: withFooter(<Regular />) },
      { path: "/regular/:id", element: withFooter(<RegularProducts />) },
      { path: "/granite", element: withFooter(<Granite />) },
      { path: "/granite/:id", element: withFooter(<GraniteProducts />) },
      { path: "/primer", element: withFooter(<Primer />) },
      { path: "/primer/:id", element: withFooter(<PrimerProducts />) },
      { path: "/specialty", element: withFooter(<Specialty />) },
      { path: "/specialty/:id", element: withFooter(<SpecialtyProducts />) },
      { path: "/putting", element: withFooter(<Putting />) },
      { path: "/putting/:id", element: withFooter(<PuttingProducts />) },
      { path: "/utilities", element: withFooter(<Utilities />) },
      { path: "/utilities/:id", element: withFooter(<UtilitiesProducts />) },
      { path: "/products", element: withFooter(<Products />) },
      { path: "/inquiry", element: withFooter(<InquiryForm />) },
      { path: "/colors", element: withFooter(<MeituColors />) },
      { path: "/texture", element: withFooter(<MeituTextures />) },
      { path: "/textures", element: withFooter(<MeituTextures />) },
      { path: "/mask-test", element: withFooter(<RoomMaskTest />) },
      {
        path: "/dealer",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerHomePage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/catalog",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerCatalogPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/cart",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerCartPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/orders",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerOrdersPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/orders/:orderId",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerOrderDetailPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/inventory",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerInventoryPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/inventory/:productId",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerInventoryDetailPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        path: "/dealer/sales",
        element: (
          <RequireDealer>
            <DealerDashboardPage>
              <DealerSalesPage />
            </DealerDashboardPage>
          </RequireDealer>
        ),
      },
      {
        // Deliberately NOT wrapped in DealerDashboardPage's sidebar shell -
        // this is the QR-scan landing page, a focused single-task
        // confirmation screen (dealer at the counter, painter waiting),
        // not a page for browsing the dashboard. RequireDealer alone
        // already handles "not logged in -> /login?returnTo=/redeem/:token
        // -> back here after login" for free.
        path: "/redeem/:token",
        element: (
          <RequireDealer>
            <CouponRedeemPage />
          </RequireDealer>
        ),
      },

      {
        path: "/admin/products",
        element: (
          <RequireAdmin>
            <AdminProductsPage />
          </RequireAdmin>
        ),
      },

      // Dealer auth
      { path: "/login", element: withFooter(<UserLogin />) },
      { path: "/set-password", element: withFooter(<SetPassword />) },
      { path: "/forgot-password", element: withFooter(<ForgotPasswordPage />) },
      { path: "/reset-password", element: withFooter(<ResetPasswordPage />) },
      {
        path: "/resend-setup-link",
        element: withFooter(<ResendSetupLinkPage />),
      },

      // Admin
      {
        path: "/admin/orders",
        element: <Navigate to="/admin/dashboard/orders" replace />,
      },
      {
        path: "/admin/dashboard/*",
        element: (
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        ),
      },

      {
        path: "/profile",
        element: withFooter(
          <RequireAuthenticated>
            <ProfilePage />
          </RequireAuthenticated>,
        ),
      },
      {
        path: "/notifications",
        element: withFooter(
          <RequireAuthenticated>
            <NotificationCenterPage />
          </RequireAuthenticated>,
        ),
      },

      {
        path: "/dispatcher/apply",
        element: withFooter(<DispatcherRegisterPage />),
      },
      {
        path: "/factory/dashboard/*",
        element: (
          <RequireFactory>
            <FactoryDashboardPage />
          </RequireFactory>
        ),
      },
      {
        path: "/dispatcher/dashboard",
        element: (
          <RequireDispatcher>
            <DispatcherDashboardPage />
          </RequireDispatcher>
        ),
        children: [
          {
            index: true,
            element: <DispatcherOverviewPage />,
          },
          {
            path: "draft-order",
            element: (
              <DraftOrderUtilityPage
                roleLabel="Dispatcher Utility"
                title="Draft Order"
                subtitle="Calculate product totals for assigned dealer discussions. This page is only a pricing utility and does not submit an order."
              />
            ),
          },
          {
            path: "orders",
            element: <DispatcherOrdersPage />,
          },
          {
            path: "orders/:orderId",
            element: <DispatcherOrderDetailPage />,
          },
          {
            path: "dealers",
            element: <DispatcherDealersPage />,
          },
          {
            path: "notifications",
            element: <NotificationCenterPage embedded />,
          },
          {
            path: "profile",
            element: <DispatcherProfileWorkspacePage />,
          },
          {
            path: "dealers/:dealerId",
            element: <DispatcherDealerProfilePage />,
          },
          {
            path: "dealers/:dealerId/orders",
            element: <DispatcherDealerOrdersPage />,
          },
        ],
      },
      {
        // The dispatcher's own "buy replenishment stock from the factory"
        // workspace - deliberately a separate top-level route tree from
        // /dispatcher/dashboard (see DispatcherShopPage.jsx), the same way
        // /dealer is its own tree rather than living under an admin-style
        // /dealer/dashboard prefix.
        path: "/dispatcher",
        element: (
          <RequireDispatcher>
            <DispatcherShopPage />
          </RequireDispatcher>
        ),
        children: [
          { index: true, element: <DispatcherHomePage /> },
          { path: "catalog", element: <DispatcherOrderCatalogPage /> },
          { path: "cart", element: <DispatcherOrderCartPage /> },
          { path: "orders", element: <DispatcherOrderHistoryPage /> },
          { path: "inventory", element: <DispatcherStockPage /> },
        ],
      },

      // fallback
      { path: "*", element: withFooter(<NotFoundPage />) },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>,
);

import { setAccessToken } from "./api/client";

const savedToken = localStorage.getItem("accessToken");

if (savedToken) {
  setAccessToken(savedToken);
}
