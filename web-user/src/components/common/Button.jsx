import styles from "./Button.module.css";

export default function Button({
  variant = "primary",
  icon,
  className = "",
  children,
  ...props
}) {
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...props}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
}
