import styles from './InputField.module.css';

export default function InputField({ label, as: Tag = 'input', className = '', ...props }) {
  return (
    <label className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <Tag className={`${styles.input} ${className}`} {...props} />
    </label>
  );
}