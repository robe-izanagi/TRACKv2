import { useState, useEffect, useCallback } from "react";
import {
  getFeedbackSummary,
  getTextMining,
  getFeedbackList,
} from "../api/feedback";
import styles from "./Feedback.module.css";

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

export default function Feedback() {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [mining, setMining] = useState(null);
  const [miningLoading, setMiningLoading] = useState(true);

  const [rawFeedback, setRawFeedback] = useState([]);
  const [rawLoading, setRawLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    setSummaryLoading(true);
    getFeedbackSummary()
      .then((res) => {
        if (res.ok) setSummary(res.summary);
      })
      .catch((err) => console.error("Failed to fetch feedback summary:", err))
      .finally(() => setSummaryLoading(false));

    setMiningLoading(true);
    getTextMining()
      .then((res) => {
        if (res.ok) setMining(res);
      })
      .catch((err) => console.error("Failed to fetch text mining:", err))
      .finally(() => setMiningLoading(false));
  }, []);

  const fetchRaw = useCallback((rating) => {
    setRawLoading(true);
    getFeedbackList(rating)
      .then((res) => {
        if (res.ok) setRawFeedback(res.feedback);
      })
      .catch((err) => console.error("Failed to fetch raw feedback:", err))
      .finally(() => setRawLoading(false));
  }, []);

  useEffect(() => {
    fetchRaw(ratingFilter);
  }, [ratingFilter, fetchRaw]);

  const maxKeywordCount = mining?.keywords?.length
    ? Math.max(...mining.keywords.map((k) => k.count))
    : 1;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Feedback</h1>
      <p className={styles.subtitle}>
        All feedback is submitted anonymously — no user identity is stored or
        shown.
      </p>

      {/* ═══ TEXT MINING INSIGHTS (priority) ═══ */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Text Mining Insights</h2>
        {miningLoading ? (
          <p className={styles.loadingText}>Analyzing feedback comments...</p>
        ) : !mining || mining.keywords.length === 0 ? (
          <div className={styles.emptyState}>
            No feedback comments to analyze yet.
          </div>
        ) : (
          <>
            <p className={styles.miningMeta}>
              {mining.totalCommentsAnalyzed} comments analyzed
            </p>

            <h3 className={styles.subheading}>Most Frequent Keywords</h3>
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
                      style={{ width: `${(k.count / maxKeywordCount) * 100}%` }}
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

      {/* ═══ RATING SUMMARY ═══ */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Rating Summary</h2>
        {summaryLoading ? (
          <p className={styles.loadingText}>Loading summary...</p>
        ) : (
          <div className={styles.summaryGrid}>
            <div className={`${styles.summaryBox} ${styles.summaryGood}`}>
              <span className={styles.summaryValue}>{summary?.good ?? 0}</span>
              <span className={styles.summaryLabel}>Good</span>
            </div>
            <div className={`${styles.summaryBox} ${styles.summaryNeutral}`}>
              <span className={styles.summaryValue}>
                {summary?.neutral ?? 0}
              </span>
              <span className={styles.summaryLabel}>Neutral</span>
            </div>
            <div className={`${styles.summaryBox} ${styles.summaryBad}`}>
              <span className={styles.summaryValue}>
                {summary?.not_good ?? 0}
              </span>
              <span className={styles.summaryLabel}>Not Good</span>
            </div>
            <div className={styles.summaryBox}>
              <span className={styles.summaryValue}>{summary?.total ?? 0}</span>
              <span className={styles.summaryLabel}>Total</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ALL FEEDBACK (raw, secondary) ═══ */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>All Feedback</h2>
        <div className={styles.filterTabs}>
          {RATING_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`${styles.filterTab} ${ratingFilter === f.value ? styles.filterTabActive : ""}`}
              onClick={() => setRatingFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {rawLoading ? (
          <p className={styles.loadingText}>Loading feedback...</p>
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
                        className={`${styles.ratingBadge} ${styles[`badge_${f.rating}`]}`}
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
  );
}
