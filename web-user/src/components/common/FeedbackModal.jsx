import { useEffect } from "react";
import { FiX, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import styles from "./FeedbackModal.module.css";

export default function FeedbackModal({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 10000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const isError = type === "error";
  const Icon = isError ? FiAlertCircle : FiCheckCircle;
  const iconColor = isError ? "#dc2626" : "#16a34a";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${isError ? styles.error : styles.success}`}
        onClick={(e) => e.stopPropagation()}
        role={isError ? "alert" : "status"}
      >
        <Icon size={20} color={iconColor} className={styles.icon} />
        <span className={styles.text}>{message}</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Dismiss message"
        >
          <FiX size={18} />
        </button>
      </div>
    </div>
  );
}