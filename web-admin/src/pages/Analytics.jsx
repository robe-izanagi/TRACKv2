import { useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiBarChart2,
  FiClock,
  FiLogIn,
  FiMail,
  FiRefreshCw,
  FiServer,
  FiShield,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import {
  getAdminLoginSecurity,
  getAdminOverview,
  getAdminRequestAnalytics,
  getAdminRiskSummary,
  getAdminUserActivity,
} from "../api/admin";
import styles from "./Analytics.module.css";

const RANGES = [7, 30, 90, 365];
const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

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

function SkeletonPanel() {
  return (
    <div className={styles.listCard}>
      <div className={styles.listHeader}>
        <div>
          <div className={`${styles.skeleton} ${styles.skeletonPanelTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonPanelText}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonBadgeBox}`} />
      </div>
      <div className={styles.listBody}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
        ))}
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSubtitle}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonControl}`} />
      </div>
      <div className={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className={styles.panelRow}>
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
      <div className={styles.panelRow}>
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    </div>
  );
}

/* ── Reusable pieces ── */
function StatCard({ icon, tone, value, label, detail }) {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[tone]}`}>{icon}</div>
      <div className={styles.statInfo}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statDetail}>{detail}</span>
      </div>
    </div>
  );
}

function PanelHeader({ title, description, icon, aside }) {
  return (
    <div className={styles.listHeader}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {aside || <div className={styles.headerBadge}>{icon}</div>}
    </div>
  );
}

function BarChart({ title, description, icon, rows, series }) {
  const visibleRows = (rows || []).slice(-14);
  const maxValue = Math.max(
    1,
    ...visibleRows.flatMap((row) =>
      series.map((item) => Number(item.value(row)) || 0),
    ),
  );

  return (
    <div className={styles.listCard}>
      <PanelHeader title={title} description={description} icon={icon} />
      <div className={styles.chartBody}>
        <div className={styles.legend}>
          {series.map((item) => (
            <span key={item.label}>
              <i className={styles[item.tone]} />
              {item.label}
            </span>
          ))}
        </div>
        {visibleRows.length ? (
          <div className={styles.chart} role="img" aria-label={title}>
            {visibleRows.map((row) => (
              <div className={styles.chartDay} key={row.d} title={`${row.d}`}>
                <div className={styles.bars}>
                  {series.map((item) => {
                    const value = Number(item.value(row)) || 0;
                    return (
                      <span
                        key={item.label}
                        className={`${styles.bar} ${styles[item.tone]}`}
                        style={{
                          height: `${Math.max(value ? 5 : 0, (value / maxValue) * 100)}%`,
                        }}
                        title={`${item.label}: ${number(value)}`}
                      />
                    );
                  })}
                </div>
                <span className={styles.chartDate}>{row.d.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {rows
              ? "No activity in this date range."
              : "Chart data unavailable."}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      getAdminOverview({ range }),
      getAdminUserActivity({ range }),
      getAdminRequestAnalytics({ range }),
      getAdminLoginSecurity({ range }),
      getAdminRiskSummary(),
    ])
      .then(([overview, users, requests, security, risk]) => {
        if (active) {
          setData({ overview, users, requests, security, risk });
          setUpdatedAt(new Date());
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Analytics could not be loaded. Check the API connection and try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range, refreshKey]);

  const reload = () => {
    setLoading(true);
    setError("");
    setRefreshKey((current) => current + 1);
  };

  const totals = data?.overview?.totals || {};
  const loginTotals = data?.security?.summary || {};
  const requestSummary = data?.requests?.summary || {};
  const riskCounts = data?.risk?.counts || {};
  const totalRequests =
    (requestSummary.account_code?.total || 0) +
    (requestSummary.profile_change?.total || 0);
  const pendingRequests =
    (requestSummary.account_code?.pending || 0) +
    (requestSummary.profile_change?.pending || 0);
  const repeatUsers = data?.security?.repeat_offenders?.by_user || [];
  const failureReasons = data?.security?.failure_reasons || [];
  const topReasons = failureReasons.slice(0, 4);
  const forecastDays = data?.requests?.volume_forecast?.forecast || [];
  const expectedRequests = forecastDays.reduce(
    (sum, day) => sum + (Number(day.predicted) || 0),
    0,
  );

  if (loading && !data && !error) {
    return <AnalyticsSkeleton />;
  }

  const dash = (value) => (!data ? "—" : value);
  const waiting = "Awaiting analytics data";

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.subtitle}>
            Usage, requests, and account security in one view.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div
            className={styles.rangeControl}
            aria-label="Analytics date range"
          >
            {RANGES.map((days) => (
              <button
                key={days}
                type="button"
                className={`${styles.rangeBtn} ${range === days ? styles.rangeBtnActive : ""}`}
                aria-pressed={range === days}
                onClick={() => {
                  if (range === days) {
                    reload();
                  } else {
                    setLoading(true);
                    setError("");
                    setRange(days);
                  }
                }}
              >
                {days === 365 ? "1 year" : `${days} days`}
              </button>
            ))}
          </div>
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

      {/* Overview */}
      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Overview</h4>
          <span>Activity across the selected {range}-day period</span>
        </div>
        <div className={styles.statsGrid} aria-label="Overview metrics">
          <StatCard
            icon={<FiUsers size={24} />}
            tone="toneInfo"
            value={dash(number(totals.users?.total))}
            label="Registered Users"
            detail={!data ? waiting : `${number(totals.users?.active)} active`}
          />
          <StatCard
            icon={<FiShield size={24} />}
            tone="toneWarning"
            value={dash(number(totals.admins?.active))}
            label="Active Admins"
            detail={
              !data
                ? waiting
                : `${number(totals.admins?.total)} total admin accounts`
            }
          />
          <StatCard
            icon={<FiLogIn size={24} />}
            tone="toneSuccess"
            value={dash(number(loginTotals.success))}
            label="Sign-ins"
            detail={
              !data ? waiting : `${number(loginTotals.failed)} failed attempts`
            }
          />
          <StatCard
            icon={<FiMail size={24} />}
            tone="tonePink"
            value={dash(number(pendingRequests))}
            label="Open Requests"
            detail={
              !data
                ? waiting
                : `${number(totalRequests)} requests in this period`
            }
          />
        </div>
      </div>

      {/* Activity */}
      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Daily Patterns</h4>
          <span>The most recent 14 days in the selected range</span>
        </div>
        <div className={styles.panelRow}>
          <BarChart
            title="Sign-in Activity"
            description="Successful and failed login attempts"
            icon={<FiBarChart2 />}
            rows={data ? data.overview?.trends?.logins || [] : null}
            series={[
              {
                label: "Success",
                tone: "greenBar",
                value: (row) => row.success,
              },
              { label: "Failed", tone: "redBar", value: (row) => row.failed },
            ]}
          />
          <BarChart
            title="New Users"
            description="Registrations per day"
            icon={<FiUserPlus />}
            rows={data ? data.users?.registration_trend || [] : null}
            series={[
              { label: "Users", tone: "goldBar", value: (row) => row.n },
            ]}
          />
        </div>
      </div>

      {/* Security */}
      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Login Security</h4>
          <span>Repeat failures and the reasons behind rejected sign-ins</span>
        </div>
        <div className={styles.panelRow}>
          <div className={styles.listCard}>
            <PanelHeader
              title="Repeat Offenders"
              description="Accounts with repeated failed attempts"
              icon={<FiUsers />}
              aside={
                <div className={styles.countBadge}>
                  {data ? repeatUsers.length : "—"}
                </div>
              }
            />
            <div className={styles.listBody}>
              {repeatUsers.length ? (
                repeatUsers.slice(0, 6).map((item) => (
                  <div className={styles.listRow} key={item.user_id}>
                    <div className={styles.rowLeft}>
                      <div className={styles.avatarLarge}>
                        {(item.user?.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.rowInfo}>
                        <h4>{item.user?.username || "Unknown account"}</h4>
                        <p>
                          {item.user?.email || "Account identifier unavailable"}
                        </p>
                      </div>
                    </div>
                    <span className={styles.badgeFailed}>
                      {number(item.failed)} failed
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  {data
                    ? "No repeat account failures found."
                    : "Security data unavailable."}
                </div>
              )}
            </div>
          </div>

          <div className={styles.listCard}>
            <PanelHeader
              title="Failure Reasons"
              description={`${number(loginTotals.failed)} failed attempts in this period`}
              icon={<FiActivity />}
              aside={
                <div className={styles.countBadge}>
                  {data ? percent(loginTotals.failure_rate) : "—"}
                </div>
              }
            />
            <div className={styles.listBody}>
              {topReasons.length ? (
                topReasons.map((item) => {
                  const width = loginTotals.failed
                    ? Math.min(100, (item.count / loginTotals.failed) * 100)
                    : 0;
                  return (
                    <div className={styles.reasonRow} key={item.reason}>
                      <div className={styles.reasonTop}>
                        <span>{item.reason.replaceAll("_", " ")}</span>
                        <strong>{number(item.count)}</strong>
                      </div>
                      <div className={styles.reasonTrack}>
                        <i style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  {data
                    ? "No failed login attempts in this period."
                    : "Security data unavailable."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Outlook */}
      <div className={styles.statsSubsection}>
        <div className={styles.statsSubsectionHeader}>
          <h4>Requests and Risk</h4>
          <span>Current risk distribution and the request-volume forecast</span>
        </div>
        <div className={styles.panelRow}>
          <div className={styles.listCard}>
            <PanelHeader
              title="User Risk Levels"
              description="Users with signals in the recent activity window"
              icon={<FiAlertCircle />}
            />
            <div className={styles.riskGrid}>
              <div className={`${styles.riskItem} ${styles.riskCritical}`}>
                <span>Critical</span>
                <strong>{data ? number(riskCounts.critical) : "—"}</strong>
              </div>
              <div className={`${styles.riskItem} ${styles.riskHigh}`}>
                <span>High</span>
                <strong>{data ? number(riskCounts.high) : "—"}</strong>
              </div>
              <div className={`${styles.riskItem} ${styles.riskMedium}`}>
                <span>Medium</span>
                <strong>{data ? number(riskCounts.medium) : "—"}</strong>
              </div>
              <div className={`${styles.riskItem} ${styles.riskLow}`}>
                <span>Low or none</span>
                <strong>{data ? number(riskCounts.low_or_none) : "—"}</strong>
              </div>
            </div>
          </div>

          <div className={styles.forecastCard}>
            <div className={styles.forecastTop}>
              <div className={styles.forecastIcon}>
                <FiTrendingUp size={22} />
              </div>
              <span>Next 14 days</span>
            </div>
            <strong className={styles.forecastValue}>
              {!data ? "—" : number(expectedRequests)}
            </strong>
            <p>Estimated account-code and profile-change requests</p>
            <div className={styles.forecastMeta}>
              <span>Confidence</span>
              <b>
                {data?.requests?.volume_forecast?.confidence ||
                  (data ? "insufficient data" : "unavailable")}
              </b>
            </div>
            <div className={styles.forecastMeta}>
              <span>Review backlog</span>
              <b>
                {data ? `${number(pendingRequests)} pending` : "unavailable"}
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className={styles.systemInfo}>
        <div className={styles.systemItem}>
          <FiServer size={18} />
          <span>Date Range</span>
          <span className={styles.systemStatus}>
            {range === 365 ? "Last 1 year" : `Last ${range} days`}
          </span>
        </div>
        <div className={styles.systemItem}>
          <FiClock size={18} />
          <span>Last Updated</span>
          <span>
            {loading && data
              ? "Updating…"
              : updatedAt
                ? updatedAt.toLocaleString()
                : "—"}
          </span>
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
