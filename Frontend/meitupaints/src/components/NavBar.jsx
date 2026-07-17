// NavBar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "bootstrap/dist/css/bootstrap.min.css";

import { useAuth } from "../auth/AuthProvider.jsx";
import { useNotifications } from "../notifications/notificationContext.js";
import SEARCH_ITEMS from "../ProductsList/allProductsSearch.json";

// Both nav-extension panels (search + account) grow downward from a fixed
// point right under the navbar - never translating the panel itself, so it
// can't visually slide down over/through the navbar's own contents. A
// "strong" ease-out (e.g. cubic-bezier(0.16,1,0.3,1)) front-loads almost
// all the visible clip-path travel into the first ~100-150ms and then
// barely moves for the rest of the duration - measured, it reveals ~70% of
// the panel by 100ms into a 500ms animation - which reads as "it just
// appeared" rather than "it's growing." Material's standard easing spreads
// the motion evenly across the whole duration instead, so the growth stays
// visible/watchable the entire time (Apple.com's own mega-menu cadence).
// Exit stays a sharp ease-in - closing should feel snappier than opening.
const PANEL_EASE_OUT = [0.4, 0, 0.2, 1];
const PANEL_ENTER = { duration: 0.62, ease: PANEL_EASE_OUT };
const PANEL_EXIT = { duration: 0.3, ease: [0.4, 0, 1, 1] };
const SCRIM_ENTER = { duration: 0.38, ease: "easeOut" };
const SCRIM_EXIT = { duration: 0.22, ease: "easeIn" };
// The panel's own clip-path reveal carries no opacity change - it should
// read as a solid shade physically extending, not a translucent fade. The
// content inside gets its own quick, slightly-delayed fade so it settles
// into place just as the shade finishes opening, instead of both racing
// together and blurring the "growing" motion into a generic cross-fade.
const PANEL_CONTENT_ENTER = { duration: 0.45, ease: "easeOut", delay: 0.14 };
const PANEL_CONTENT_EXIT = { duration: 0.18, ease: "easeIn" };

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

function NavAccountIcon({ name, size = 18 }) {
  if (name === "bag") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      </svg>
    );
  }

  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    dashboard: (
      <>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
      </>
    ),
    catalog: (
      <>
        <path d="M4.5 7.5 12 3.5l7.5 4-7.5 4-7.5-4Z" />
        <path d="M4.5 7.5v8.7l7.5 4.3 7.5-4.3V7.5" />
        <path d="M12 11.5v9" />
      </>
    ),
    orders: (
      <>
        <path d="M5 5h14v10l-2.8 4H7.8L5 15V5Z" />
        <path d="M5 15h4.2l1.4 2h2.8l1.4-2H19" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 6.8-2.5 8h17c0-1.2-2.5-2-2.5-8Z" />
        <path d="M10 20.5h4" />
      </>
    ),
    document: (
      <>
        <path d="M7 3h7l4 4v14H7V3Z" />
        <path d="M14 3v5h4" />
        <path d="M9.5 12h5" />
        <path d="M9.5 16h4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H6v14h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.user}
    </svg>
  );
}

function NavRightArrowIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m13 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const factoryDashboardHref = "/factory/dashboard";
  const adminCatalogHref = "/admin/products";
  const dealerCatalogHref = "/dealer/catalog";
  const dealerOrdersHref = "/dealer/orders";
  const notificationsHref = "/notifications";
  const unreadBadge = formatBadgeCount(notifications?.totalUnread || 0);
  const shouldReduceMotion = useReducedMotion();

  const [scrolled, setScrolled] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navShellRef = useRef(null);
  const brandRef = useRef(null);
  const navCenterRef = useRef(null);
  const navAuthRef = useRef(null);
  const desktopWidthRef = useRef(0);
  const profileWrapRef = useRef(null);
  const accountPanelRef = useRef(null);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchWrapRef = useRef(null);
  const searchPanelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);

    const onClickOutside = (e) => {
      const clickedSearchTrigger = searchWrapRef.current?.contains(e.target);
      const clickedSearchPanel = searchPanelRef.current?.contains(e.target);

      if (!clickedSearchTrigger && !clickedSearchPanel) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }

      if (
        !profileWrapRef.current?.contains(e.target) &&
        !accountPanelRef.current?.contains(e.target)
      ) {
        setProfileMenuOpen(false);
      }

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
    if (!searchOpen) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

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
      const preferredSearchWidth = 44;
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

  const closeSearch = () => {
    setSearchOpen(false);
    setActiveIndex(-1);
  };

  const openSearch = () => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
    setSearchOpen(true);
  };

  const toggleSearch = () => {
    if (searchOpen) {
      closeSearch();
      return;
    }
    openSearch();
  };

  const toggleAccountPanel = () => {
    setMobileOpen(false);
    setSearchOpen(false);
    setActiveIndex(-1);
    setProfileMenuOpen((v) => !v);
  };

  const closeAccountPanel = () => {
    setProfileMenuOpen(false);
  };

  const closeMobilePanel = () => {
    setMobileOpen(false);
    setSearchOpen(false);
    setProfileMenuOpen(false);
    setActiveIndex(-1);
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

  const accountMenuItems = useMemo(() => {
    if (!user) {
      return [
        {
          label: "Sign in",
          description: "Access dealer, admin, dispatcher, or factory tools",
          href: "/login",
          icon: "user",
        },
        {
          label: "Become a dealer",
          description: "Apply for a Meitu dealership",
          href: "/dealership",
          icon: "document",
        },
        {
          label: "Browse catalog",
          description: "Explore buckets, colors, and textures",
          href: "/products",
          icon: "catalog",
        },
      ];
    }

    const role = account.role;
    const items = [
      {
        label: "Profile",
        description: account.email,
        href: profileHref,
        icon: "user",
      },
    ];

    if (role === "ADMIN") {
      items.push(
        {
          label: "Dashboard",
          description: "Admin operations workspace",
          href: dashboardHref,
          icon: "dashboard",
        },
        {
          label: "Catalog",
          description: "Products, families, pricing, and media",
          href: adminCatalogHref,
          icon: "catalog",
        },
      );
    }

    if (role === "DEALER") {
      items.push({
        label: "Order",
        description: "Review order history",
        href: dealerOrdersHref,
        icon: "orders",
      });
    }

    if (role === "DISPATCHER") {
      items.push({
        label: "Dashboard",
        description: "Dispatcher routes and orders",
        href: dispatcherDashboardHref,
        icon: "dashboard",
      });
    }

    if (role === "FACTORY") {
      items.push({
        label: "Dashboard",
        description: "Factory orders, stock, and invoices",
        href: factoryDashboardHref,
        icon: "dashboard",
      });
    }

    if (notifications?.enabled) {
      items.push({
        label: "Notifications",
        description: unreadBadge ? `${unreadBadge} unread` : "No unread notifications",
        href: notificationsHref,
        icon: "bell",
        badge: unreadBadge,
      });
    }

    return items;
  }, [
    account.email,
    account.role,
    adminCatalogHref,
    dashboardHref,
    dealerOrdersHref,
    dispatcherDashboardHref,
    factoryDashboardHref,
    notifications?.enabled,
    notificationsHref,
    profileHref,
    unreadBadge,
    user,
  ]);

  const mobilePanelOpen = mobileOpen || searchOpen || profileMenuOpen;

  return (
    <>
      <nav
        className={`apple-nav ${scrolled ? "scrolled" : ""} ${
          navCollapsed ? "collapsed" : ""
        } ${mobilePanelOpen ? "mobile-panel-active" : ""}`}
      >
        <div className="nav-shell" ref={navShellRef}>
          <Link to="/" className="brand" ref={brandRef}>
            <img
              src="/meitulogo.svg"
              alt="MEITU Paints"
              width="50"
              height="50"
            />
          </Link>

          <div className="nav-center" ref={navCenterRef}>
            <Link
              className={`nav-item ${isActive("/") ? "active" : ""}`}
              to="/"
            >
              Home
            </Link>

            {PRODUCT_MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                to={item.href}
              >
                {item.label}
              </Link>
            ))}

            <Link
              className={`nav-item ${
                isActive("/ratecalculator") ? "active" : ""
              }`}
              to="/ratecalculator"
            >
              Rate Calculator
            </Link>

            <Link
              className={`nav-item ${isActive("/horoscope") ? "active" : ""}`}
              to="/horoscope"
            >
              Horoscope
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
              setSearchOpen(false);
              setProfileMenuOpen(false);
              setActiveIndex(-1);
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
            <button
              type="button"
              className="nav-search-trigger"
              aria-label={searchOpen ? "Close search" : "Search Meitu products"}
              aria-expanded={searchOpen}
              onClick={toggleSearch}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m20 20-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div
            className="nav-auth"
            ref={navAuthRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-wrap" ref={profileWrapRef}>
              <button
                type="button"
                className={`nav-bag-trigger ${profileMenuOpen ? "open" : ""}`}
                aria-label={user ? "Open account menu" : "Open sign in menu"}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={toggleAccountPanel}
              >
                <NavAccountIcon name="bag" size={18} />
                {unreadBadge ? (
                  <span className="notification-badge">{unreadBadge}</span>
                ) : null}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="nav-mobile-close"
            aria-label="Close navigation panel"
            onClick={(e) => {
              e.stopPropagation();
              closeMobilePanel();
            }}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className="nav-spacer" aria-hidden="true" />

      <AnimatePresence>
        {searchOpen ? (
          <motion.button
            key="search-scrim"
            type="button"
            className="search-page-scrim"
            aria-label="Close search"
            onClick={closeSearch}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: shouldReduceMotion ? { duration: 0 } : SCRIM_ENTER }}
            exit={{ opacity: 0, transition: shouldReduceMotion ? { duration: 0 } : SCRIM_EXIT }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen ? (
          <motion.section
            key="search-panel"
            className="nav-search-extension"
            ref={searchPanelRef}
            aria-label="Product search"
            onClick={(e) => e.stopPropagation()}
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)", transition: shouldReduceMotion ? { duration: 0 } : PANEL_ENTER }}
            exit={{ clipPath: "inset(0 0 100% 0)", transition: shouldReduceMotion ? { duration: 0 } : PANEL_EXIT }}
          >
            <motion.div
              className="nav-search-extension-inner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, transition: shouldReduceMotion ? { duration: 0 } : PANEL_CONTENT_ENTER }}
              exit={{ opacity: 0, y: -6, transition: shouldReduceMotion ? { duration: 0 } : PANEL_CONTENT_EXIT }}
            >
              <div className="nav-search-field">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="m20 20-3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  placeholder="Search Meitu products"
                  value={query}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuery(v);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={onSearchKeyDown}
                />
                {query ? (
                  <button
                    type="button"
                    className="nav-search-clear"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setActiveIndex(-1);
                      inputRef.current?.focus();
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <div className="nav-search-content">
                <div className="nav-search-kicker">
                  {query.trim() ? "Top matches" : "Quick links"}
                </div>

                {query.trim() ? (
                  results.length > 0 ? (
                    <div
                      className="nav-search-results"
                      role="listbox"
                      aria-label="Search results"
                    >
                      {results.map((r, idx) => {
                        const active = idx === activeIndex;

                        return (
                          <Link
                            key={`${r.type}-${r.id}`}
                            to={r.route}
                            className={`nav-search-result ${
                              active ? "active" : ""
                            }`}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => {
                              setSearchOpen(false);
                              setActiveIndex(-1);
                              setQuery("");
                            }}
                          >
                            <span className="nav-search-result-mark" />
                            <span className="nav-search-result-copy">
                              <span>{r.name}</span>
                              <small>{r.meta?.category || "Product"}</small>
                            </span>
                            <span className="nav-search-result-arrow">
                              <NavRightArrowIcon size={15} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="nav-search-empty" aria-label="No results">
                      <strong>No results found.</strong>
                      <span>Try a product name, collection, or finish.</span>
                    </div>
                  )
                ) : (
                  <div className="nav-search-quicklinks">
                    {[...PRODUCT_MENU_ITEMS, {
                      label: "Rate Calculator",
                      description: "Estimate paint requirements",
                      href: "/ratecalculator",
                    }, {
                      label: "Horoscope",
                      description: "Explore zodiac-inspired palettes",
                      href: "/horoscope",
                    }, {
                      label: "Dealership",
                      description: "Apply or learn about partnership",
                      href: "/dealership",
                    }, {
                      label: "Support",
                      description: "Get product guidance",
                      href: "/support",
                    }].map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="nav-search-quicklink"
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="nav-search-quicklink-copy">
                          <span>{item.label}</span>
                          <small>{item.description}</small>
                        </span>
                        <span className="nav-search-quicklink-arrow">
                          <NavRightArrowIcon size={15} />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {profileMenuOpen ? (
          <motion.button
            key="account-scrim"
            type="button"
            className="account-page-scrim"
            aria-label="Close account menu"
            onClick={closeAccountPanel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: shouldReduceMotion ? { duration: 0 } : SCRIM_ENTER }}
            exit={{ opacity: 0, transition: shouldReduceMotion ? { duration: 0 } : SCRIM_EXIT }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {profileMenuOpen ? (
          <motion.section
            key="account-panel"
            className="account-nav-extension"
            ref={accountPanelRef}
            aria-label="Account menu"
            onClick={(e) => e.stopPropagation()}
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)", transition: shouldReduceMotion ? { duration: 0 } : PANEL_ENTER }}
            exit={{ clipPath: "inset(0 0 100% 0)", transition: shouldReduceMotion ? { duration: 0 } : PANEL_EXIT }}
          >
            <motion.div
              className="account-nav-extension-inner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, transition: shouldReduceMotion ? { duration: 0 } : PANEL_CONTENT_ENTER }}
              exit={{ opacity: 0, y: -6, transition: shouldReduceMotion ? { duration: 0 } : PANEL_CONTENT_EXIT }}
            >
              <div className="account-nav-head">
                <div>
                  <div className="account-nav-kicker">
                    {user ? account.role : "Meitu account"}
                  </div>
                  <div className="account-nav-title">
                    {user ? account.username : "Sign in to continue"}
                  </div>
                  <div className="account-nav-subtitle">
                    {user
                      ? account.email
                      : "Open your role workspace and saved tools."}
                  </div>
                </div>
                <div className="account-nav-avatar" aria-hidden="true">
                  {user ? account.initial : <NavAccountIcon name="bag" size={19} />}
                </div>
              </div>

              <div className="account-nav-grid" role="menu">
                {accountMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="account-nav-action"
                    role="menuitem"
                    onClick={closeAccountPanel}
                  >
                    <span className="account-nav-icon">
                      <NavAccountIcon name={item.icon} size={18} />
                    </span>
                    <span className="account-nav-action-copy">
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </span>
                    {item.badge ? (
                      <span className="account-nav-action-badge">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                ))}

                {user ? (
                  <button
                    type="button"
                    className="account-nav-action account-nav-logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <span className="account-nav-icon">
                      <NavAccountIcon name="logout" size={18} />
                    </span>
                    <span className="account-nav-action-copy">
                      <span>Log out</span>
                      <small>End this secure session</small>
                    </span>
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.section>
        ) : null}
      </AnimatePresence>

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

            {account.role === "FACTORY" ? (
              <Link
                to={factoryDashboardHref}
                onClick={() => setMobileOpen(false)}
              >
                Factory Dashboard
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
        /* ─── Apple-Inspired NavBar Design System ─── */

        .apple-nav{
          position:fixed;
          top:0; left:0; right:0;
          z-index:1200;
          height:44px;
          background:var(--color-fog, #f5f5f7);
          border-bottom:1px solid transparent;
          isolation:isolate;
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          transition:border-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .apple-nav::before{
          display:none;
        }

        .apple-nav.scrolled{
          border-bottom-color:var(--color-silver-mist, #e8e8ed);
        }

        .nav-spacer{
          height:44px;
          flex:0 0 auto;
        }

        .nav-shell{
          max-width:980px;
          margin:auto;
          min-height:44px;
          padding:0 24px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:18px;
          position:relative;
          z-index:1;
          min-width:0;
        }

        /* ─── Brand ─── */

        .brand{
          display:flex;
          align-items:center;
          gap:0;
          text-decoration:none;
          flex:0 0 auto;
          margin-right:4px;
        }

        .brand img{
          width:30px;
          height:30px;
        }

        .brand-text{
          display:flex;
          flex-direction:column;
          line-height:1;
        }

        .brand-main{
          font-family:var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size:14px;
          font-weight:700;
          letter-spacing:.14em;
          color:var(--color-ink, #1d1d1f);
        }

        .brand-sub{
          margin-top:2px;
          font-family:var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-size:8px;
          font-weight:600;
          letter-spacing:.34em;
          color:var(--color-graphite, #707070);
        }

        /* ─── Nav Center Links ─── */

        .nav-center{
          display:flex;
          align-items:center;
          gap:22px;
          flex:0 0 auto;
          min-width:0;
        }

        .nav-item{
          position:relative;
          text-decoration:none;
        }

        .nav-item,
        .products-menu-button{
          font-family:var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          font-size:12px;
          line-height:1;
          font-weight:400;
          letter-spacing:-.003em;
          color:var(--color-ink, #1d1d1f);
          opacity:.86;
          transition:opacity var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .nav-item:hover,
        .products-menu-button:hover{
          color:var(--color-cobalt-link, #0066cc);
          opacity:1;
        }

        .nav-item.active,
        .products-menu-button.active{
          color:var(--color-ink, #1d1d1f);
          opacity:1;
        }

        .nav-item.active::after{
          content:"";
          position:absolute;
          left:0; right:0;
          bottom:-10px;
          height:2px;
          background:var(--color-ink, #1d1d1f);
          border-radius:var(--radius-buttons, 999px);
        }

        .products-menu-button.active::after{
          content:"";
          position:absolute;
          left:0; right:0;
          bottom:-10px;
          height:2px;
          background:var(--color-ink, #1d1d1f);
          border-radius:var(--radius-buttons, 999px);
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
          color:var(--color-graphite, #707070);
          font-size:13px;
          transform:translateY(-1px);
          transition:transform var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .dropdown.open .products-menu-button span,
        .dropdown:hover .products-menu-button span,
        .dropdown:focus-within .products-menu-button span{
          color:var(--color-ink, #1d1d1f);
          transform:translateY(-1px) rotate(180deg);
        }

        /* ─── Dropdown Panel ─── */

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
          top:calc(100% + 10px);
          left:50%;
          width:min(380px, calc(100vw - 32px));
          background:var(--surface-card, #ffffff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          border-radius:var(--radius-cards, 28px);
          padding:12px;
          opacity:0;
          pointer-events:none;
          transform:translate(-50%, 8px);
          transition:opacity var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    transform var(--duration-primary, 0.344s) var(--ease-smooth, ease);
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
          background:var(--color-fog, #f5f5f7);
          border:1px solid transparent;
          transition:background var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    border-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .dropdown-card:hover{
          background:var(--surface-card, #ffffff);
          border-color:var(--color-silver-mist, #e8e8ed);
        }

        .dropdown-card-mark{
          width:34px;
          height:34px;
          border-radius:12px;
          background:var(--color-ink, #1d1d1f);
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
          color:var(--color-ink, #1d1d1f);
          line-height:1.2;
        }

        .dropdown-card-copy small{
          font-size:13px;
          line-height:1.35;
          color:var(--color-graphite, #707070);
          font-weight:650;
        }

        /* ─── Nav Search Icon ─── */

        .nav-search{
          position:relative;
          display:flex;
          align-items:center;
          flex:0 0 auto;
          width:32px;
          height:32px;
          padding:0;
          background:transparent;
          border-radius:var(--radius-buttons, 999px);
          margin-left:0;
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
          color:var(--color-graphite, #707070);
        }

        .nav-search-trigger{
          width:32px;
          height:32px;
          border:0;
          border-radius:var(--radius-buttons, 999px);
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    transform var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .nav-search-trigger:hover,
        .nav-search-trigger[aria-expanded="true"]{
          background:rgba(232,232,237,.72);
        }

        .nav-search-trigger:active{
          transform:scale(.96);
        }

        /* ─── Search Panel Extension ─── */

        .search-page-scrim{
          position:fixed;
          inset:44px 0 0;
          z-index:9990;
          border:0;
          background:rgba(245,245,247,.5);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          cursor:default;
        }

        .search-panel{
          position:absolute;
          top:calc(100% + 12px);
          left:0;
          right:0;
          background:var(--surface-card, #ffffff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          border-radius:18px;
          overflow:hidden;
          padding:8px;
          z-index:2000;
        }

        .search-panel.empty{
          padding:14px;
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
          transition:background var(--duration-primary, 0.344s) var(--ease-smooth, ease);
          text-decoration:none;
        }

        .search-row:hover{
          background:rgba(0,0,0,.04);
        }

        .search-row.active{
          background:rgba(0,0,0,.06);
        }

        .sr-main{
          font-size:13px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          line-height:1.25;
        }

        .sr-sub{
          margin-top:4px;
          font-size:11px;
          color:var(--color-graphite, #707070);
          line-height:1.2;
        }

        .empty-title{
          font-weight:800;
          color:var(--color-ink, #1d1d1f);
          font-size:13px;
        }

        .empty-sub{
          margin-top:6px;
          font-size:12px;
          color:var(--color-graphite, #707070);
        }

        .nav-search-extension{
          position:fixed;
          top:44px;
          left:0;
          right:0;
          z-index:9995;
          background:var(--color-fog, #f5f5f7);
          border-bottom:1px solid var(--color-silver-mist, #e8e8ed);
          overflow:hidden;
          max-height:640px;
          transform-origin:top center;
        }

        .nav-search-extension-inner{
          width:min(620px, calc(100vw - 40px));
          margin:0 auto;
          padding:56px 0 64px;
        }

        .nav-search-field{
          display:grid;
          grid-template-columns:24px minmax(0,1fr) 34px;
          align-items:center;
          gap:10px;
          min-height:42px;
          color:var(--color-graphite, #707070);
        }

        .nav-search-field input{
          width:100%;
          border:0;
          outline:0;
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          font-family:var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size:22px;
          line-height:1.14;
          font-weight:600;
          letter-spacing:-.005em;
        }

        .nav-search-field input::placeholder{
          color:var(--color-graphite, #707070);
        }

        .nav-search-clear{
          width:32px;
          height:32px;
          border:0;
          border-radius:var(--radius-buttons, 999px);
          background:var(--color-silver-mist, #e8e8ed);
          color:var(--color-graphite, #707070);
          font-size:21px;
          line-height:1;
          cursor:pointer;
        }

        .nav-search-content{
          margin-top:10px;
        }

        .nav-search-kicker{
          margin-bottom:8px;
          font-size:12px;
          font-weight:600;
          color:var(--color-graphite, #707070);
          letter-spacing:-.003em;
        }

        .nav-search-results,
        .nav-search-quicklinks{
          display:grid;
          gap:4px;
        }

        .nav-search-result,
        .nav-search-quicklink{
          min-height:42px;
          display:grid;
          align-items:center;
          text-decoration:none;
          border-radius:14px;
          color:var(--color-ink, #1d1d1f);
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .nav-search-result{
          grid-template-columns:16px minmax(0,1fr) 20px;
          gap:12px;
          padding:7px 10px;
        }

        .nav-search-quicklink{
          grid-template-columns:minmax(0,1fr) 20px;
          gap:12px;
          padding:8px 10px;
        }

        .nav-search-result:hover,
        .nav-search-result.active,
        .nav-search-quicklink:hover{
          background:var(--surface-card, #ffffff);
        }

        .nav-search-result-mark{
          width:6px;
          height:6px;
          border-radius:var(--radius-buttons, 999px);
          background:var(--color-ink, #1d1d1f);
        }

        .nav-search-result-copy,
        .nav-search-quicklink-copy{
          min-width:0;
          display:grid;
          gap:3px;
        }

        .nav-search-result-copy span,
        .nav-search-quicklink-copy span{
          min-width:0;
          color:var(--color-ink, #1d1d1f);
          font-size:15px;
          line-height:1.2;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .nav-search-result-copy small,
        .nav-search-quicklink-copy small{
          color:var(--color-graphite, #707070);
          font-size:12px;
          line-height:1.2;
          font-weight:400;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .nav-search-result-arrow,
        .nav-search-quicklink-arrow{
          color:var(--color-graphite, #707070);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          transition:transform var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .nav-search-result:hover .nav-search-result-arrow,
        .nav-search-result.active .nav-search-result-arrow,
        .nav-search-quicklink:hover .nav-search-quicklink-arrow{
          color:var(--color-ink, #1d1d1f);
          transform:translateX(3px);
        }

        .nav-search-empty{
          padding:18px 12px;
          border-radius:18px;
          background:var(--surface-card, #ffffff);
          display:grid;
          gap:5px;
        }

        .nav-search-empty strong{
          color:var(--color-ink, #1d1d1f);
          font-size:15px;
        }

        .nav-search-empty span{
          color:var(--color-graphite, #707070);
          font-size:13px;
        }

        /* ─── Nav Auth / Profile / Bag ─── */

        .nav-auth{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          flex:0 0 auto;
          gap:6px;
          margin-left:0;
        }

        .profile-wrap{
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .nav-bag-trigger{
          position:relative;
          width:32px;
          height:32px;
          border:0;
          border-radius:var(--radius-buttons, 999px);
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    transform var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .nav-bag-trigger:hover,
        .nav-bag-trigger.open{
          background:rgba(232,232,237,.72);
        }

        .nav-bag-trigger:active{
          transform:scale(.96);
        }

        /* ─── Notification Badge ─── */

        .notification-badge,
        .account-avatar-badge,
        .account-menu-badge{
          min-width:18px;
          height:18px;
          padding:0 5px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-size:10px;
          font-weight:600;
          line-height:1;
        }

        .notification-badge{
          position:absolute;
          top:-3px;
          right:-3px;
        }

        .nav-bag-trigger .notification-badge{
          top:-5px;
          right:-5px;
          min-width:15px;
          height:15px;
          padding:0 4px;
          font-size:9px;
          border:2px solid var(--color-fog, #f5f5f7);
        }

        /* ─── Notification Trigger ─── */

        .notification-trigger{
          position:relative;
          width:44px;
          height:44px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:var(--color-ink, #1d1d1f);
          text-decoration:none;
          background:var(--surface-card, #ffffff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .notification-trigger:hover{
          color:var(--color-ink, #1d1d1f);
        }

        /* ─── Auth CTA Button ─── */

        .auth-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height:30px;
          padding:0 13px;
          border-radius:var(--radius-buttons, 999px);
          text-decoration:none;
          font-size:12px;
          font-weight:400;
          color:#fff;
          background:var(--color-azure, #0071e3);
          transition:opacity var(--duration-primary, 0.344s) var(--ease-smooth, ease);
          white-space:nowrap;
        }

        .auth-btn:hover{
          opacity:.88;
        }

        /* ─── Account Trigger ─── */

        .account-trigger{
          height:48px;
          min-width:48px;
          padding:0 14px;
          border:1px solid var(--color-silver-mist, #e8e8ed);
          border-radius:var(--radius-buttons, 999px);
          background:var(--surface-card, #ffffff);
          display:inline-flex;
          align-items:center;
          gap:10px;
          cursor:pointer;
          color:var(--color-ink, #1d1d1f);
          font-weight:900;
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .account-trigger:hover{
          background:var(--color-fog, #f5f5f7);
        }

        .account-trigger.open{
          background:var(--color-fog, #f5f5f7);
        }

        .account-avatar-small{
          position:relative;
          width:28px;
          height:28px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          font-size:12px;
          font-weight:600;
          flex-shrink:0;
        }

        .account-avatar-badge{
          position:absolute;
          top:-8px;
          right:-10px;
          border:2px solid var(--surface-card, #ffffff);
        }

        .account-trigger-text{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          line-height:1.05;
        }

        .account-trigger-name{
          font-size:13px;
          font-weight:600;
          max-width:110px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .account-trigger-role{
          margin-top:4px;
          font-size:10px;
          font-weight:600;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }

        /* ─── Account Menu ─── */

        .account-menu{
          position:absolute;
          top:calc(100% + 14px);
          right:0;
          width:320px;
          border-radius:var(--radius-cards, 28px);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          background:var(--surface-card, #ffffff);
          overflow:hidden;
          z-index:2200;
          animation:pmPop var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .account-menu::before{
          display:none;
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

        .account-menu-head{
          padding:18px 18px 0 18px;
        }

        .account-avatar-large{
          width:52px;
          height:52px;
          border-radius:18px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          font-weight:600;
          font-size:18px;
          flex-shrink:0;
        }

        .account-identity{
          min-width:0;
        }

        .account-name{
          font-size:17px;
          font-weight:600;
          letter-spacing:-.03em;
          color:var(--color-ink, #1d1d1f);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .account-email{
          margin-top:4px;
          color:var(--color-graphite, #707070);
          font-weight:400;
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

        .account-role-badge{
          margin:16px 18px 0 18px;
          display:inline-flex;
          align-items:center;
          padding:8px 12px;
          border-radius:var(--radius-buttons, 999px);
          background:var(--color-fog, #f5f5f7);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          font-size:11px;
          font-weight:600;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }

        .account-panel{
          display:grid;
          gap:6px;
          padding:14px;
          border-radius:20px;
          background:var(--color-fog, #f5f5f7);
          border:1px solid var(--color-silver-mist, #e8e8ed);
        }

        .account-panel-label{
          font-size:11px;
          font-weight:600;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }

        .account-panel-name{
          font-weight:600;
          color:var(--color-ink, #1d1d1f);
        }

        .account-panel-email{
          color:var(--color-graphite, #707070);
          font-weight:400;
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
          border:1px solid var(--color-silver-mist, #e8e8ed);
          background:var(--surface-card, #ffffff);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:0 14px;
          color:var(--color-ink, #1d1d1f);
          font-weight:600;
          text-decoration:none;
        }

        .account-logout-btn{
          height:50px;
          border-radius:18px;
          border:1px solid var(--color-ink, #1d1d1f);
          background:var(--color-ink, #1d1d1f);
          color:#fff;
          font-weight:600;
          letter-spacing:-.01em;
          cursor:pointer;
        }

        /* ─── Account Nav Extension (Profile Panel) ─── */

        .account-page-scrim{
          position:fixed;
          inset:44px 0 0;
          z-index:9990;
          border:0;
          background:rgba(245,245,247,.44);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          cursor:default;
        }

        .account-nav-extension{
          position:fixed;
          top:44px;
          left:0;
          right:0;
          z-index:9995;
          background:var(--color-fog, #f5f5f7);
          border-bottom:1px solid var(--color-silver-mist, #e8e8ed);
          overflow:hidden;
          max-height:500px;
          transform-origin:top center;
        }

        .account-nav-extension-inner{
          width:min(640px, calc(100vw - 40px));
          margin:0 auto;
          padding:56px 0 64px;
        }

        .account-nav-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          padding:0 4px 12px;
          border-bottom:1px solid var(--color-silver-mist, #e8e8ed);
        }

        .account-nav-kicker{
          color:var(--color-graphite, #707070);
          font-size:12px;
          line-height:1.2;
          font-weight:600;
          letter-spacing:-.003em;
          text-transform:uppercase;
        }

        .account-nav-title{
          margin-top:4px;
          color:var(--color-ink, #1d1d1f);
          font-family:var(--font-sf-pro-display, Inter, system-ui, sans-serif);
          font-size:22px;
          line-height:1.1;
          font-weight:600;
          letter-spacing:-.005em;
        }

        .account-nav-subtitle{
          margin-top:4px;
          color:var(--color-graphite, #707070);
          font-size:13px;
          line-height:1.3;
          font-weight:400;
        }

        .account-nav-avatar{
          width:38px;
          height:38px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--surface-card, #ffffff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          color:var(--color-ink, #1d1d1f);
          font-weight:600;
          flex:0 0 auto;
        }

        .account-nav-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:6px;
          padding-top:12px;
        }

        .account-nav-action{
          width:100%;
          min-height:54px;
          border:0;
          border-radius:16px;
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          display:grid;
          grid-template-columns:28px minmax(0,1fr) auto;
          align-items:center;
          gap:10px;
          padding:9px 10px;
          text-align:left;
          text-decoration:none;
          cursor:pointer;
          font-family:var(--font-sf-pro-text, Inter, system-ui, sans-serif);
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .account-nav-action:hover{
          background:var(--surface-card, #ffffff);
          color:var(--color-ink, #1d1d1f);
        }

        .account-nav-icon{
          width:28px;
          height:28px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--surface-card, #ffffff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
          color:var(--color-ink, #1d1d1f);
        }

        .account-nav-action-copy{
          min-width:0;
          display:grid;
          gap:3px;
        }

        .account-nav-action-copy span{
          min-width:0;
          color:var(--color-ink, #1d1d1f);
          font-size:14px;
          line-height:1.2;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .account-nav-action-copy small{
          min-width:0;
          color:var(--color-graphite, #707070);
          font-size:12px;
          line-height:1.2;
          font-weight:400;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .account-nav-action-badge{
          min-width:18px;
          height:18px;
          padding:0 5px;
          border-radius:var(--radius-buttons, 999px);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:var(--color-azure, #0071e3);
          color:#fff;
          font-size:10px;
          font-weight:600;
        }

        .account-nav-logout{
          grid-column:1 / -1;
        }

        .account-nav-logout .account-nav-icon{
          background:var(--color-ink, #1d1d1f);
          border-color:var(--color-ink, #1d1d1f);
          color:#fff;
        }

        /* ─── Collapsed State ─── */

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

        /* ─── Mobile Toggle ─── */

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
          background:var(--color-ink, #1d1d1f);
          border-radius:var(--radius-buttons, 999px);
          transition:transform var(--duration-primary, 0.344s) cubic-bezier(.22,.61,.36,1),
                    opacity var(--duration-primary, 0.344s) var(--ease-smooth, ease);
        }

        .mobile-toggle span:first-child{ top:6px; }
        .mobile-toggle span:last-child{ bottom:6px; }

        .mobile-toggle.open span:first-child{
          transform:translateY(4px) rotate(45deg);
        }

        .mobile-toggle.open span:last-child{
          transform:translateY(-4px) rotate(-45deg);
        }

        /* ─── Mobile Close Button ─── */

        .nav-mobile-close{
          display:none;
          position:absolute;
          top:50%;
          right:24px;
          width:32px;
          height:32px;
          padding:0;
          border:0;
          border-radius:var(--radius-buttons, 999px);
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          cursor:pointer;
          transform:translateY(-50%);
          transition:background-color var(--duration-primary, 0.344s) var(--ease-smooth, ease),
                    transform var(--duration-primary, 0.344s) var(--ease-smooth, ease);
          z-index:10002;
        }

        .nav-mobile-close:hover{
          background:rgba(232,232,237,.72);
        }

        .nav-mobile-close:active{
          transform:translateY(-50%) scale(.96);
        }

        .nav-mobile-close span{
          position:absolute;
          left:9px;
          right:9px;
          top:50%;
          height:1.5px;
          border-radius:var(--radius-buttons, 999px);
          background:currentColor;
        }

        .nav-mobile-close span:first-child{
          transform:rotate(45deg);
        }

        .nav-mobile-close span:last-child{
          transform:rotate(-45deg);
        }

        /* ─── Mobile Nav Panel ─── */

        .mobile-nav{
          position:fixed;
          top:var(--nav-height, 44px);
          left:0;
          right:0;
          bottom:0;
          background:var(--surface-card, #ffffff);
          display:flex;
          flex-direction:column;
          padding:36px 28px;
          gap:28px;
          transform:translateY(0);
          transform-origin:top center;
          clip-path:inset(0 0 100% 0);
          opacity:0;
          pointer-events:none;
          transition:
            clip-path var(--duration-primary, 0.344s) cubic-bezier(.22,.61,.36,1),
            opacity var(--duration-primary, 0.344s) var(--ease-smooth, ease);
          z-index:9995;
        }

        .mobile-nav.show{
          transform:translateY(0);
          clip-path:inset(0 0 0 0);
          opacity:1;
          pointer-events:auto;
        }

        .mobile-nav a{
          font-size:22px;
          font-weight:600;
          color:var(--color-ink, #1d1d1f);
          text-decoration:none;
        }

        .mobile-nav-group{
          display:grid;
          gap:14px;
        }

        .mobile-nav-group a{
          padding-left:16px;
          font-size:20px;
          color:var(--color-graphite, #707070);
        }

        .mobile-nav-heading{
          font-size:22px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
        }

        .mobile-logout{
          font-size:22px;
          font-weight:600;
          color:var(--color-ink, #1d1d1f);
          background:transparent;
          border:none;
          padding:0;
          text-align:left;
          cursor:pointer;
        }

        /* ─── Responsive ─── */

        @media (max-width:1040px){
          .nav-shell{
            max-width:100%;
            gap:12px;
          }
          .nav-center{
            gap:16px;
          }
        }

        @media (max-width:760px){
          .nav-center{display:none;}
          .mobile-toggle{ display:block; }
          .nav-search{ display:flex; }
          .nav-shell{
            display:flex;
            align-items:center;
            justify-content:flex-start;
            gap:10px;
            min-height:44px;
          }

          .brand{
            order:0;
            margin-right:auto;
            flex:0 0 auto;
          }

          .nav-center{
            display:none !important;
          }

          .nav-search{
            order:1 !important;
            display:flex !important;
            flex:0 0 32px !important;
            width:32px !important;
            height:32px !important;
            margin-left:0 !important;
          }

          .nav-auth{
            order:2 !important;
            display:flex !important;
            flex:0 0 32px !important;
            width:32px !important;
            height:32px !important;
            margin-left:0 !important;
          }

          .mobile-toggle{
            order:3 !important;
            display:inline-flex !important;
            align-items:center;
            justify-content:center;
            flex:0 0 32px !important;
            width:32px !important;
            min-width:32px !important;
            height:32px !important;
            margin-left:0 !important;
            padding:0 !important;
            border-radius:var(--radius-buttons, 999px);
          }

          .mobile-toggle:hover,
          .mobile-toggle.open{
            background:rgba(232,232,237,.72);
          }

          .mobile-toggle span{
            left:8px;
            right:8px;
            height:1.5px;
          }

          .mobile-toggle span:first-child{ top:11px; }
          .mobile-toggle span:last-child{ bottom:11px; }

          .mobile-toggle.open span:first-child{
            transform:translateY(4px) rotate(45deg);
          }

          .mobile-toggle.open span:last-child{
            transform:translateY(-4px) rotate(-45deg);
          }

          .apple-nav.mobile-panel-active .brand,
          .apple-nav.mobile-panel-active .nav-center,
          .apple-nav.mobile-panel-active .nav-search,
          .apple-nav.mobile-panel-active .nav-auth,
          .apple-nav.mobile-panel-active .mobile-toggle{
            opacity:0 !important;
            visibility:hidden !important;
            pointer-events:none !important;
          }

          .apple-nav.mobile-panel-active .nav-mobile-close{
            display:inline-flex;
            align-items:center;
            justify-content:center;
          }

          .search-page-scrim,
          .account-page-scrim{
            inset:var(--nav-height, 44px) 0 0;
          }

          .nav-search-extension,
          .account-nav-extension{
            top:var(--nav-height, 44px);
            bottom:0;
            z-index:9995;
            transform-origin:top center;
            max-height:none;
            overflow-y:auto;
            -webkit-overflow-scrolling:touch;
          }

          .nav-search-extension-inner,
          .account-nav-extension-inner{
            width:min(680px, calc(100vw - 32px));
            padding:44px 0 56px;
          }

          .nav-search-content{
            margin-top:22px;
          }

          .nav-search-results,
          .nav-search-quicklinks,
          .account-nav-grid{
            gap:8px;
          }

          .nav-search-result,
          .nav-search-quicklink{
            min-height:54px;
            border-radius:18px;
            padding:10px 12px;
          }
        }

        @media (max-width:640px){
          .nav-shell{
            padding:0 16px;
            justify-content:space-between;
          }
          .nav-spacer{
            height:44px;
          }
          .nav-search-extension-inner{
            width:calc(100vw - 28px);
            padding:36px 0 44px;
          }
          .account-nav-extension-inner{
            width:calc(100vw - 28px);
            padding:36px 0 44px;
          }
          .account-nav-grid{
            grid-template-columns:1fr;
          }
          .nav-search-field input{
            font-size:24px;
          }
          .brand-main{
            font-size:13px;
          }
          .brand-sub{
            font-size:8px;
          }
        }

        @media (hover: none) {
          .dropdown-card:hover { transform:none; }
        }
      `}</style>
    </>
  );
}

export default NavBar;
