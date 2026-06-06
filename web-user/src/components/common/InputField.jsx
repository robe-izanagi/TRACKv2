import React from "react";
import styles from "./InputField.module.css";
export default function Input({label, ...props}) {
  return (
    <label className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={styles.input} {...props} />
    </label>
  );
}
