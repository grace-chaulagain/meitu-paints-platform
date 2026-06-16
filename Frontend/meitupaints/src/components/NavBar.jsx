// NavBar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import "bootstrap/dist/css/bootstrap.min.css";

import { useAuth } from "../auth/AuthProvider.jsx";
import { useNotifications } from "../notifications/notificationContext.js";
import SEARCH_ITEMS from "../ProductsList/allProductsSearch.json";

function formatBadgeCount(count) {
  const value = Number(count || 0);
  if (value <= 0) return "";
  return value > 99 ? "99+" : String(value);
}

const PRODUCT_MENU_ITEMS = [
  {
    label: "Buckets",
    description: "Browse paint product systems",
    href: "/products",
  },
  {
    label: "Colors",
    description: "Explore the Meitu color library",
    href: "/colors",
  },
  {
    label: "Textures",
    description: "Review texture and finish options",
    href: "/textures",
  },
];

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const notifications = useNotifications();

  const reduxUser = useSelector((state) => state?.user?.user || null);
  const reduxRole = useSelector((state) => state?.user?.role || null);

  const account = useMemo(() => {
    const source = reduxUser || user || null;
    const username =
      source?.username ||
      source?.name ||
      source?.fullName ||
      source?.contactName ||
      (source?.email ? String(source.email).split("@")[0] : "Meitu User");

    return {
      email: source?.email || "dealer@meitu.com",
      username,
      role: String(reduxRole || source?.role || "USER").toUpperCase(),
      initial: String(username || "U")
        .trim()
        .charAt(0)
        .toUpperCase(),
    };
  }, [reduxRole, reduxUser, user]);

  const profileHref = "/profile";
  const dashboardHref = "/admin/dashboard";
  const dispatcherDashboardHref = "/dispatcher/dashboard";
  const adminCatalogHref = "/admin/products";
  const dealerCatalogHref = "/dealer/catalog";
  const dealerOrdersHref = "/dealer/orders";
  const notificationsHref = "/notifications";
  const unreadBadge = formatBadgeCount(notifications?.totalUnread || 0);

  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navShellRef = useRef(null);
  const brandRef = useRef(null);
  const navCenterRef = useRef(null);
  const navAuthRef = useRef(null);
  const desktopWidthRef = useRef(0);
  const profileWrapRef = useRef(null);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchWrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);

    const onClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }

      if (
        profileWrapRef.current &&
        !profileWrapRef.current.contains(e.target)
      ) {
        setProfileMenuOpen(false);
      }

      setDropdownOpen(false);
      setMobileOpen(false);
    };

    const onEscape = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setActiveIndex(-1);
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener("scroll", onScroll);
    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const shell = navShellRef.current;
    if (!shell || typeof window === "undefined") return undefined;

    const measure = () => {
      const shellWidth = shell.getBoundingClientRect().width;
      const styles = window.getComputedStyle(shell);
      const horizontalPadding =
        parseFloat(styles.paddingLeft || "0") +
        parseFloat(styles.paddingRight || "0");
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const brandWidth =
        brandRef.current?.getBoundingClientRect().width || 0;
      const centerWidth =
        navCenterRef.current?.scrollWidth ||
        navCenterRef.current?.getBoundingClientRect().width ||
        0;
      const authWidth = navAuthRef.current?.getBoundingClientRect().width || 0;
      const preferredSearchWidth = 220;
      const desktopItemCount = 4;
      const measuredDesktopWidth =
        horizontalPadding +
        brandWidth +
        centerWidth +
        preferredSearchWidth +
        authWidth +
        gap * (desktopItemCount - 1);

      if (!navCollapsed) {
        const requiredWidth = Math.max(measuredDesktopWidth, shell.scrollWidth);
        desktopWidthRef.current = requiredWidth;
        setNavCollapsed(requiredWidth > shellWidth + 1);
        return;
      }

      const requiredWidth = desktopWidthRef.current || 1180;
      const shouldCollapse = shellWidth < requiredWidth + 12;
      setNavCollapsed((current) => {
        if (current && !shouldCollapse) setMobileOpen(false);
        return shouldCollapse;
      });
    };

    const frame = window.requestAnimationFrame(measure);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(shell);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [account.role, account.username, navCollapsed, unreadBadge]);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const productsActive = PRODUCT_MENU_ITEMS.some((item) =>
    isActive(item.href),
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const score = (item) => {
      const name = (item.name || "").toLowerCase();
      const id = (item.id || "").toLowerCase();
      const cat = (item.meta?.category || "").toLowerCase();

      let s = 0;
      if (name.startsWith(q)) s += 4;
      if (name.includes(q)) s += 2;
      if (id.startsWith(q)) s += 2;
      if (id.includes(q)) s += 1;
      if (cat.includes(q)) s += 0.5;

      const tokens = q.split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        if (name.includes(t)) s += 0.5;
        if (id.includes(t)) s += 0.25;
      }
      return s;
    };

    return SEARCH_ITEMS.map((item) => ({ item, s: score(item) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.item);
  }, [query]);

  const goToItem = (item) => {
    if (!item?.route) return;
    setSearchOpen(false);
    setActiveIndex(-1);
    setQuery("");
    navigate(item.route);
  };

  const onSearchKeyDown = (e) => {
    if (!searchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      if (results.length) setSearchOpen(true);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!results.length) return;
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      if (!results.length) return;
      e.preventDefault();
      const chosen = results[activeIndex] || results[0];
      goToItem(chosen);
      return;
    }

    if (e.key === "Escape") {
      setSearchOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleLogout = async () => {
    try {
      setProfileMenuOpen(false);
      await logout();
      navigate("/login");
    } catch {
      navigate("/login");
    }
  };

  const renderProfileMenu = () => (
    <div className="account-menu" role="menu" aria-label="Account menu">
      <div className="account-menu-head">
        <div className="account-avatar-large">{account.initial}</div>

        <div className="account-identity">
          <div className="account-name">{account.username}</div>
          <div className="account-email">{account.email}</div>
        </div>
      </div>

      <div className="account-role-badge">{account.role}</div>

      <div className="account-actions">
        <Link
          to={profileHref}
          className="account-link-btn"
          role="menuitem"
          onClick={() => setProfileMenuOpen(false)}
        >
          View Profile
        </Link>

        {account.role === "ADMIN" ? (
          <>
            <Link
              to={dashboardHref}
              className="account-link-btn"
              role="menuitem"
              onClick={() => setProfileMenuOpen(false)}
            >
              <span>Dashboard</span>
              {unreadBadge ? (
                <span className="account-menu-badge">{unreadBadge}</span>
              ) : null}
            </Link>

            <Link
              to={adminCatalogHref}
              className="account-link-btn"
              role="menuitem"
              onClick={() => setProfileMenuOpen(false)}
            >
              Catalog
            </Link>
          </>
        ) : null}

        {account.role === "DEALER" ? (
          <>
            <Link
              to={dealerCatalogHref}
              className="account-link-btn"
              role="menuitem"
              onClick={() => setProfileMenuOpen(false)}
            >
              Order
            </Link>

            <Link
              to={dealerOrdersHref}
              className="account-link-btn"
              role="menuitem"
              onClick={() => setProfileMenuOpen(false)}
            >
              History
            </Link>
          </>
        ) : null}

        {account.role === "DISPATCHER" ? (
          <Link
            to={dispatcherDashboardHref}
            className="account-link-btn"
            role="menuitem"
            onClick={() => setProfileMenuOpen(false)}
          >
            <span>Dashboard</span>
            {unreadBadge ? (
              <span className="account-menu-badge">{unreadBadge}</span>
            ) : null}
          </Link>
        ) : null}

        {notifications?.enabled ? (
          <Link
            to={notificationsHref}
            className="account-link-btn"
            role="menuitem"
            onClick={() => setProfileMenuOpen(false)}
          >
            <span>Notifications</span>
            {unreadBadge ? (
              <span className="account-menu-badge">{unreadBadge}</span>
            ) : null}
          </Link>
        ) : null}

        <button
          type="button"
          className="account-logout-btn"
          role="menuitem"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <nav
        className={`apple-nav ${scrolled ? "scrolled" : ""} ${
          navCollapsed ? "collapsed" : ""
        }`}
      >
        <div className="nav-shell" ref={navShellRef}>
          <Link to="/" className="brand" ref={brandRef}>
            <img
              src="/meitulogo.svg"
              alt="MEITU Paints"
              width="50"
              height="50"
            />
            <div className="brand-text">
              <span className="brand-main">MEITU</span>
              <span className="brand-sub">PAINTS</span>
            </div>
          </Link>

          <div className="nav-center" ref={navCenterRef}>
            <Link
              className={`nav-item ${isActive("/") ? "active" : ""}`}
              to="/"
            >
              Home
            </Link>

            <div
              className={`nav-item dropdown ${dropdownOpen ? "open" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
              onFocus={() => setDropdownOpen(true)}
            >
              <button
                type="button"
                className={`products-menu-button ${
                  productsActive ? "active" : ""
                }`}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((v) => !v);
                }}
              >
                Products
                <span aria-hidden="true">⌄</span>
              </button>
              <div className="dropdown-panel">
                <div className="dropdown-grid">
                  {PRODUCT_MENU_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="dropdown-card"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="dropdown-card-mark" aria-hidden="true" />
                      <span className="dropdown-card-copy">
                        <span>{item.label}</span>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              className={`nav-item ${
                isActive("/ratecalculator") ? "active" : ""
              }`}
              to="/ratecalculator"
            >
              Rate Calculator
            </Link>

            <Link
              className={`nav-item ${isActive("/dealership") ? "active" : ""}`}
              to="/dealership"
            >
              Dealership
            </Link>

            <Link
              className={`nav-item ${isActive("/about") ? "active" : ""}`}
              to="/about"
            >
              About Us
            </Link>

            <Link
              className={`nav-item ${isActive("/support") ? "active" : ""}`}
              to="/support"
            >
              Support
            </Link>
          </div>

          <button
            className={`mobile-toggle ${mobileOpen ? "open" : ""}`}
            aria-label="Toggle navigation"
            onClick={(e) => {
              e.stopPropagation();
              setMobileOpen((v) => !v);
            }}
          >
            <span />
            <span />
          </button>

          <div
            className="nav-search"
            ref={searchWrapRef}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="search-icon">⌕</span>
            <input
              ref={inputRef}
              type="search"
              placeholder="Search products"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setSearchOpen(!!v.trim());
                setActiveIndex(-1);
              }}
              onFocus={() => {
                if (query.trim()) setSearchOpen(true);
              }}
              onKeyDown={onSearchKeyDown}
            />

            {searchOpen && results.length > 0 && (
              <div
                className="search-panel"
                role="listbox"
                aria-label="Search results"
              >
                {results.map((r, idx) => {
                  const active = idx === activeIndex;

                  return (
                    <Link
                      key={`${r.type}-${r.id}`}
                      to={r.route}
                      className={`search-row ${active ? "active" : ""}`}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchOpen(false);
                        setActiveIndex(-1);
                        setQuery("");
                      }}
                    >
                      <div className="sr-main">{r.name}</div>
                      <div className="sr-sub">
                        {r.meta?.category || "product"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {searchOpen && query.trim() && results.length === 0 && (
              <div className="search-panel empty" aria-label="No results">
                <div className="empty-title">No results</div>
                <div className="empty-sub">Try a product name or ID.</div>
              </div>
            )}
          </div>

          <div
            className="nav-auth"
            ref={navAuthRef}
            onClick={(e) => e.stopPropagation()}
          >
            {!user ? (
              <Link to="/login" className="auth-btn">
                Login
              </Link>
            ) : (
              <>
                {notifications?.enabled ? (
                  <Link
                    to={notificationsHref}
                    className="notification-trigger"
                    aria-label="Open notifications"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.7 21a2 2 0 0 1-3.4 0"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {unreadBadge ? (
                      <span className="notification-badge">{unreadBadge}</span>
                    ) : null}
                  </Link>
                ) : null}

                <div className="profile-wrap" ref={profileWrapRef}>
                  <button
                    type="button"
                    className={`account-trigger ${profileMenuOpen ? "open" : ""}`}
                    aria-label="Open account menu"
                    aria-haspopup="menu"
                    aria-expanded={profileMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileMenuOpen((v) => !v);
                    }}
                  >
                    <span className="account-avatar-small">
                      {account.initial}
                      {unreadBadge ? (
                        <span className="account-avatar-badge">
                          {unreadBadge}
                        </span>
                      ) : null}
                    </span>

                    <span className="account-trigger-text">
                      <span className="account-trigger-name">
                        {account.username}
                      </span>
                      <span className="account-trigger-role">{account.role}</span>
                    </span>
                  </button>

                  {profileMenuOpen && renderProfileMenu()}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="nav-spacer" aria-hidden="true" />

      <div className={`mobile-nav ${mobileOpen ? "show" : ""}`}>
        <Link to="/" onClick={() => setMobileOpen(false)}>
          Home
        </Link>
        <div className="mobile-nav-group">
          <div className="mobile-nav-heading">Products</div>
          {PRODUCT_MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link to="/ratecalculator" onClick={() => setMobileOpen(false)}>
          Rate Calculator
        </Link>
        <Link to="/dealership" onClick={() => setMobileOpen(false)}>
          Dealership
        </Link>
        <Link to="/horoscope" onClick={() => setMobileOpen(false)}>
          Horoscope
        </Link>
        <Link to="/about" onClick={() => setMobileOpen(false)}>
          About Us
        </Link>
        <Link to="/support" onClick={() => setMobileOpen(false)}>
          Support
        </Link>
        {!user ? (
          <Link to="/login" onClick={() => setMobileOpen(false)}>
            Login
          </Link>
        ) : (
          <>
            <Link to={profileHref} onClick={() => setMobileOpen(false)}>
              Profile
            </Link>

            {account.role === "ADMIN" ? (
              <>
                <Link to={dashboardHref} onClick={() => setMobileOpen(false)}>
                  Dashboard{unreadBadge ? ` (${unreadBadge})` : ""}
                </Link>
                <Link
                  to={adminCatalogHref}
                  onClick={() => setMobileOpen(false)}
                >
                  Catalog
                </Link>
              </>
            ) : null}

            {account.role === "DEALER" ? (
              <>
                <Link
                  to={dealerCatalogHref}
                  onClick={() => setMobileOpen(false)}
                >
                  Order
                </Link>
                <Link
                  to={dealerOrdersHref}
                  onClick={() => setMobileOpen(false)}
                >
                  History
                </Link>
              </>
            ) : null}

            {account.role === "DISPATCHER" ? (
              <Link
                to={dispatcherDashboardHref}
                onClick={() => setMobileOpen(false)}
              >
                Dashboard{unreadBadge ? ` (${unreadBadge})` : ""}
              </Link>
            ) : null}

            {notifications?.enabled ? (
              <Link
                to={notificationsHref}
                onClick={() => setMobileOpen(false)}
              >
                Notifications{unreadBadge ? ` (${unreadBadge})` : ""}
              </Link>
            ) : null}

            <button
              type="button"
              className="mobile-logout"
              onClick={async () => {
                setMobileOpen(false);
                await logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>

      <style>{`
        .nav-auth{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          flex:0 0 auto;
          gap:10px;
        }

        .nav-spacer{
          height:70px;
          flex:0 0 auto;
        }

        .notification-trigger{
          position:relative;
          width:44px;
          height:44px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:#0f172a;
          text-decoration:none;
          background:
            linear-gradient(180deg, rgba(255,255,255,.82) 0%, rgba(255,255,255,.66) 100%);
          border:1px solid rgba(255,255,255,.62);
          box-shadow:
            0 14px 28px rgba(15,23,42,.08),
            inset 0 1px 0 rgba(255,255,255,.92);
          transition:transform .16s ease, box-shadow .16s ease;
        }

        .notification-trigger:hover{
          transform:translateY(-1px);
          color:#0f172a;
          box-shadow:
            0 18px 34px rgba(15,23,42,.10),
            inset 0 1px 0 rgba(255,255,255,.94);
        }

        .notification-badge,
        .account-avatar-badge,
        .account-menu-badge{
          min-width:18px;
          height:18px;
          padding:0 5px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:#b42318;
          color:#fff;
          font-size:10px;
          font-weight:950;
          line-height:1;
          box-shadow:0 8px 18px rgba(180,35,24,.24);
        }

        .notification-badge{
          position:absolute;
          top:-3px;
          right:-3px;
        }

        .auth-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:40px;
          padding:0 16px;
          border-radius:999px;
          text-decoration:none;
          font-size:14px;
          font-weight:800;
          color:#fff;
          background:var(--red);
          box-shadow:0 10px 25px rgba(193,18,31,.22);
          transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
          white-space:nowrap;
        }

        .auth-btn:hover{
          transform:translateY(-1px);
          box-shadow:0 14px 30px rgba(193,18,31,.26);
          filter:saturate(1.06);
        }

        .profile-wrap{
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .account-trigger{
          height:48px;
          min-width:48px;
          padding:0 14px;
          border:none;
          border-radius:999px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.82) 0%, rgba(255,255,255,.66) 100%);
          box-shadow:
            0 14px 28px rgba(15,23,42,.08),
            inset 0 1px 0 rgba(255,255,255,.92);
          display:inline-flex;
          align-items:center;
          gap:10px;
          cursor:pointer;
          color:#0f172a;
          font-weight:900;
          transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
          border:1px solid rgba(255,255,255,.62);
        }

        .account-trigger:hover{
          transform:translateY(-1px);
          box-shadow:
            0 18px 34px rgba(15,23,42,.10),
            inset 0 1px 0 rgba(255,255,255,.94);
        }

        .account-trigger.open{
          background:
            linear-gradient(180deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.74) 100%);
        }

        .account-avatar-small{
          position:relative;
          width:28px;
          height:28px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:linear-gradient(135deg, #c40000 0%, #ff5b2e 100%);
          color:#fff;
          font-size:12px;
          font-weight:950;
          box-shadow:0 10px 18px rgba(196,0,0,.2);
          flex-shrink:0;
        }

        .account-avatar-badge{
          position:absolute;
          top:-8px;
          right:-10px;
          border:2px solid rgba(255,255,255,.9);
        }

        .account-trigger-text{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          line-height:1.05;
        }

        .account-trigger-name{
          font-size:13px;
          font-weight:900;
          max-width:110px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .account-trigger-role{
          margin-top:4px;
          font-size:10px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(0,0,0,.48);
        }

        .account-menu{
          position:absolute;
          top:calc(100% + 14px);
          right:0;
          width:320px;
          border-radius:26px;
          border:1px solid rgba(255,255,255,.68);
          background:
            linear-gradient(180deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.76) 100%);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          box-shadow:
            0 28px 70px rgba(15,23,42,.18),
            inset 0 1px 0 rgba(255,255,255,.92);
          overflow:hidden;
          z-index:2200;
          animation:pmPop .18s ease-out;
        }

        @keyframes pmPop{
          from{ transform:translateY(6px); opacity:0; }
          to{ transform:translateY(0); opacity:1; }
        }

        .account-menu-head{
          display:flex;
          align-items:center;
          gap:14px;
        }

        .account-avatar-large{
          width:52px;
          height:52px;
          border-radius:18px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:linear-gradient(135deg, #c40000 0%, #ff5b2e 100%);
          color:#fff;
          font-weight:950;
          font-size:18px;
          box-shadow:0 14px 28px rgba(196,0,0,.24);
          flex-shrink:0;
        }

        .account-identity{
          min-width:0;
        }

        .account-name{
          font-size:17px;
          font-weight:950;
          letter-spacing:-.03em;
          color:#0f172a;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .account-email{
          margin-top:4px;
          color:rgba(0,0,0,.56);
          font-weight:700;
          font-size:13px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .account-menu-head,
        .account-role-badge{
          position:relative;
          z-index:1;
        }

        .account-menu-head{
          padding:18px 18px 0 18px;
        }

        .account-role-badge{
          margin:16px 18px 0 18px;
          display:inline-flex;
          align-items:center;
          padding:8px 12px;
          border-radius:999px;
          background:rgba(255,255,255,.7);
          border:1px solid rgba(0,0,0,.05);
          font-size:11px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(0,0,0,.6);
        }

        .account-menu::before{
          content:"";
          position:absolute;
          inset:0;
          background:
            radial-gradient(circle at 18% 18%, rgba(255,255,255,.95), transparent 22%),
            radial-gradient(circle at 84% 82%, rgba(209,0,0,.08), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,0));
          pointer-events:none;
        }

        .account-panel{
          display:grid;
          gap:6px;
          padding:14px;
          border-radius:20px;
          background:rgba(248,248,250,.88);
          border:1px solid rgba(0,0,0,.05);
        }

        .account-panel-label{
          font-size:11px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(0,0,0,.46);
        }

        .account-panel-name{
          font-weight:900;
          color:#111827;
        }

        .account-panel-email{
          color:rgba(0,0,0,.58);
          font-weight:700;
          font-size:13px;
          word-break:break-word;
        }

        .account-actions{
          padding:14px;
          display:grid;
          gap:10px;
        }

        .account-link-btn{
          height:46px;
          border-radius:18px;
          border:1px solid rgba(0,0,0,.08);
          background:rgba(255,255,255,.94);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:0 14px;
          color:#111827;
          font-weight:900;
          text-decoration:none;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.92);
        }

        .account-logout-btn{
          height:50px;
          border-radius:18px;
          border:1px solid rgba(196,0,0,.16);
          background:linear-gradient(135deg, #c40000 0%, #ff5b2e 100%);
          color:#fff;
          font-weight:950;
          letter-spacing:-.01em;
          cursor:pointer;
          box-shadow:0 16px 30px rgba(196,0,0,.22);
        }

        :root{
          --red:#c1121f;
          --black:#0b0b0c;
          --ink70:rgba(11,11,12,.7);
          --ink55:rgba(11,11,12,.55);
          --glass:rgba(255,255,255,.85);
        }

        .apple-nav{
          position:fixed;
          top:0; left:0; right:0;
          z-index:1200;
          background:transparent;
          border-bottom:1px solid rgba(0,0,0,.06);
          isolation:isolate;
          transition:box-shadow .25s ease;
        }

        .apple-nav::before{
          content:"";
          position:absolute;
          inset:0;
          background:var(--glass);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          z-index:0;
        }

        .apple-nav.scrolled{
          box-shadow:0 10px 30px rgba(0,0,0,.12);
        }

        .nav-shell{
          max-width:1400px;
          margin:auto;
          padding:14px 28px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:28px;
          position:relative;
          z-index:1;
          min-width:0;
        }

        .brand{
          display:flex;
          align-items:center;
          gap:12px;
          text-decoration:none;
          flex:0 0 auto;
        }

        .brand img{
          width:40px;
          height:40px;
        }

        .brand-text{
          display:flex;
          flex-direction:column;
          line-height:1;
        }

        .brand-main{
          font-size:18px;
          font-weight:800;
          letter-spacing:.12em;
          color:var(--black);
        }

        .brand-sub{
          font-size:11px;
          font-weight:700;
          letter-spacing:.32em;
          color:var(--red);
        }

        .nav-center{
          display:flex;
          align-items:center;
          gap:24px;
          flex:0 1 auto;
          min-width:0;
        }

        .nav-item{
          position:relative;
          font-size:15px;
          font-weight:500;
          color:var(--ink70);
          text-decoration:none;
        }

        .nav-item:hover,
        .nav-item.active{
          color:var(--black);
        }

        .nav-item.active::after{
          content:"";
          position:absolute;
          left:0; right:0;
          bottom:-10px;
          height:2px;
          background:var(--red);
          border-radius:999px;
        }

        .products-menu-button.active::after{
          content:"";
          position:absolute;
          left:0;
          right:0;
          bottom:-10px;
          height:2px;
          background:var(--red);
          border-radius:999px;
        }

        .products-menu-button{
          position:relative;
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:0;
          border:0;
          background:transparent;
          color:inherit;
          font:inherit;
          cursor:pointer;
        }

        .products-menu-button span{
          color:rgba(11,11,12,.48);
          font-size:13px;
          transform:translateY(-1px);
          transition:transform .2s ease, color .2s ease;
        }

        .dropdown.open .products-menu-button span,
        .dropdown:hover .products-menu-button span,
        .dropdown:focus-within .products-menu-button span{
          color:var(--black);
          transform:translateY(-1px) rotate(180deg);
        }

        .dropdown{
          display:flex;
          align-items:center;
        }

        .dropdown::after{
          content:"";
          position:absolute;
          top:100%;
          left:-36px;
          right:-36px;
          height:24px;
        }

        .dropdown-panel{
          position:absolute;
          top:calc(100% + 20px);
          left:50%;
          width:min(380px, calc(100vw - 32px));
          background:linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(255,255,255,.82) 100%);
          border:1px solid rgba(255,255,255,.68);
          border-radius:26px;
          padding:12px;
          box-shadow:
            0 30px 80px rgba(15,23,42,.18),
            inset 0 1px 0 rgba(255,255,255,.9);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          opacity:0;
          pointer-events:none;
          transform:translate(-50%, 8px);
          transition:opacity .25s ease, transform .25s ease;
        }

        .dropdown.open .dropdown-panel,
        .dropdown:hover .dropdown-panel,
        .dropdown:focus-within .dropdown-panel{
          opacity:1;
          pointer-events:auto;
          transform:translate(-50%, 0);
        }

        .dropdown-grid{
          display:grid;
          grid-template-columns:1fr;
          gap:8px;
        }

        .dropdown-card{
          display:flex;
          align-items:center;
          gap:12px;
          padding:14px;
          border-radius:18px;
          text-decoration:none;
          background:rgba(255,255,255,.72);
          border:1px solid rgba(15,23,42,.06);
          transition:background .15s ease, transform .15s ease, border-color .15s ease;
        }

        .dropdown-card:hover{
          background:rgba(180,35,24,.06);
          border-color:rgba(180,35,24,.14);
          transform:translateY(-2px);
        }

        .dropdown-card-mark{
          width:34px;
          height:34px;
          border-radius:12px;
          background:
            linear-gradient(135deg, rgba(180,35,24,.95), rgba(221,81,39,.86));
          box-shadow:0 12px 26px rgba(180,35,24,.18);
          flex:0 0 auto;
        }

        .dropdown-card-copy{
          min-width:0;
          display:grid;
          gap:3px;
        }

        .dropdown-card-copy span{
          font-size:15px;
          font-weight:850;
          color:var(--black);
          line-height:1.2;
        }

        .dropdown-card-copy small{
          font-size:13px;
          line-height:1.35;
          color:var(--ink55);
          font-weight:650;
        }

        .nav-search{
          position:relative;
          display:flex;
          align-items:center;
          gap:8px;
          background:rgba(0,0,0,.05);
          border-radius:999px;
          padding:10px 16px;
          min-width:0;
          flex:1 1 220px;
        }

        .nav-search input{
          border:none;
          background:transparent;
          outline:none;
          font-size:14px;
          width:100%;
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .search-icon{
          color:var(--ink55);
        }

        .search-panel{
          position:absolute;
          top:calc(100% + 12px);
          left:0;
          right:0;
          background: rgba(255,255,255,.92);
          border:1px solid rgba(0,0,0,.10);
          border-radius:18px;
          box-shadow:0 30px 70px rgba(0,0,0,.14);
          overflow:hidden;
          padding:8px;
          z-index:2000;
          backdrop-filter: blur(18px);
        }

        .search-panel.empty{
          padding:14px 14px;
        }

        .search-row{
          display:block;
          width:100%;
          text-align:left;
          background:transparent;
          border:none;
          padding:10px 12px;
          border-radius:14px;
          cursor:pointer;
          transition: background .12s ease, transform .12s ease;
          text-decoration:none;
        }

        .search-row:hover{
          background: rgba(0,0,0,.04);
        }

        .search-row.active{
          background: rgba(193,18,31,.10);
        }

        .sr-main{
          font-size:13px;
          font-weight:700;
          color:var(--black);
          line-height:1.25;
        }

        .sr-sub{
          margin-top:4px;
          font-size:11px;
          color:var(--ink55);
          line-height:1.2;
        }

        .empty-title{
          font-weight:800;
          color:var(--black);
          font-size:13px;
        }
        .empty-sub{
          margin-top:6px;
          font-size:12px;
          color:var(--ink55);
        }

        .apple-nav.collapsed .nav-center{
          display:none;
        }

        .apple-nav.collapsed .nav-search{
          display:flex;
          min-width:0;
          order:1;
          margin-left:auto;
        }

        .apple-nav.collapsed .nav-auth{
          order:2;
          margin-left:12px;
        }

        .apple-nav.collapsed .mobile-toggle{
          display:block;
          order:3;
          margin-left:12px;
        }

        .mobile-toggle{
          display:none;
          position:relative;
          width:34px;
          min-width:34px;
          height:22px;
          background:none;
          border:none;
          cursor:pointer;
          flex:0 0 34px;
          flex-shrink:0;
        }

        .mobile-toggle span{
          position:absolute;
          left:0;
          right:0;
          height:2px;
          background:var(--black);
          border-radius:999px;
          transition:transform .35s cubic-bezier(.22,.61,.36,1),
                    opacity .25s ease;
        }

        .mobile-toggle span:first-child{ top:6px; }
        .mobile-toggle span:last-child{ bottom:6px; }

        .mobile-toggle.open span:first-child{
          transform:translateY(4px) rotate(45deg);
        }

        .mobile-toggle.open span:last-child{
          transform:translateY(-4px) rotate(-45deg);
        }

        .mobile-nav{
          position:fixed;
          top:68px;
          left:0;
          right:0;
          bottom:0;
          background:rgba(255,255,255,.96);
          backdrop-filter:blur(28px);
          display:flex;
          flex-direction:column;
          padding:36px 28px;
          gap:28px;
          transform:translateY(-8%);
          opacity:0;
          pointer-events:none;
          transition:
            transform .45s cubic-bezier(.22,.61,.36,1),
            opacity .35s ease;
          z-index:999;
        }

        .mobile-nav.show{
          transform:translateY(0);
          opacity:1;
          pointer-events:auto;
        }

        .mobile-nav a{
          font-size:22px;
          font-weight:600;
          color:var(--black);
          text-decoration:none;
        }

        .mobile-nav-group{
          display:grid;
          gap:14px;
        }

        .mobile-nav-group a{
          padding-left:16px;
          font-size:20px;
          color:rgba(11,11,12,.72);
        }

        .mobile-nav-heading{
          font-size:22px;
          font-weight:700;
          color:var(--black);
        }

        @media (max-width:760px){
          .nav-center{display:none;}
          .mobile-toggle{ display:block; }
          .nav-search{ display:none; }
          .nav-shell{
            gap:14px;
            padding:12px 16px;
          }
        }

        @media (max-width: 640px) {
          .nav-spacer{ height:64px; }
          .brand-main { font-size: 16px; }
          .brand-sub { font-size: 10px; letter-spacing: .28em; }
          .nav-search { padding: 12px 14px; }
          .nav-search input { font-size: 15px; }
          .brand img{
            width:40px;
            height:40px;
          }
          .account-trigger-text{
            display:none;
          }
          .account-menu{
            width:min(320px, calc(100vw - 28px));
            right:-6px;
          }
        }

        @media (hover: none) {
          .dropdown-card:hover { transform: none; }
        }

        .mobile-logout{
          font-size:22px;
          font-weight:600;
          color:var(--red);
          background:transparent;
          border:none;
          padding:0;
          text-align:left;
          cursor:pointer;
        }
      `}</style>
    </>
  );
}

export default NavBar;
