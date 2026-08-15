import { useState, useEffect, useCallback } from "react";
import { getAllUsers, toggleBlockUser, deleteUser } from "../api/adminUsers";
import {
  getChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} from "../api/profileRequests";
import FeedbackModal from "../components/common/FeedbackModal";
import styles from "./ManageUser.module.css";
import { FiRefreshCw } from "react-icons/fi";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [search, setSearch] = useState("");
  const [actioningUserId, setActioningUserId] = useState(null);

  const [reqStatus, setReqStatus] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  const fetchUsers = useCallback(async (term) => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await getAllUsers(term);
      if (res.ok) setUsers(res.users || []);
      else setUsersError("Failed to load users.");
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsersError("Unable to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers(search);
    }, 0);

    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(search);
  };

  const handleToggleBlock = async (user) => {
    const action = user.status === "blocked" ? "unblock" : "block";
    if (
      !window.confirm(
        `Are you sure you want to ${action} ${user.username || user.email}?`,
      )
    )
      return;
    setActioningUserId(user.id);
    try {
      const res = await toggleBlockUser(user.id);
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, status: res.status } : u,
          ),
        );
        showFeedback(res.message, "success");
      } else {
        showFeedback(res.message || "Failed to update user status.", "error");
      }
    } catch (err) {
      showFeedback(err.response?.data?.message || "Server error.", "error");
    } finally {
      setActioningUserId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmText = `Type "DELETE" to permanently remove ${user.username || user.email} and all their records. This cannot be undone.`;
    const typed = window.prompt(confirmText);
    if (typed !== "DELETE") return;
    setActioningUserId(user.id);
    try {
      const res = await deleteUser(user.id);
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        showFeedback(res.message, "success");
      } else {
        showFeedback(res.message || "Failed to delete user.", "error");
      }
    } catch (err) {
      showFeedback(err.response?.data?.message || "Server error.", "error");
    } finally {
      setActioningUserId(null);
    }
  };

  const fetchRequests = useCallback(async (currentStatus) => {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const res = await getChangeRequests(currentStatus);
      if (res.ok) setRequests(res.requests || []);
      else setRequestsError("Failed to load requests.");
    } catch (err) {
      console.error("Failed to fetch profile change requests:", err);
      setRequestsError("Unable to load requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRequests(reqStatus);
    }, 0);

    return () => clearTimeout(timer);
  }, [reqStatus, fetchRequests]);

  const handleApprove = async (id) => {
    if (
      !window.confirm(
        "Approve this profile change request? This will immediately apply the changes to the user's account.",
      )
    )
      return;
    setProcessingId(id);
    try {
      const res = await approveChangeRequest(id);
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        showFeedback(res.message || "Request approved.", "success");
      } else {
        showFeedback(res.message || "Failed to approve request.", "error");
      }
    } catch (err) {
      showFeedback(err.response?.data?.message || "Server error.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async (id) => {
    setProcessingId(id);
    try {
      const res = await rejectChangeRequest(id, rejectReason);
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setRejectingId(null);
        setRejectReason("");
        showFeedback(res.message || "Request rejected.", "success");
      } else {
        showFeedback(res.message || "Failed to reject request.", "error");
      }
    } catch (err) {
      showFeedback(err.response?.data?.message || "Server error.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() || "?";
  };

  const renderChangeRow = (label, current, requested) => (
    <div className={styles.changeRow}>
      <span className={styles.changeLabel}>{label}</span>
      <div className={styles.changeValues}>
        <span className={styles.currentValue}>{current || "—"}</span>
        <span className={styles.arrow}>→</span>
        <span className={styles.requestedValue}>
          {requested || "None (removed)"}
        </span>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Users</h1>
          <p className={styles.subtitle}>
            Manage Users, block, delete, and review profile change requests.
          </p>
        </div>
      </div>
      <div className={styles.pageGrid}>
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>User Records</h2>
            <button className={styles.refreshBtn}>
              <FiRefreshCw size={16} /> Refresh
            </button>
          </div>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className={styles.searchBtn}>
              Search
            </button>
          </form>

          {usersLoading ? (
            <p className={styles.loadingText}>Loading users...</p>
          ) : usersError ? (
            <p className={styles.errorText}>{usersError}</p>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>No users found.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Office</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatar}>
                            {u.display_picture ? (
                              <img
                                src={u.display_picture}
                                alt={u.full_name || u.username}
                              />
                            ) : (
                              <span>
                                {getInitials(u.full_name || u.username)}
                              </span>
                            )}
                          </div>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>
                              {u.full_name || u.username || "—"}
                            </span>
                            <span className={styles.username}>
                              @{u.username || u.full_name || "unknown"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        {u.department || <span className={styles.dim}>—</span>}
                      </td>
                      <td>
                        {u.office || <span className={styles.dim}>—</span>}
                      </td>
                      <td>{u.role || <span className={styles.dim}>—</span>}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${styles[`status_${u.status}`] || ""}`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            className={
                              u.status === "blocked"
                                ? styles.unblockBtn
                                : styles.blockBtn
                            }
                            onClick={() => handleToggleBlock(u)}
                            disabled={actioningUserId === u.id}
                          >
                            {u.status === "blocked" ? "Unblock" : "Block"}
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteUser(u)}
                            disabled={actioningUserId === u.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>Profile Change Requests</h2>
            <button className={styles.refreshBtn}>
              <FiRefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className={styles.subTabs}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`${styles.subTab} ${reqStatus === tab.value ? styles.activeSubTab : ""}`}
                onClick={() => setReqStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <p className={styles.loadingText}>Loading requests...</p>
          ) : requestsError ? (
            <p className={styles.errorText}>{requestsError}</p>
          ) : requests.length === 0 ? (
            <div className={styles.emptyState}>
              No {reqStatus !== "all" ? reqStatus : ""} requests found.
            </div>
          ) : (
            <div className={styles.requestList}>
              {requests.map((req) => (
                <div key={req.id} className={styles.requestCard}>
                  <div className={styles.requestHeader}>
                    <div>
                      <span className={styles.requesterName}>
                        {req.user.full_name}
                      </span>
                      <span className={styles.requesterEmail}>
                        {req.user.email}
                      </span>
                    </div>
                    <span className={styles.requestDate}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className={styles.changesBlock}>
                    {req.changes.includes("department_change") &&
                      renderChangeRow(
                        "Department",
                        req.current.department,
                        req.requested.department,
                      )}
                    {req.changes.includes("office_change") &&
                      renderChangeRow(
                        "Office",
                        req.current.office,
                        req.requested.office,
                      )}
                    {req.changes.includes("role_update") &&
                      renderChangeRow(
                        "Role",
                        req.current.role,
                        req.requested.role,
                      )}
                    {req.changes.includes("position_update") &&
                      renderChangeRow(
                        "Position",
                        req.current.position,
                        req.requested.position,
                      )}
                  </div>

                  {req.details && (
                    <div className={styles.detailsBlock}>
                      <span className={styles.detailsLabel}>Details</span>
                      <p className={styles.detailsText}>{req.details}</p>
                    </div>
                  )}

                  {req.status === "pending" ? (
                    rejectingId === req.id ? (
                      <div className={styles.rejectForm}>
                        <textarea
                          className={styles.rejectTextarea}
                          placeholder="Reason for rejection (optional)..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                        />
                        <div className={styles.rejectActions}>
                          <button
                            className={styles.cancelBtn}
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className={styles.confirmRejectBtn}
                            onClick={() => handleRejectConfirm(req.id)}
                            disabled={processingId === req.id}
                          >
                            {processingId === req.id
                              ? "Rejecting..."
                              : "Confirm Reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.actionsRow}>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => setRejectingId(req.id)}
                          disabled={processingId === req.id}
                        >
                          Reject
                        </button>
                        <button
                          className={styles.approveBtn}
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId === req.id}
                        >
                          {processingId === req.id ? "Approving..." : "Approve"}
                        </button>
                      </div>
                    )
                  ) : (
                    <div className={styles.reviewedRow}>
                      <span
                        className={`${styles.statusBadge} ${styles[`status_${req.status}`]}`}
                      >
                        {req.status}
                      </span>
                      {req.reviewed_by && (
                        <span className={styles.reviewedBy}>
                          by {req.reviewed_by} on{" "}
                          {new Date(req.reviewed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
