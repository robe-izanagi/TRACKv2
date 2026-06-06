import styles from './Modal.module.css';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}