import React from "react";
import styles from "./SelectDropdown.module.css";
export default function SelectDropdown({options=[]}) {
  return <select className={styles.select}>{options.map((o,i)=><option key={i}>{o}</option>)}</select>;
}
