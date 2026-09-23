import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import { getUnreadCount } from "../../api/notifications";
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
  FiMapPin,
  FiList,
} from "react-icons/fi";
import styles from "./AppLayout.module.css";
import Menu from "../../components/menu/Menu";
import { CalendarProvider } from "../../context/CalendarContext";
import { EventsFilterProvider } from "../../context/EventsFilterContext";
import { TasksFilterProvider } from "../../context/TasksFilterContext";
import { FeedbackSheetProvider } from "../../context/FeedbackSheetContext";
import FeedbackSheet from "../../components/feedback/FeedbackSheet";

const FOCUSED_ROUTES = [
  "/notifications",
  "/profile",
  "/create-event",
  "/create-task",
  "/edit-event",
  "/edit-task",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fabContainerRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        if (data.ok && data.user.display_picture) {
          setProfilePicture(data.user.display_picture);
        }
      } catch (err) {
        // silent fail
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await getUnreadCount();
        if (res.ok) setUnreadCount(res.count);
      } catch (err) {
        // silent fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // ── Close FAB menu on any click/tap outside of it ──
  useEffect(() => {
    if (!fabOpen) return;

    const handleOutsideClick = (e) => {
      if (
        fabContainerRef.current &&
        !fabContainerRef.current.contains(e.target)
      ) {
        setFabOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [fabOpen]);

  // ── Close FAB menu whenever the route changes ──
  useEffect(() => {
    setFabOpen(false);
  }, [location.pathname]);

  const isFocused = FOCUSED_ROUTES.some((route) =>
    location.pathname.startsWith(route),
  );

  const role = user?.role || "faculty";
  const bottomItems = [];
  if (!isFocused) {
    if (role === "staff") {
      bottomItems.push(
        {
          label: "Home",
          path: `/${role == "officials" ? "heads" : role}/home`,
          icon: <FiHome size={20} />,
        },
        { label: "Venues", path: "/venues", icon: <FiMapPin size={20} /> },
        {
          label: "Calendar",
          path: "/calendar",
          icon: <FiCalendar size={20} />,
        },
        { label: "Events", path: "/events", icon: <FiList size={20} /> },
        { label: "Tasks", path: "/tasks", icon: <FiCheckSquare size={20} /> },
      );
    } else {
      bottomItems.push(
        {
          label: "Home",
          path: `/${role == "officials" ? "heads" : role}/home`,
          icon: <FiHome size={20} />,
        },
        { label: "Events", path: "/events", icon: <FiList size={20} /> },
        { label: "Tasks", path: "/tasks", icon: <FiCheckSquare size={20} /> },
        {
          label: "Calendar",
          path: "/calendar",
          icon: <FiCalendar size={20} />,
        },
      );
    }
  }

  // ── Turns a URL path into a top-bar title. Skips segments that look
  // like a UUID (e.g. /edit-event/:id) and uses the previous segment instead ──
  const pathToTitle = (path) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    let last = parts[parts.length - 1];
    if (UUID_REGEX.test(last) && parts.length > 1) {
      last = parts[parts.length - 2];
    }
    return last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <FeedbackSheetProvider>
      <EventsFilterProvider>
        <TasksFilterProvider>
          <CalendarProvider>
            <div className={styles.mobileContainer}>
              {/* Side Drawer */}
              {!isFocused && (
                <>
                  <div
                    className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
                  >
                    <div className={styles.drawerHeader}>
                      <h2>Menu</h2>
                      <button onClick={closeDrawer} className={styles.closeBtn}>
                        <FiX size={24} />
                      </button>
                    </div>
                    <div className={styles.drawerContent}>
                      <Menu
                        activePath={location.pathname}
                        onCloseDrawer={closeDrawer}
                      />
                    </div>
                  </div>
                  {drawerOpen && (
                    <div className={styles.overlay} onClick={closeDrawer} />
                  )}
                </>
              )}

              {/* Top Bar */}
              <header className={styles.topBar}>
                {isFocused ? (
                  <>
                    <button
                      className={styles.menuBtn}
                      onClick={() => navigate(-1)}
                    >
                      <FiArrowLeft size={24} />
                    </button>
                    <span className={styles.title}>
                      {location.pathname == "/profile"
                        ? "Profile & Analytics"
                        : pathToTitle(location.pathname)}
                    </span>
                    <div className={styles.topActions} />
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
                    </div>
                    <div className={styles.topActions}>
                      <button
                        onClick={() => navigate("/notifications")}
                        className={styles.iconBtn}
                        style={{ position: "relative" }}
                      >
                        <FiBell size={22} />
                        {unreadCount > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: -2,
                              right: -2,
                              background: "#dc2626",
                              color: "#fff",
                              fontSize: "10px",
                              fontWeight: 700,
                              borderRadius: "999px",
                              minWidth: "16px",
                              height: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0 3px",
                              border: "2px solid #fff",
                            }}
                          >
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => navigate("/profile")}
                        className={`${styles.iconBtn} ${styles.profileBtn}`}
                      >
                        {profilePicture ? (
                          <img
                            src={profilePicture}
                            alt="Profile"
                            className={styles.profileImg}
                          />
                        ) : (
                          <FiUser size={22} />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </header>

              {/* Main Content */}
              <main className={styles.mainContent}>
                <Outlet />
              </main>

              {/* FAB */}
              {!isFocused && (
                <div className={styles.fabContainer} ref={fabContainerRef}>
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
                  <button
                    className={styles.fab}
                    onClick={() => setFabOpen(!fabOpen)}
                  >
                    <FiPlus size={24} />
                  </button>
                </div>
              )}

              {/* Bottom Navigation */}
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
              <FeedbackSheet />
            </div>
          </CalendarProvider>
        </TasksFilterProvider>
      </EventsFilterProvider>
    </FeedbackSheetProvider>
  );
}
