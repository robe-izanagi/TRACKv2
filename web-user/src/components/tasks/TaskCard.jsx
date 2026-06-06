import React from "react";
import styles from "./TaskCard.module.css";
export default function TaskCard({task}){ return <div className={styles.card}>{task?.title || "Task"}</div>; }
