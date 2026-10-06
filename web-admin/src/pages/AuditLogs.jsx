import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import {
  getAuditActionTypes,
  getAuditLogSummary,
  getAuditLogs,
} from "../api/admin";
import styles from "./AuditLogs.module.css";

const PAGE_SIZE = 20;
const dateInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const initialFilters = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: dateInputValue(from),
    to: dateInputValue(to),
    action_type: "",
    actor_type: "",
    severity: "",
    search: "",
  };
};
const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const displayDate = (value) => (value ? new Date(value).toLocaleString() : "—");
const initial = (value) => (value || "?").charAt(0).toUpperCase();

/* ── Skeleton building blocks ── */
function SkeletonStatCard() {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.skeleton} ${styles.skeletonStatIcon}`} />
      <div className={styles.statInfo}>
        <div className={`${styles.skeleton} ${styles.skeletonStatValue}`} />
        <div className={`${styles.skeleton} ${styles.skeletonStatLabel}`} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.skeletonList}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonRowWrap}>
          <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeleton} ${styles.skeletonLineLong}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
          </div>
          <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, tone, value, label }) {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[tone]}`}>{icon}</div>
      <div className={styles.statInfo}>
        <span className={styles.statValue}>
          {typeof value === "number" ? number(value) : value}
        </span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 });
  const [summary, setSummary] = useState(null);
  const [actionTypes, setActionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;
    getAuditActionTypes()
      .then((response) => {
        if (active) setActionTypes(response.action_types || []);
      })
      .catch(() => {
        if (active) setActionTypes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== ""),
    );

    Promise.all([
      getAuditLogs({ ...params, page, limit: PAGE_SIZE }),
      getAuditLogSummary({ from: filters.from, to: filters.to }),
    ])
      .then(([logResponse, summaryResponse]) => {
        if (!active) return;
        setLogs(logResponse.logs || []);
        setPagination(logResponse.pagination || { total: 0, total_pages: 0 });
        setSummary(summaryResponse);
        setUpdatedAt(new Date());
        setError("");
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Audit logs could not be loaded. Check the API connection and try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, refreshKey]);

  const reload = () => {
    setError("");
    setLoading(true);
    setRefreshKey((current) => current + 1);
  };

  const applyFilters = (event) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError("The start date must be before the end date.");
      return;
    }
    setFilterError("");
    setError("");
    setLoading(true);
    setPage(1);
    setFilters({ ...draft });
  };

  const resetFilters = () => {
    const next = initialFilters();
    setDraft(next);
    setFilters(next);
    setError("");
    setLoading(true);
    setPage(1);
    setFilterError("");
  };

  const severityCounts = Object.fromEntries(
    (summary?.by_severity || []).map((item) => [item.severity, item.count]),
  );
  const totalPages = Math.max(1, Number(pagination.total_pages) || 0);
  const totalActions = summary
    ? (summary.by_action || []).reduce(
        (total, item) => total + (Number(item.count) || 0),
        0,
      )
    : "—";

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>
            Review administrative actions and security events.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={reload}
            disabled={loading}
          >
            <FiRefreshCw className={loading ? styles.spinning : ""} size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <FiAlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Summary</h4>
          <span>Based on the selected date range</span>
        </div>
        <div className={styles.statsGrid} aria-label="Audit summary">
          {loading && !summary ? (
            Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))
          ) : (
            <>
              <StatCard
                icon={<FiActivity size={24} />}
                tone="toneInfo"
                value={totalActions}
                label="Actions in Range"
              />
              <StatCard
                icon={<FiAlertTriangle size={24} />}
                tone="toneWarning"
                value={summary ? severityCounts.warning || 0 : "—"}
                label="Warnings"
              />
              <StatCard
                icon={<FiAlertCircle size={24} />}
                tone="toneDanger"
                value={summary ? severityCounts.critical || 0 : "—"}
                label="Critical"
              />
              <StatCard
                icon={<FiUsers size={24} />}
                tone="toneSuccess"
                value={summary ? (summary.by_admin || []).length : "—"}
                label="Admins with Activity"
              />
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <form className={styles.listCard} onSubmit={applyFilters}>
        <div className={styles.listHeader}>
          <div>
            <h3>Filter Activity</h3>
            <p>Choose a date range or narrow by action, actor, and severity.</p>
          </div>
          <div className={styles.headerBadge}>
            <FiFilter />
          </div>
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.dateFilter}>
            <span>From</span>
            <input
              type="date"
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </label>
          <label className={styles.dateFilter}>
            <span>To</span>
            <input
              type="date"
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </label>
          <label className={styles.actionFilter}>
            <span>Action</span>
            <select
              value={draft.action_type}
              onChange={(event) =>
                setDraft({ ...draft, action_type: event.target.value })
              }
            >
              <option value="">All actions</option>
              {actionTypes.map((action) => (
                <option value={action} key={action}>
                  {action.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.actorFilter}>
            <span>Actor</span>
            <select
              value={draft.actor_type}
              onChange={(event) =>
                setDraft({ ...draft, actor_type: event.target.value })
              }
            >
              <option value="">All actors</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="system">System</option>
              <option value="anonymous">Anonymous</option>
            </select>
          </label>
          <label className={styles.severityFilter}>
            <span>Severity</span>
            <select
              value={draft.severity}
              onChange={(event) =>
                setDraft({ ...draft, severity: event.target.value })
              }
            >
              <option value="">All levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className={styles.searchField}>
            <span>Search</span>
            <div className={styles.searchInput}>
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                value={draft.search}
                placeholder="Descriptions, users, emails, or IDs"
                onChange={(event) =>
                  setDraft({ ...draft, search: event.target.value })
                }
              />
            </div>
          </label>
        </div>

        <div className={styles.filterFooter}>
          {filterError && (
            <span className={styles.filterError} role="alert">
              {filterError}
            </span>
          )}
          <button
            type="button"
            className={styles.resetBtn}
            onClick={resetFilters}
          >
            Reset
          </button>
          <button type="submit" className={styles.applyBtn}>
            <FiFilter size={16} /> Apply filters
          </button>
        </div>
      </form>

      {/* Log table */}
      <div className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <h3>Recorded Activity</h3>
            <p>
              {error && !summary
                ? "— results"
                : `${number(pagination.total)} results`}
            </p>
          </div>
          <div className={styles.headerBadge}>
            <FiFileText />
          </div>
        </div>

        {loading && !logs.length ? (
          <SkeletonRows />
        ) : error && !logs.length ? (
          <div className={styles.emptyState}>
            Audit events are unavailable until the API responds.
          </div>
        ) : logs.length ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target / Entity</th>
                  <th>Severity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const severity = ["info", "warning", "critical"].includes(
                    log.severity,
                  )
                    ? log.severity
                    : "info";
                  const actorName =
                    log.actor?.username || log.actor_type || "system";
                  return (
                    <tr key={log.id}>
                      <td className={styles.timeCell}>
                        {displayDate(log.created_at)}
                      </td>
                      <td>
                        <strong className={styles.actionName}>
                          {(log.action_type || "event").replaceAll("_", " ")}
                        </strong>
                        <small>{log.entity?.table || "—"}</small>
                      </td>
                      <td>
                        <div className={styles.actorCell}>
                          <div className={styles.avatarSmall}>
                            {initial(actorName)}
                          </div>
                          <div className={styles.cellText}>
                            <strong>{actorName}</strong>
                            <small>{log.actor_type || "unknown"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {log.target_user?.username ||
                            log.target_user?.email ||
                            "—"}
                        </strong>
                        <small>
                          {log.entity?.id || log.entity?.table || "No target"}
                        </small>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles[severity]}`}>
                          {severity}
                        </span>
                      </td>
                      <td className={styles.detailCell}>
                        <span>{log.description || "No description"}</span>
                        {log.metadata &&
                          Object.keys(log.metadata).length > 0 && (
                            <details>
                              <summary>Metadata</summary>
                              <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                            </details>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            No audit events match these filters.
          </div>
        )}

        <div className={styles.tableFooter}>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <div className={styles.pager}>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1 || loading}
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              <FiChevronLeft /> Previous
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.min(totalPages, current + 1));
              }}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className={styles.systemInfo}>
        <div className={styles.systemItem}>
          <FiServer size={18} />
          <span>Range</span>
          <span className={styles.systemStatus}>
            {filters.from || "…"} → {filters.to || "…"}
          </span>
        </div>
        <div className={styles.systemItem}>
          <FiClock size={18} />
          <span>Last Updated</span>
          <span>{updatedAt ? updatedAt.toLocaleString() : "—"}</span>
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
