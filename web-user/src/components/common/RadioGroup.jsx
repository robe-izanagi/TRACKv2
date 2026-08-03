import styles from "./RadioGroup.module.css";

export default function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  groupClassName,
  optionsClassName,
  radioLabelClassName,
  labelClassName,
  optionContentClassName
}) {
  return (
    <div className={groupClassName || styles.group}>
      {label && <span className={labelClassName || styles.label}>{label}</span>}
      <div className={optionsClassName || styles.options}>
        {options.map((opt) => {
          const isSelected = value === opt.value;

          return (
            <label
              key={opt.value}
              className={radioLabelClassName || styles.radioLabel}
              style={{
                ...(opt.style || {}),
                ...(opt.color ? { backgroundColor: opt.color } : {}),
                ...(opt.textColor ? { color: opt.textColor } : {}),
                ...(isSelected ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)" } : {}),
              }}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={onChange}
              />
              <span className={optionContentClassName ||styles.optionContent}>
                {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
                <span>{opt.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
