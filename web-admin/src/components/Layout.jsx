import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./layout.module.css";
import { MdDashboard } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { BiAtom } from "react-icons/bi";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  

  return (
    <div className={styles.mainContainer}>
      {/* Sidebar */}
      <aside
        className={styles.aside}
      >
        <h2 className={styles.sideTitle}>TRACK ADMIN</h2>
        <nav className={styles.nav}>
          <NavLink to="/dashboard" className={styles.navLink}>
            <MdDashboard /> <p>Dashboard</p>
          </NavLink>
          <NavLink to="/account-codes" className={styles.navLink}>
            <FaCode /> <p>Account Codes</p>
          </NavLink>
          <NavLink to="/declaration" className={styles.navLink}>
            <BiAtom /> <p>Declaration</p>
          </NavLink>
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <button
            onClick={handleLogout}
            className={styles.btnLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24, background: "#f1f5f9" }}>
        {children}
      </main>
    </div>
  );
}

