import React from "react";
import styles from "./Badge.module.css";
export default function Badge({children}){ return <span className={styles.badge}>{children}</span>; }
