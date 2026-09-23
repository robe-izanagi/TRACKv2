import { useState, useRef } from "react";
import { FiChevronDown, FiThumbsUp, FiThumbsDown, FiMeh } from "react-icons/fi";
import { useFeedbackSheet } from "../../context/FeedbackSheetContext";
import { submitFeedback } from "../../api/feedback";
import styles from "./FeedbackSheet.module.css";

const DRAG_CLOSE_THRESHOLD = 90;

export default function FeedbackSheet() {
  const { isOpen, closeFeedback } = useFeedbackSheet();
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });

  if (!isOpen) return null;

  const handleTouchStart = (e) => {
    dragRef.current.startY = e.touches[0].clientY;
    setDragging(true);
  };
  const handleTouchMove = (e) => {
    const delta = e.touches[0].clientY - dragRef.current.startY;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > DRAG_CLOSE_THRESHOLD) handleClose();
    setDragY(0);
    setDragging(false);
  };

  const handleClose = () => {
    setDragY(0);
    setRating(null);
    setComment("");
    setSubmitted(false);
    closeFeedback();
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await submitFeedback(rating, comment);
      setSubmitted(true);
      setTimeout(handleClose, 1200);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        <div
          className={styles.stickyHeader}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handle}>
            <FiChevronDown size={22} />
          </div>
        </div>

        <div className={styles.content}>
          {submitted ? (
            <div className={styles.thankYou}>
              <p className={styles.thankYouText}>
                Thank you for your feedback!
              </p>
            </div>
          ) : (
            <>
              <h2 className={styles.title}>
                How was TRACK's assistance help you manage an event schedule?
              </h2>
              <p className={styles.subtitle}>
                Help us improve how TRACK helps you manage and arrange events.
              </p>

              <div className={styles.sectionLabel}>OVERALL EXPERIENCE</div>
              <div className={styles.ratingRow}>
                <button
                  type="button"
                  className={`${styles.ratingBtn} ${rating === "not_good" ? styles.ratingBtnActiveBad : ""}`}
                  onClick={() => setRating("not_good")}
                >
                  <FiThumbsDown size={26} />
                  <span>Not Good</span>
                </button>
                <button
                  type="button"
                  className={`${styles.ratingBtn} ${rating === "neutral" ? styles.ratingBtnActiveNeutral : ""}`}
                  onClick={() => setRating("neutral")}
                >
                  <FiMeh size={26} />
                  <span>Neutral</span>
                </button>
                <button
                  type="button"
                  className={`${styles.ratingBtn} ${rating === "good" ? styles.ratingBtnActiveGood : ""}`}
                  onClick={() => setRating("good")}
                >
                  <FiThumbsUp size={26} />
                  <span>Good</span>
                </button>
              </div>

              <h3 className={styles.commentTitle}>
                How Did The Calendar Help You Arrange An Event Schedule?
              </h3>
              <div className={styles.sectionLabel}>COMMENT</div>
              <textarea
                className={styles.commentInput}
                placeholder="Share your thoughts on TRACK's overall assistance to help improve system..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={!rating || submitting}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
              <button
                type="button"
                className={styles.notNowBtn}
                onClick={handleClose}
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
