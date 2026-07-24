import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./layout.module.css";
import { MdDashboard } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { BiAtom, BiMenu, BiSolidUser, BiLogOut } from "react-icons/bi";
import { useState } from "react";
import logo from "../assets/pup_logo.png";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [menuActive, setMenuActive] = useState(false);

  return (
    <div className={styles.mainContainer}>
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
          <div className={styles.topModules}>
            <BiSolidUser className={styles.userIcon} title="account" />
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <aside className={`${styles.aside} ${!menuActive ? styles.mini : ""}`}>
          {/* Filler for corner curve */}
          <div className={styles.filler} />

          {/* Welcome section */}
          <div className={styles.welcome}>
            {/* <p className={styles.welcomeText}>Welcome, Admin</p> */}
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
              <BiAtom className={styles.icon} />
              <span className={!menuActive ? styles.hide : ""}>
                User Management
              </span>
            </NavLink>
          </nav>

          <button onClick={handleLogout} className={styles.btnLogout}>
            <BiLogOut className={styles.icon} />
            <span className={!menuActive ? styles.hide : ""}>Logout</span>
          </button>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
