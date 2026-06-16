/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import RoomMaskTest from "./components/RoomMaskTest";
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
import Enamel from "./productsPages/EnamelPage.jsx";
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
import AdminOrders from "./admin/dashboard/AdminDashboardPage.jsx";
import AdminDashboard from "./admin/dashboard/AdminDashboardPage.jsx";

import DealerCatalogPage from "./dealer/DealerCatalogPage.jsx";
import DealerCartPage from "./dealer/DealerCartPage.jsx";
import DealerOrderReportsPage from "./dealer/DealerOrderReportsPage.jsx";
import DealerOrdersPage from "./dealer/DealerOrdersPage.jsx";

import { Provider } from "react-redux";
import store from "./redux/store.js";

import ProfilePage from "./profile/ProfilePage.jsx";
import NotificationCenterPage from "./notifications/NotificationCenterPage.jsx";

import AdminProductsPage from "./admin/catalog/AdminProductsPage.jsx";

import DispatcherOverviewPage from "./dispatcher/dashboard/DispatcherOverviewPage.jsx";
import DispatcherOrdersPage from "./dispatcher/dashboard/orders/DispatcherOrdersPage.jsx";
import DispatcherDealersPage from "./dispatcher/dashboard/dealers/DispatcherDealersPage.jsx";
import DispatcherDealerProfilePage from "./dispatcher/dashboard/dealers/DispatcherDealerProfilePage.jsx";
import DispatcherDealerOrdersPage from "./dispatcher/dashboard/dealers/DispatcherDealerOrdersPage.jsx";
import DispatcherProfileWorkspacePage from "./dispatcher/dashboard/DispatcherProfileWorkspacePage.jsx";
import DispatcherRegisterPage from "./dispatcher/DispatcherRegisterPage.jsx";
import DispatcherDashboardPage from "./dispatcher/dashboard/DispatcherDashboardPage.jsx";

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

function SessionExpiredPrompt() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(760px 420px at 12% 6%, rgba(180,35,24,.10), transparent 58%), linear-gradient(180deg,#fbfbfc,#f2f4f7)",
      }}
    >
      <section
        style={{
          width: "min(440px, 100%)",
          borderRadius: 22,
          border: "1px solid rgba(15,23,42,.08)",
          background: "rgba(255,255,255,.94)",
          boxShadow: "0 24px 70px rgba(15,23,42,.10)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#b42318",
          }}
        >
          Secure Session Ended
        </div>
        <h1
          style={{
            margin: "10px 0 0",
            fontSize: 28,
            lineHeight: 1.05,
            fontWeight: 950,
            letterSpacing: "-.05em",
            color: "#0f172a",
          }}
        >
          Please sign in again
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            color: "rgba(15,23,42,.62)",
            fontSize: 14,
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          Your refresh session is no longer valid. Access tokens are refreshed
          automatically while your secure session is active.
        </p>
        <Link
          to="/login"
          style={{
            marginTop: 18,
            minHeight: 46,
            borderRadius: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 18px",
            background: "linear-gradient(135deg,#b42318,#ec6f3b)",
            color: "#fff",
            fontWeight: 950,
            textDecoration: "none",
            boxShadow: "0 16px 34px rgba(180,35,24,.18)",
          }}
        >
          Sign in
        </Link>
      </section>
    </main>
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
      { path: "/specialty/oth-002", element: withFooter(<Enamel />) },
      { path: "/textures", element: withFooter(<MeituTextures />) },
      { path: "/mask-test", element: withFooter(<RoomMaskTest />) },
      {
        path: "/dealer/catalog",
        element: withFooter(
          <RequireDealer>
            <DealerCatalogPage />
          </RequireDealer>,
        ),
      },
      {
        path: "/dealer/cart",
        element: withFooter(
          <RequireDealer>
            <DealerCartPage />
          </RequireDealer>,
        ),
      },
      {
        path: "/dealer/orders",
        element: withFooter(
          <RequireDealer>
            <DealerOrdersPage />
          </RequireDealer>,
        ),
      },
      {
        path: "/dealer/orders/reports",
        element: withFooter(
          <RequireDealer>
            <DealerOrderReportsPage />
          </RequireDealer>,
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
        element: (
          <RequireAdmin>
            <AdminOrders />
          </RequireAdmin>
        ),
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
