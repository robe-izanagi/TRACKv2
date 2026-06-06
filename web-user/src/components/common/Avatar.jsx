import React from "react";
import styles from "./Avatar.module.css";
export default function Avatar({src, alt}) { return <img className={styles.img} src={src} alt={alt} />; }
