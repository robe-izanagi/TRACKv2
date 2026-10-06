import { useEffect, useState } from "react";
import { FiActivity, FiAlertTriangle, FiRefreshCw, FiUsers } from "react-icons/fi";
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

function Metric({ label, value, detail, tone = "red" }) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricDetail}>{detail}</span>
    </article>
  );
}

function BarChart({ title, description, rows, series }) {
  const visibleRows = (rows || []).slice(-14);
  const maxValue = Math.max(
    1,
    ...visibleRows.flatMap((row) => series.map((item) => Number(item.value(row)) || 0)),
  );

  return (
    <section className={styles.chartPanel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className={styles.legend}>
          {series.map((item) => (
            <span key={item.label}>
              <i className={styles[item.tone]} />
              {item.label}
            </span>
          ))}
        </div>
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
                      style={{ height: `${Math.max(value ? 5 : 0, (value / maxValue) * 100)}%` }}
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
        <div className={styles.chartEmpty}>
          {rows ? "No activity in this date range." : "Chart data unavailable."}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ eyebrow, title, detail }) {
  return (
    <div className={styles.sectionTitle}>
      <span>{eyebrow}</span>
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>TRACK / ADMIN INTELLIGENCE</span>
          <h1>Analytics</h1>
          <p>Usage, requests, and account security in one view.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.rangeControl} aria-label="Analytics date range">
            {RANGES.map((days) => (
              <button
                key={days}
                type="button"
                className={range === days ? styles.selectedRange : ""}
                aria-pressed={range === days}
                onClick={() => {
                  setLoading(true);
                  setError("");
                  if (range === days) setRefreshKey((current) => current + 1);
                  else setRange(days);
                }}
              >
                {days === 365 ? "1 year" : `${days} days`}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              setLoading(true);
              setError("");
              setRefreshKey((current) => current + 1);
            }}
            aria-label="Refresh analytics"
            title="Refresh analytics"
            disabled={loading}
          >
            <FiRefreshCw className={loading ? styles.spinning : ""} />
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <FiAlertTriangle />
          <span>{error}</span>
          <button type="button" onClick={() => {
            setLoading(true);
            setError("");
            setRefreshKey((current) => current + 1);
          }}>
            Retry
          </button>
        </div>
      )}

      <SectionTitle
        eyebrow="01 / OVERVIEW"
        title="At a glance"
        detail={`Activity across the selected ${range}-day period.`}
      />
      <section className={styles.metrics} aria-label="Overview metrics">
        <Metric
          label="Registered users"
          value={!data ? "—" : number(totals.users?.total)}
          detail={!data ? "Awaiting analytics data" : `${number(totals.users?.active)} active`}
          tone="red"
        />
        <Metric
          label="Active admins"
          value={!data ? "—" : number(totals.admins?.active)}
          detail={!data ? "Awaiting analytics data" : `${number(totals.admins?.total)} total admin accounts`}
          tone="gold"
        />
        <Metric
          label="Sign-ins"
          value={!data ? "—" : number(loginTotals.success)}
          detail={!data ? "Awaiting analytics data" : `${number(loginTotals.failed)} failed attempts`}
          tone="green"
        />
        <Metric
          label="Open requests"
          value={!data ? "—" : number(pendingRequests)}
          detail={!data ? "Awaiting analytics data" : `${number(totalRequests)} requests in this period`}
          tone="blue"
        />
      </section>

      <SectionTitle
        eyebrow="02 / ACTIVITY"
        title="Daily patterns"
        detail="The most recent 14 days in the selected range."
      />
      <section className={styles.chartGrid}>
        <BarChart
          title="Sign-in activity"
          description="Successful and failed login attempts"
          rows={data ? (data.overview?.trends?.logins || []) : null}
          series={[
            { label: "Success", tone: "greenBar", value: (row) => row.success },
            { label: "Failed", tone: "redBar", value: (row) => row.failed },
          ]}
        />
        <BarChart
          title="New users"
          description="Registrations per day"
          rows={data ? (data.users?.registration_trend || []) : null}
          series={[{ label: "Users", tone: "goldBar", value: (row) => row.n }]}
        />
      </section>

      <SectionTitle
        eyebrow="03 / SECURITY"
        title="Login security"
        detail="Repeat failures and the reasons behind rejected sign-ins."
      />
      <section className={styles.securityGrid}>
        <article className={styles.dataPanel}>
          <div className={styles.panelHeading}>
            <div>
              <h2><FiUsers /> Repeat offenders</h2>
              <p>Accounts with repeated failed attempts</p>
            </div>
            <span className={styles.panelCount}>{data ? repeatUsers.length : "—"}</span>
          </div>
          {repeatUsers.length ? (
            <div className={styles.compactList}>
              {repeatUsers.slice(0, 6).map((item) => (
                <div className={styles.compactRow} key={item.user_id}>
                  <span className={styles.rowIdentity}>
                    <strong>{item.user?.username || "Unknown account"}</strong>
                    <small>{item.user?.email || "Account identifier unavailable"}</small>
                  </span>
                  <span className={styles.failureCount}>{number(item.failed)} failed</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>{data ? "No repeat account failures found." : "Security data unavailable."}</p>
          )}
        </article>

        <article className={styles.dataPanel}>
          <div className={styles.panelHeading}>
            <div>
              <h2><FiActivity /> Failure reasons</h2>
              <p>{number(loginTotals.failed)} failed attempts in this period</p>
            </div>
            <span className={styles.rate}>{data ? percent(loginTotals.failure_rate) : "—"}</span>
          </div>
          {topReasons.length ? (
            <div className={styles.reasonList}>
              {topReasons.map((item) => {
                const width = loginTotals.failed
                  ? Math.min(100, (item.count / loginTotals.failed) * 100)
                  : 0;
                return (
                  <div className={styles.reason} key={item.reason}>
                    <div><span>{item.reason.replaceAll("_", " ")}</span><strong>{number(item.count)}</strong></div>
                    <span className={styles.reasonTrack}><i style={{ width: `${width}%` }} /></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyState}>{data ? "No failed login attempts in this period." : "Security data unavailable."}</p>
          )}
        </article>
      </section>

      <SectionTitle
        eyebrow="04 / OUTLOOK"
        title="Requests and risk"
        detail="Current risk distribution and the request-volume forecast."
      />
      <section className={styles.outlookGrid}>
        <article className={styles.dataPanel}>
          <div className={styles.panelHeading}>
            <div>
              <h2><FiAlertTriangle /> User risk levels</h2>
              <p>Users with signals in the recent activity window</p>
            </div>
          </div>
          <div className={styles.riskLevels}>
            <div><span className={styles.criticalDot} />Critical<strong>{data ? number(riskCounts.critical) : "—"}</strong></div>
            <div><span className={styles.highDot} />High<strong>{data ? number(riskCounts.high) : "—"}</strong></div>
            <div><span className={styles.mediumDot} />Medium<strong>{data ? number(riskCounts.medium) : "—"}</strong></div>
            <div><span className={styles.lowDot} />Low or none<strong>{data ? number(riskCounts.low_or_none) : "—"}</strong></div>
          </div>
        </article>

        <article className={styles.forecastPanel}>
          <span className={styles.forecastLabel}>NEXT 14 DAYS / REQUESTS</span>
          <strong>{!data ? "—" : number(expectedRequests)}</strong>
          <p>Estimated account-code and profile-change requests</p>
          <div className={styles.forecastMeta}>
            <span>Confidence</span>
            <b>{data?.requests?.volume_forecast?.confidence || (data ? "insufficient data" : "unavailable")}</b>
          </div>
          <div className={styles.forecastMeta}>
            <span>Review backlog</span>
            <b>{data ? `${number(pendingRequests)} pending` : "unavailable"}</b>
          </div>
        </article>
      </section>

      {loading && data && <p className={styles.refreshNote}>Updating analytics…</p>}
    </div>
  );
}