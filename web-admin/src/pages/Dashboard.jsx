import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // ← ADD
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import {
  FiUsers,
  FiCode,
  FiMail,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiUserPlus,
  FiTrendingUp,
  FiActivity,
  FiRefreshCcw,
  FiServer,
  FiArrowRight,
} from "react-icons/fi";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCodes: 0,
    pendingRequests: 0,
    activeUsers: 0,
    blockedUsers: 0,
    codesUsed: 0,
    codesUnused: 0,
    totalDepartments: 0,
    activeDepartments: 0,
    inactiveDepartments: 0,
    totalOffices: 0,
    activeOffices: 0,
    inactiveOffices: 0,
    totalPositions: 0,
    activePositions: 0,
    inactivePositions: 0,
    takenPositions: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const usersRes = await apiClient.get("/admin/users");
        const users = usersRes.data.users || [];

        const codesRes = await apiClient.get("/admin/account-codes");
        const codes = codesRes.data.codes || [];

        const requestsRes = await apiClient.get(
          "/account-code-requests?status=pending",
        );
        const requests = requestsRes.data.requests || [];

        const positionsRes = await apiClient.get("/admin/positions");
        const positions = positionsRes.data.positions || [];

        const assignmentsRes = await apiClient.get(
          "/admin/position-assignments",
        );
        const assignments = assignmentsRes.data.assignments || [];

        const assignedIds = assignments
          .filter((a) => a.status === "active")
          .map((a) => a.position_id);
        const takenPositionIds = new Set(assignedIds);

        const totalPositions = positions.length;
        const activePositions = positions.filter((p) => p.is_active).length;
        const inactivePositions = positions.filter((p) => !p.is_active).length;
        const takenPositions = positions.filter(
          (p) => !p.allow_multiple && takenPositionIds.has(p.id),
        ).length;

        const deptRes = await apiClient.get("/admin/departments");
        const officeRes = await apiClient.get("/admin/offices");

        const activeUsers = users.filter((u) => u.status === "active").length;
        const blockedUsers = users.filter(
          (u) => u.status === "blocked" || u.status === "suspended",
        ).length;
        const codesUsed = codes.filter((c) => c.status === "used").length;
        const codesUnused = codes.filter((c) => c.status === "unused").length;

        const departments = deptRes.data.items || [];
        const offices = officeRes.data.items || [];

        const totalDepartments = departments.length;
        const activeDepartments = departments.filter((d) => d.is_active).length;
        const inactiveDepartments = departments.filter(
          (d) => !d.is_active,
        ).length;

        const totalOffices = offices.length;
        const activeOffices = offices.filter((o) => o.is_active).length;
        const inactiveOffices = offices.filter((o) => !o.is_active).length;

        setStats({
          totalUsers: users.length,
          totalCodes: codes.length,
          pendingRequests: requests.length,
          activeUsers,
          blockedUsers,
          codesUsed,
          codesUnused,
          totalDepartments,
          activeDepartments,
          inactiveDepartments,
          totalOffices,
          activeOffices,
          inactiveOffices,
          totalPositions,
          activePositions,
          inactivePositions,
          takenPositions,
        });

        setRecentUsers(users.slice(0, 5));
        setRecentRequests(requests.slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setError("Unable to load dashboard data. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusBadge = (status) => {
    const map = {
      active: { class: styles.badgeActive, label: "Active" },
      blocked: { class: styles.badgeBlocked, label: "Blocked" },
      suspended: { class: styles.badgeSuspended, label: "Suspended" },
      pending: { class: styles.badgePending, label: "Pending" },
    };
    const s = map[status] || map.pending;
    return <span className={s.class}>{s.label}</span>;
  };

  const getRequestBadge = (status) => {
    const map = {
      pending: { class: styles.badgePending, label: "Pending" },
      approved: { class: styles.badgeApproved, label: "Approved" },
      rejected: { class: styles.badgeRejected, label: "Rejected" },
    };
    const s = map[status] || map.pending;
    return <span className={s.class}>{s.label}</span>;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Welcome back, {user?.full_name || user?.username || "Admin"}!
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={() => window.location.reload()}
          >
            <FiRefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statsSubsectionRow}>
        <div className={styles.statsSubsection}>
          <div className={styles.statsSubsectionHeader}>
            <h4>Users</h4>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconUsers}`}>
                <FiUsers size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.totalUsers}</span>
                <span className={styles.statLabel}>Total Users</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconActiveUsers}`}
              >
                <FiUserPlus size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.activeUsers}</span>
                <span className={styles.statLabel}>Active Users</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconBlockedUsers}`}
              >
                <FiAlertCircle size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.blockedUsers}</span>
                <span className={styles.statLabel}>Blocked / Suspended</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.statsSubsection}>
          <div className={styles.statsSubsectionHeader}>
            <h4>Positions</h4>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ background: "#e0e7ff", color: "#4f46e5" }}
              >
                <FiTrendingUp size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.totalPositions}</span>
                <span className={styles.statLabel}>Total Positions</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconActivePositions}`}
              >
                <FiServer size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.activePositions}
                </span>
                <span className={styles.statLabel}>Active Positions</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconInactivePositions}`}
              >
                <FiActivity size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.inactivePositions}
                </span>
                <span className={styles.statLabel}>Inactive Positions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsSubsectionRow}>
        <div className={styles.statsSubsection}>
          <div className={styles.statsSubsectionHeader}>
            <h4>Departments</h4>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconTotalDepartments}`}
              >
                <FiTrendingUp size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.totalDepartments}
                </span>
                <span className={styles.statLabel}>Total Departments</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconActiveDepartments}`}
              >
                <FiServer size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.activeDepartments}
                </span>
                <span className={styles.statLabel}>Active Departments</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconInactiveDepartments}`}
              >
                <FiActivity size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.inactiveDepartments}
                </span>
                <span className={styles.statLabel}>Inactive Departments</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.statsSubsection}>
          <div className={styles.statsSubsectionHeader}>
            <h4>Offices</h4>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconTotalOffices}`}
              >
                <FiTrendingUp size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.totalOffices}</span>
                <span className={styles.statLabel}>Total Offices</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconActiveOffices}`}
              >
                <FiServer size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.activeOffices}</span>
                <span className={styles.statLabel}>Active Offices</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={`${styles.statIcon} ${styles.statIconInactiveOffices}`}
              >
                <FiActivity size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {stats.inactiveOffices}
                </span>
                <span className={styles.statLabel}>Inactive Offices</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Account Codes</h4>
        </div>
        <div className={`${styles.statsGrid} ${styles.statsGridAccountCodes}`}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconTotalCodes}`}>
              <FiCode size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.totalCodes}</span>
              <span className={styles.statLabel}>Total Codes</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconCodesUsed}`}>
              <FiCheckCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.codesUsed}</span>
              <span className={styles.statLabel}>Codes Used</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconCodesUnused}`}>
              <FiClock size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.codesUnused}</span>
              <span className={styles.statLabel}>Codes Unused</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div
              className={`${styles.statIcon} ${styles.statIconPendingRequests}`}
            >
              <FiMail size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.pendingRequests}</span>
              <span className={styles.statLabel}>Pending Code Requests</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className={styles.tablesRow}>
        {/* Recent Users */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3>Recently Registered Users</h3>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className={styles.noData}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td className={styles.userCell}>
                        <span className={styles.userAvatar}>
                          {u.full_name?.charAt(0) ||
                            u.username?.charAt(0) ||
                            "?"}
                        </span>
                        <span className={styles.nameCell}>
                          {u.full_name || u.username || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.emailCell}>{u.email}</span>
                      </td>
                      <td>{getStatusBadge(u.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* ─── View All Link ─── */}
          <div className={styles.tableFooter}>
            <Link to="/users" className={styles.viewAllLink}>
              View All Users <FiArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Pending Account Requests */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3>Pending Account Code Requests</h3>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan="3" className={styles.noData}>
                      No pending requests
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={styles.nameCell}>
                          {r.full_name || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.emailCell}>{r.email}</span>
                      </td>
                      <td>{getRequestBadge(r.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* ─── View All Link ─── */}
          <div className={styles.tableFooter}>
            <Link to="/account-codes" className={styles.viewAllLink}>
              View All Requests <FiArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className={styles.systemInfo}>
        <div className={styles.systemItem}>
          <FiServer size={18} />
          <span>System Status</span>
          <span className={styles.systemStatus}>● Online</span>
        </div>
        <div className={styles.systemItem}>
          <FiClock size={18} />
          <span>Last Updated</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
        <div className={styles.systemItem}>
          <FiTrendingUp size={18} />
          <span>Version</span>
          <span>TRACK v2.0</span>
        </div>
      </div>
    </div>
  );
}
