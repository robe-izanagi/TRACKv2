import styles from './SelectDropdown.module.css';

export default function SelectDropdown({ label, options, value, onChange, ...props }) {
  return (
    <label className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <select className={styles.select} value={value} onChange={onChange} {...props}>
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}