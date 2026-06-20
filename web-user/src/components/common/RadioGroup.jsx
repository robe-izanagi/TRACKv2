import styles from './RadioGroup.module.css';

export default function RadioGroup({ label, name, options, value, onChange }) {
  return (
    <div className={styles.group}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.options}>
        {options.map(opt => (
          <label key={opt.value} className={styles.radioLabel}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={onChange}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}