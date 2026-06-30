import React, { useState } from "react";
import {
  FiX,
  FiChevronDown,
  FiUser,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiUsers,
} from "react-icons/fi";
import styles from "./ConflictCard.module.css";

const ConflictCard = ({
  conflictData,
  checking,
  isOpen,
  onClose,
  onApplyRecommendation,
}) => {
  const [activeTab, setActiveTab] = useState("venue");
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [recommendationFilter, setRecommendationFilter] = useState("all");

  if (!isOpen || !conflictData) return null;

  const { conflicts, recommendations } = conflictData;

  const getFilteredRecs = () => {
    if (!recommendations || recommendations.length === 0) return [];
    let filtered = recommendations;
    if (recommendationFilter === "all-free") {
      filtered = recommendations.filter(
        (r) =>
          r.conflict_free.venue &&
          r.conflict_free.attendees &&
          r.conflict_free.creator,
      );
    } else if (recommendationFilter === "creator-venue-free") {
      filtered = recommendations.filter(
        (r) => r.conflict_free.venue && r.conflict_free.creator,
      );
    } else if (recommendationFilter === "creator-free") {
      filtered = recommendations.filter((r) => r.conflict_free.creator);
    }
    return filtered;
  };

  const filteredRecs = getFilteredRecs();
  const displayRecs = showAllRecommendations
    ? filteredRecs
    : filteredRecs.slice(0, 3);

  const formatDateTime = (dt) => {
    const d = new Date(dt);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle}>
          <FiChevronDown size={24} />
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <FiX size={24} />
        </button>

        <h2 className={styles.title}>⏰ Schedule Conflicts</h2>

        <div className={styles.tabs}>
          {conflicts.venue.has && (
            <button
              className={`${styles.tab} ${activeTab === "venue" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("venue")}
            >
              Venue
            </button>
          )}
          {conflicts.attendees.has && (
            <button
              className={`${styles.tab} ${activeTab === "attendees" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("attendees")}
            >
              Attendees
            </button>
          )}
          {conflicts.creator.has && (
            <button
              className={`${styles.tab} ${activeTab === "creator" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("creator")}
            >
              You
            </button>
          )}
        </div>

        <div className={styles.tabContent}>
          {activeTab === "venue" && conflicts.venue.has && (
            <div>
              <h3>Venue Conflict</h3>
              {conflicts.venue.events.map((ev) => (
                <div key={ev.id} className={styles.conflictItem}>
                  <div className={styles.itemHeader}>
                    <span
                      className={styles.itemTitle}
                      style={{ backgroundColor: ev.color || "#ccc" }}
                    >
                      {ev.title}
                    </span>
                    <span className={styles.itemDate}>
                      {formatDateTime(ev.start_datetime)} –{" "}
                      {formatDateTime(ev.end_datetime)}
                    </span>
                  </div>
                  <div className={styles.itemDetails}>
                    <p>
                      <strong>Type:</strong> {ev.visibility} · {ev.hierarchy}
                    </p>
                    <p>
                      <strong>Description:</strong>{" "}
                      {ev.description || "No description"}
                    </p>
                    <p>
                      <strong>Creator:</strong>{" "}
                      {ev.creator?.username || "Unknown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "attendees" && conflicts.attendees.has && (
            <div>
              <h3>Attendee Conflicts</h3>
              {conflicts.attendees.users.map((u) => (
                <div key={u.user.id} className={styles.attendeeConflict}>
                  <div className={styles.attendeeHeader}>
                    <FiUser /> <strong>{u.user.username}</strong> (
                    {u.user.email})
                    <span className={styles.badge}>
                      {u.events.length} conflicting event(s)
                    </span>
                  </div>
                  {u.events.map((ev) => (
                    <div key={ev.id} className={styles.conflictItem}>
                      <div className={styles.itemHeader}>
                        <span
                          className={styles.itemTitle}
                          style={{ backgroundColor: ev.color || "#ccc" }}
                        >
                          {ev.title}
                        </span>
                        <span className={styles.itemDate}>
                          {formatDateTime(ev.start_datetime)} –{" "}
                          {formatDateTime(ev.end_datetime)}
                        </span>
                      </div>
                      <div className={styles.itemDetails}>
                        <p>
                          <strong>Venue:</strong> {ev.venue || "N/A"}
                        </p>
                        <p>
                          <strong>Creator:</strong>{" "}
                          {ev.creator?.username || "Unknown"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === "creator" && conflicts.creator.has && (
            <div>
              <h3>You have a conflict</h3>
              {conflicts.creator.events.map((ev) => (
                <div key={ev.id} className={styles.conflictItem}>
                  <div className={styles.itemHeader}>
                    <span
                      className={styles.itemTitle}
                      style={{ backgroundColor: ev.color || "#ccc" }}
                    >
                      {ev.title}
                    </span>
                    <span className={styles.itemDate}>
                      {formatDateTime(ev.start_datetime)} –{" "}
                      {formatDateTime(ev.end_datetime)}
                    </span>
                  </div>
                  <div className={styles.itemDetails}>
                    <p>
                      <strong>Type:</strong> {ev.visibility} · {ev.hierarchy}
                    </p>
                    <p>
                      <strong>Venue:</strong> {ev.venue || "Online"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {recommendations && recommendations.length > 0 && (
          <div className={styles.recommendations}>
            <h3>💡 Recommended Schedules</h3>
            <div className={styles.filterButtons}>
              <button
                className={`${styles.filterBtn} ${recommendationFilter === "all" ? styles.activeFilter : ""}`}
                onClick={() => setRecommendationFilter("all")}
              >
                All
              </button>
              <button
                className={`${styles.filterBtn} ${recommendationFilter === "all-free" ? styles.activeFilter : ""}`}
                onClick={() => setRecommendationFilter("all-free")}
              >
                All Free
              </button>
              <button
                className={`${styles.filterBtn} ${recommendationFilter === "creator-venue-free" ? styles.activeFilter : ""}`}
                onClick={() => setRecommendationFilter("creator-venue-free")}
              >
                Venue+You Free
              </button>
              <button
                className={`${styles.filterBtn} ${recommendationFilter === "creator-free" ? styles.activeFilter : ""}`}
                onClick={() => setRecommendationFilter("creator-free")}
              >
                You Free
              </button>
            </div>

            <div className={styles.slotList}>
              {displayRecs.map((slot, idx) => (
                <div
                  key={idx}
                  className={styles.slotItem}
                  onClick={() => onApplyRecommendation(slot)}
                >
                  <div className={styles.slotTime}>
                    <span className={styles.slotStart}>
                      {formatDateTime(slot.start_datetime)}
                    </span>
                    <span className={styles.slotArrow}>→</span>
                    <span className={styles.slotEnd}>
                      {formatDateTime(slot.end_datetime)}
                    </span>
                  </div>
                  <div className={styles.slotTags}>
                    {slot.conflict_free.venue && (
                      <span className={styles.tagFree}>Venue Free</span>
                    )}
                    {slot.conflict_free.attendees && (
                      <span className={styles.tagFree}>Attendees Free</span>
                    )}
                    {slot.conflict_free.creator && (
                      <span className={styles.tagFree}>You Free</span>
                    )}
                    {!slot.conflict_free.venue && (
                      <span className={styles.tagConflict}>Venue Conflict</span>
                    )}
                    {!slot.conflict_free.attendees && (
                      <span className={styles.tagConflict}>
                        Attendee Conflict
                      </span>
                    )}
                    {!slot.conflict_free.creator && (
                      <span className={styles.tagConflict}>You Conflict</span>
                    )}
                  </div>
                  <button className={styles.selectSlotBtn}>Select</button>
                </div>
              ))}
            </div>

            {filteredRecs.length > 3 && (
              <button
                className={styles.showMoreBtn}
                onClick={() =>
                  setShowAllRecommendations(!showAllRecommendations)
                }
              >
                {showAllRecommendations
                  ? "Show Less"
                  : `Show ${filteredRecs.length - 3} More`}
              </button>
            )}
          </div>
        )}

        <button className={styles.closeSheetBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ConflictCard;
