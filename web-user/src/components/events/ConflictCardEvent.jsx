import React, { useState, useRef } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCalendar,
  FiChevronDown,
} from "react-icons/fi";
import styles from "./ConflictCardEvent.module.css";

const DRAG_CLOSE_THRESHOLD = 90;

export default function ConflictCardEvent({ isOpen, onClose, event }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });

  if (!isOpen || !event) return null;
  const conflict = event.conflict || {};

  const handleTouchStart = (e) => {
    dragRef.current.startY = e.touches[0].clientY;
    setDragging(true);
  };
  const handleTouchMove = (e) => {
    const delta = e.touches[0].clientY - dragRef.current.startY;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > DRAG_CLOSE_THRESHOLD) onClose();
    setDragY(0);
    setDragging(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
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
          <h2 className={styles.title}>Conflict Details</h2>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.wrapper}>
            <div
              className={`${styles.statusBanner} ${conflict.isPriority ? styles.priorityBanner : styles.conflictBanner}`}
            >
              {conflict.isPriority ? (
                <FiCheckCircle size={20} />
              ) : (
                <FiAlertTriangle size={20} />
              )}
              <span>
                {conflict.isPriority
                  ? "Priority event: this event takes precedence over the overlapping event"
                  : "Not the priority: the overlapping event takes precedence"}
              </span>
            </div>

            <p className={styles.reasonText}>
              {conflict.reason || "No conflict details available."}
            </p>

            {conflict.conflictsWith && conflict.conflictsWith.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  <FiCalendar size={14} /> Conflicting With
                </h4>
                <div className={styles.conflictList}>
                  {conflict.conflictsWith.map((c) => (
                    <div key={c.id} className={styles.conflictItem}>
                      {c.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
