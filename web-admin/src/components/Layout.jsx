import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./layout.module.css";
import {
  MdDashboard,
  MdFeedback,
  MdManageAccounts,
  MdQueryStats,
  MdFactCheck,
} from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { BiAtom, BiMenu, BiLogOut } from "react-icons/bi";
import { useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import logo from "../assets/pup_logo.png";

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuActive, setMenuActive] = useState(() => window.innerWidth > 720);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("track-admin-theme") === "dark" ? "dark" : "light",
  );

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("track-admin-theme", nextTheme);
    setTheme(nextTheme);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={styles.mainContainer} data-admin-theme={theme}>
      <header className={styles.screenTop}>
        <div className={styles.menuContainer}>
          <BiMenu
            className={styles.menuIcon}
            title="menu"
            onClick={() => setMenuActive((prev) => !prev)}
          />
        </div>

        <div className={styles.topContent}>
          <div className={styles.title}>
            <img src={logo} alt="pup logo" width={30} height={30} />
            <h1>TRACK</h1>
          </div>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <FiSun /> : <FiMoon />}
          </button>
        </div>
      </header>

      <div className={styles.main}>
        <aside className={`${styles.aside} ${!menuActive ? styles.mini : ""}`}>
          <div className={styles.filler} />

          <div className={styles.welcome}>
            {/* <p className={styles.welcomeText}>Welcome, {user?.name}</p> */}
          </div>

          <nav className={styles.nav}>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <MdDashboard className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>Dashboard</span>
            </NavLink>

            <NavLink
              to="/account-codes"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <FaCode className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>
                Account Codes
              </span>
            </NavLink>

            <NavLink
              to="/declaration"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <BiAtom className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>
                Declaration
              </span>
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <MdManageAccounts className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>
                User Management
              </span>
            </NavLink>

            <NavLink
              to="/feedback"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <MdFeedback className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>
                Feedback
              </span>
            </NavLink>

            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              title="Analytics"
            >
              <MdQueryStats className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>Analytics</span>
            </NavLink>

            <NavLink
              to="/audit-logs"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              title="Audit Logs"
            >
              <MdFactCheck className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>Audit Logs</span>
            </NavLink>
          </nav>

          <button
            onClick={handleLogout}
            className={styles.btnLogout}
            title="logout"
          >
            <BiLogOut className={styles.icon} />
            <span className={!menuActive ? styles.hide : ""}>Logout</span>
          </button>
        </aside>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
