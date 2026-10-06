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
import { useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronRight,
  FiKey,
  FiMoon,
  FiSun,
  FiUser,
  FiX,
} from "react-icons/fi";
import { changeAdminPassword, getAdminMe } from "../api/auth";
import logo from "../assets/pup_logo.png";

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const accountRef = useRef(null);
  const [menuActive, setMenuActive] = useState(() => window.innerWidth > 720);
  const [account, setAccount] = useState(user);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("track-admin-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    let active = true;
    getAdminMe()
      .then((result) => {
        if (active && result.user) setAccount(result.user);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!passwordModalOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !savingPassword) {
        setPasswordModalOpen(false);
        setPasswordError("");
        setPasswordChanged(false);
        setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [passwordModalOpen, savingPassword]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("track-admin-theme", nextTheme);
    setTheme(nextTheme);
  };

  const openPasswordModal = () => {
    setAccountMenuOpen(false);
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    setPasswordError("");
    setPasswordChanged(false);
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (savingPassword) return;
    setPasswordModalOpen(false);
    setPasswordError("");
    setPasswordChanged(false);
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New password confirmation does not match.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      await changeAdminPassword(passwordForm);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordChanged(true);
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || "Could not change password. Please try again.",
      );
    } finally {
      setSavingPassword(false);
    }
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
          <div className={styles.accountArea} ref={accountRef}>
            <button
              type="button"
              className={styles.accountToggle}
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Open admin account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="dialog"
              title="Admin account"
            >
              <FiUser />
            </button>
            {accountMenuOpen && (
              <div className={styles.accountMenu} role="dialog" aria-label="Admin account">
                <span className={styles.accountMenuLabel}>ADMIN ACCOUNT</span>
                <div className={styles.accountIdentity}>
                  <span className={styles.accountAvatar} aria-hidden="true">
                    {(account?.username || user?.username || "A").charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.accountText}>
                    <strong>{account?.username || user?.username || "Admin"}</strong>
                    <small>{account?.email || user?.email || "Administrator"}</small>
                  </span>
                </div>
                <div className={styles.accountMenuDivider} />
                <button type="button" className={styles.accountAction} onClick={openPasswordModal}>
                  <FiKey />
                  <span>Change password</span>
                  <FiChevronRight className={styles.accountActionArrow} />
                </button>
              </div>
            )}
          </div>
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

      {passwordModalOpen && (
        <div
          className={styles.passwordOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePasswordModal();
          }}
        >
          <section
            className={styles.passwordDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <div className={styles.passwordDialogHeader}>
              <div>
                <span className={styles.accountMenuLabel}>ACCOUNT SECURITY</span>
                <h2 id="change-password-title">Change password</h2>
              </div>
              <button
                type="button"
                className={styles.passwordClose}
                onClick={closePasswordModal}
                aria-label="Close password dialog"
                disabled={savingPassword}
              >
                <FiX />
              </button>
            </div>

            {passwordChanged ? (
              <div className={styles.passwordSuccess} role="status">
                <FiCheckCircle />
                <div>
                  <strong>Password changed</strong>
                  <p>You are still signed in. Your new password is ready to use next time.</p>
                </div>
                <button type="button" className={styles.passwordSubmit} onClick={closePasswordModal}>
                  Done
                </button>
              </div>
            ) : (
              <form className={styles.passwordForm} onSubmit={handlePasswordSubmit}>
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.current_password}
                    onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.new_password}
                    onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordForm.confirm_password}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirm_password: event.target.value })}
                    required
                  />
                </label>
                {passwordError && (
                  <div className={styles.passwordError} role="alert">
                    <FiAlertCircle />
                    <span>{passwordError}</span>
                  </div>
                )}
                <div className={styles.passwordDialogActions}>
                  <button type="button" className={styles.passwordCancel} onClick={closePasswordModal} disabled={savingPassword}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.passwordSubmit} disabled={savingPassword}>
                    {savingPassword ? "Saving…" : "Change password"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
