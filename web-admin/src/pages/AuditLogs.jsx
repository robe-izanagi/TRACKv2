import { useEffect, useState } from "react";
import { FiAlertTriangle, FiChevronLeft, FiChevronRight, FiRefreshCw, FiSearch } from "react-icons/fi";
import { getAuditActionTypes, getAuditLogSummary, getAuditLogs } from "../api/admin";
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
  return { from: dateInputValue(from), to: dateInputValue(to), action_type: "", actor_type: "", severity: "", search: "" };
};
const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const displayDate = (value) => value ? new Date(value).toLocaleString() : "—";

function CountTile({ label, value, tone }) {
  return (
    <div className={`${styles.countTile} ${styles[tone]}`}>
      <span>{label}</span>
      <strong>{typeof value === "number" ? number(value) : value}</strong>
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>TRACK / GOVERNANCE</span>
          <h1>Audit Logs</h1>
          <p>Review administrative actions and security events.</p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            setError("");
            setLoading(true);
            setRefreshKey((current) => current + 1);
          }}
          disabled={loading}
        >
          <FiRefreshCw className={loading ? styles.spinning : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <FiAlertTriangle />
          <span>{error}</span>
          <button type="button" onClick={() => {
            setError("");
            setLoading(true);
            setRefreshKey((current) => current + 1);
          }}>Retry</button>
        </div>
      )}

      <section className={styles.summary} aria-label="Audit summary">
        <CountTile
          label="Actions in range"
          value={summary ? (summary.by_action || []).reduce((total, item) => total + (Number(item.count) || 0), 0) : "—"}
          tone="red"
        />
        <CountTile label="Warnings" value={summary ? severityCounts.warning : "—"} tone="gold" />
        <CountTile label="Critical" value={summary ? severityCounts.critical : "—"} tone="critical" />
        <CountTile label="Admins with activity" value={summary ? (summary.by_admin || []).length : "—"} tone="green" />
      </section>

      <form className={styles.filters} onSubmit={applyFilters}>
        <div className={styles.filterHeader}>
          <div>
            <span className={styles.filterKicker}>LOG QUERY</span>
            <h2>Find an event</h2>
          </div>
          <button type="button" className={styles.clearButton} onClick={resetFilters}>Reset</button>
        </div>
        <label>
          <span>From</span>
          <input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        </label>
        <label>
          <span>Action</span>
          <select value={draft.action_type} onChange={(event) => setDraft({ ...draft, action_type: event.target.value })}>
            <option value="">All actions</option>
            {actionTypes.map((action) => <option value={action} key={action}>{action.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>
          <span>Actor</span>
          <select value={draft.actor_type} onChange={(event) => setDraft({ ...draft, actor_type: event.target.value })}>
            <option value="">All actors</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="system">System</option>
            <option value="anonymous">Anonymous</option>
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value })}>
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search description</span>
          <div className={styles.searchInput}>
            <FiSearch aria-hidden="true" />
            <input type="search" value={draft.search} placeholder="Search log descriptions" onChange={(event) => setDraft({ ...draft, search: event.target.value })} />
          </div>
        </label>
        <div className={styles.filterActions}>
          {filterError && <span role="alert">{filterError}</span>}
          <button type="submit" className={styles.applyButton}>Apply filters</button>
        </div>
      </form>

      <section className={styles.logSection}>
        <div className={styles.tableHeader}>
          <div>
            <span className={styles.filterKicker}>EVENT STREAM</span>
            <h2>Recorded activity</h2>
          </div>
          <span className={styles.resultCount}>{error && !summary ? "— results" : `${number(pagination.total)} results`}</span>
        </div>

        {loading && !logs.length ? (
          <div className={styles.stateMessage}>Loading audit events…</div>
        ) : error && !logs.length ? (
          <div className={styles.stateMessage}>Audit events are unavailable until the API responds.</div>
        ) : logs.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target / entity</th>
                  <th>Severity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>{displayDate(log.created_at)}</td>
                    <td>
                      <strong className={styles.actionName}>{(log.action_type || "event").replaceAll("_", " ")}</strong>
                      <small>{log.entity?.table || "—"}</small>
                    </td>
                    <td>
                      <strong>{log.actor?.username || log.actor_type || "system"}</strong>
                      <small>{log.actor_type || "unknown"}</small>
                    </td>
                    <td>
                      <strong>{log.target_user?.username || log.target_user?.email || "—"}</strong>
                      <small>{log.entity?.id || log.entity?.table || "No target"}</small>
                    </td>
                    <td><span className={`${styles.severity} ${styles[log.severity]}`}>{log.severity || "info"}</span></td>
                    <td className={styles.detailCell}>
                      <span>{log.description || "No description"}</span>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details>
                          <summary>Metadata</summary>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.stateMessage}>No audit events match these filters.</div>
        )}

        <footer className={styles.pagination}>
          <span>Page {page} of {totalPages}</span>
          <div>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => {
              setLoading(true);
              setPage((current) => Math.max(1, current - 1));
            }}>
              <FiChevronLeft />
            </button>
            <button type="button" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => {
              setLoading(true);
              setPage((current) => Math.min(totalPages, current + 1));
            }}>
              <FiChevronRight />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}