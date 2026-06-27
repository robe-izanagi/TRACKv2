import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FiMenu,
  FiBell,
  FiUser,
  FiPlus,
  FiX,
  FiArrowLeft,
  FiHome,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiMapPin, // ← new icons
} from "react-icons/fi";
import styles from "./AppLayout.module.css";

// Routes that should display the focused layout (back button, no bottom nav/FAB)
const FOCUSED_ROUTES = [
  "/notifications",
  "/profile",
  "/create-event",
  "/create-task",
];

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Determine if we're on a focused screen
  const isFocused = FOCUSED_ROUTES.some((route) =>
    location.pathname.startsWith(route),
  );

  // Role‑based bottom nav items (always shown when not focused)
  const role = user?.role || "faculty";
  const bottomItems = [];
  if (!isFocused) {
    if (role === "staff") {
      bottomItems.push(
        { label: "Home", path: `/${role}/home`, icon: <FiHome size={20} /> },
        { label: "Venues", path: "/venues", icon: <FiMapPin size={20} /> },
        {
          label: "Calendar",
          path: "/calendar",
          icon: <FiCalendar size={20} />,
        },
        { label: "Tasks", path: "/tasks", icon: <FiCheckSquare size={20} /> },
        {
          label: "Analytics",
          path: "/analytics",
          icon: <FiBarChart2 size={20} />,
        },
      );
    } else {
      // officials & faculty
      bottomItems.push(
        { label: "Home", path: `/${role}/home`, icon: <FiHome size={20} /> },
        { label: "Tasks", path: "/tasks", icon: <FiCheckSquare size={20} /> },
        {
          label: "Calendar",
          path: "/calendar",
          icon: <FiCalendar size={20} />,
        },
        {
          label: "Analytics",
          path: "/analytics",
          icon: <FiBarChart2 size={20} />,
        },
      );
    }
  }

  // Derive a friendly title from the path
  const pathToTitle = (path) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    const last = parts[parts.length - 1];
    return last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className={styles.mobileContainer}>
      {/* ===== Side Drawer (only on non‑focused screens) ===== */}
      {!isFocused && (
        <>
          <div
            className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
          >
            <div className={styles.drawerHeader}>
              <h2>Menu</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className={styles.closeBtn}
              >
                <FiX size={24} />
              </button>
            </div>
            <div className={styles.drawerContent}>
              <p>Navigation options will go here.</p>
            </div>
          </div>
          {drawerOpen && (
            <div
              className={styles.overlay}
              onClick={() => setDrawerOpen(false)}
            />
          )}
        </>
      )}

      {/* ===== Top Bar ===== */}
      <header className={styles.topBar}>
        {isFocused ? (
          <>
            <button className={styles.menuBtn} onClick={() => navigate(-1)}>
              <FiArrowLeft size={24} />
            </button>
            <span className={styles.title}>
              {pathToTitle(location.pathname)}
            </span>
            <div className={styles.topActions} /> {/* empty spacer */}
          </>
        ) : (
          <>
            <div className={styles.topSideContent}>
              <button
                className={styles.menuBtn}
                onClick={() => setDrawerOpen(true)}
              >
                <FiMenu size={24} />
              </button>
              <span className={styles.title}>TRACK</span>
            </div>
            <div className={styles.topActions}>
              <button
                onClick={() => navigate("/notifications")}
                className={styles.iconBtn}
              >
                <FiBell size={22} />
              </button>
              <button
                onClick={() => navigate("/profile")}
                className={styles.iconBtn}
              >
                <FiUser size={22} />
              </button>
            </div>
          </>
        )}
      </header>

      {/* ===== Main Content ===== */}
      <main className={styles.mainContent}>
        <Outlet />
      </main>

      {/* ===== FAB (only on non‑focused screens) ===== */}
      {!isFocused && (
        <div className={styles.fabContainer}>
          {fabOpen && (
            <div className={styles.fabMenu}>
              <button onClick={() => navigate("/create-event")}>
                Create Event
              </button>
              <button onClick={() => navigate("/create-task")}>
                Create Task
              </button>
            </div>
          )}
          <button className={styles.fab} onClick={() => setFabOpen(!fabOpen)}>
            <FiPlus size={24} />
          </button>
        </div>
      )}

      {/* ===== Bottom Navigation (only on non‑focused screens) ===== */}
      {!isFocused && bottomItems.length > 0 && (
        <nav className={styles.bottomNav}>
          {bottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
