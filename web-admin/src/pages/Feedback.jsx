import { useState, useEffect, useCallback } from "react";
import {
  getFeedbackSummary,
  getTextMining,
  getFeedbackList,
} from "../api/feedback";
import styles from "./Feedback.module.css";
import {
  FiRefreshCw,
  FiSmile,
  FiMeh,
  FiFrown,
  FiBarChart2,
} from "react-icons/fi";

const RATING_LABELS = {
  good: "Good",
  neutral: "Neutral",
  not_good: "Not Good",
};
const RATING_FILTERS = [
  { value: "all", label: "All" },
  { value: "not_good", label: "Not Good" },
  { value: "neutral", label: "Neutral" },
  { value: "good", label: "Good" },
];

// ── Skeleton helpers ────────────────────────────────────
function SkeletonKeywordRow() {
  return (
    <div className={styles.skeletonKeywordRow}>
      <div className={`${styles.skeleton} ${styles.skeletonKeywordWord}`} />
      <div className={`${styles.skeleton} ${styles.skeletonKeywordBar}`} />
    </div>
  );
}

function SkeletonFeedbackRow() {
  return (
    <tr>
      <td>
        <div className={`${styles.skeleton} ${styles.skeletonBadgeCell}`} />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "220px" }}
        />
      </td>
      <td>
        <div
          className={`${styles.skeleton} ${styles.skeletonCell}`}
          style={{ width: "80px" }}
        />
      </td>
    </tr>
  );
}

export default function Feedback() {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [mining, setMining] = useState(null);
  const [miningLoading, setMiningLoading] = useState(true);

  const [rawFeedback, setRawFeedback] = useState([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState("all");

  const fetchSummary = useCallback(() => {
    setSummaryLoading(true);
    return getFeedbackSummary()
      .then((res) => {
        if (res.ok) setSummary(res.summary);
      })
      .catch((err) => console.error("Failed to fetch feedback summary:", err))
      .finally(() => setSummaryLoading(false));
  }, []);

  const fetchMining = useCallback(() => {
    setMiningLoading(true);
    return getTextMining()
      .then((res) => {
        if (res.ok) setMining(res);
      })
      .catch((err) => console.error("Failed to fetch text mining:", err))
      .finally(() => setMiningLoading(false));
  }, []);

  const fetchRaw = useCallback((rating) => {
    setRawLoading(true);
    return getFeedbackList(rating)
      .then((res) => {
        if (res.ok) setRawFeedback(res.feedback);
      })
      .catch((err) => console.error("Failed to fetch raw feedback:", err))
      .finally(() => setRawLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchMining();
  }, [fetchSummary, fetchMining]);

  useEffect(() => {
    fetchRaw(ratingFilter);
  }, [ratingFilter, fetchRaw]);

  const handleRefreshAll = () => {
    fetchSummary();
    fetchMining();
    fetchRaw(ratingFilter);
  };

  const isRefreshing = summaryLoading || miningLoading || rawLoading;

  const maxKeywordCount = mining?.keywords?.length
    ? Math.max(...mining.keywords.map((k) => k.count))
    : 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Feedback</h1>
          <p className={styles.subtitle}>
            All feedback is submitted anonymously — no user identity is stored
            or shown.
          </p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefreshAll}
          disabled={isRefreshing}
        >
          <FiRefreshCw
            size={16}
            className={isRefreshing ? styles.spinning : ""}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className={styles.pageStack}>
        {/* ═══ RATING SUMMARY ═══ */}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>Rating Summary</h2>
          </div>

          {summaryLoading ? (
            <p className={styles.loadingText}>Loading summary...</p>
          ) : (
            <div className={styles.summaryGrid}>
              <div className={`${styles.summaryBox} ${styles.summaryGood}`}>
                <FiSmile className={styles.summaryIcon} />
                <span className={styles.summaryValue}>
                  {summary?.good ?? 0}
                </span>
                <span className={styles.summaryLabel}>Good</span>
              </div>
              <div className={`${styles.summaryBox} ${styles.summaryNeutral}`}>
                <FiMeh className={styles.summaryIcon} />
                <span className={styles.summaryValue}>
                  {summary?.neutral ?? 0}
                </span>
                <span className={styles.summaryLabel}>Neutral</span>
              </div>
              <div className={`${styles.summaryBox} ${styles.summaryBad}`}>
                <FiFrown className={styles.summaryIcon} />
                <span className={styles.summaryValue}>
                  {summary?.not_good ?? 0}
                </span>
                <span className={styles.summaryLabel}>Not Good</span>
              </div>
              <div className={styles.summaryBox}>
                <FiBarChart2 className={styles.summaryIcon} />
                <span className={styles.summaryValue}>
                  {summary?.total ?? 0}
                </span>
                <span className={styles.summaryLabel}>Total</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ TEXT MINING INSIGHTS ═══ */}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>Text Mining Insights</h2>
            {!miningLoading && mining && mining.keywords.length > 0 && (
              <span className={styles.miningMeta}>
                {mining.totalCommentsAnalyzed} comments analyzed
              </span>
            )}
          </div>

          {miningLoading ? (
            <div className={styles.keywordList}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonKeywordRow key={i} />
              ))}
            </div>
          ) : !mining || mining.keywords.length === 0 ? (
            <div className={styles.emptyState}>
              No feedback comments to analyze yet.
            </div>
          ) : (
            <>
              <div className={styles.keywordList}>
                {mining.keywords.map((k) => (
                  <div key={k.word} className={styles.keywordRow}>
                    <div className={styles.keywordTop}>
                      <span className={styles.keywordWord}>{k.word}</span>
                      <span className={styles.keywordCount}>{k.count}</span>
                    </div>
                    <div className={styles.keywordBarTrack}>
                      <div
                        className={styles.keywordBarFill}
                        style={{
                          width: `${(k.count / maxKeywordCount) * 100}%`,
                        }}
                      />
                    </div>
                    <div className={styles.keywordRatings}>
                      <span className={styles.ratingTagGood}>
                        Good: {k.ratings.good}
                      </span>
                      <span className={styles.ratingTagNeutral}>
                        Neutral: {k.ratings.neutral}
                      </span>
                      <span className={styles.ratingTagBad}>
                        Not Good: {k.ratings.not_good}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {mining.phrases.length > 0 && (
                <>
                  <h3 className={styles.subheading}>Frequent Phrases</h3>
                  <div className={styles.phraseList}>
                    {mining.phrases.map((p) => (
                      <div key={p.phrase} className={styles.phraseItem}>
                        <span className={styles.phraseText}>"{p.phrase}"</span>
                        <span className={styles.phraseCount}>{p.count}×</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ═══ ALL FEEDBACK ═══ */}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>All Feedback</h2>
            <div className={styles.subTabs}>
              {RATING_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`${styles.subTab} ${
                    ratingFilter === f.value ? styles.activeSubTab : ""
                  }`}
                  onClick={() => setRatingFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {rawLoading ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonFeedbackRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : rawFeedback.length === 0 ? (
            <div className={styles.emptyState}>
              No feedback found for this filter.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rawFeedback.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span
                          className={`${styles.ratingBadge} ${
                            styles[`badge_${f.rating}`]
                          }`}
                        >
                          {RATING_LABELS[f.rating]}
                        </span>
                      </td>
                      <td>
                        {f.comment || (
                          <span className={styles.dim}>No comment</span>
                        )}
                      </td>
                      <td>{new Date(f.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
