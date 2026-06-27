import React from "react";
import styles from "./Notifications.module.css";
import { useState } from "react";

function Notifications() {
  const [filterType, setFilterType] = useState("all"); // all | events | tasks
  const [contentType, setContentType] = useState("all"); // all | campus | department | private

  return (
    <div className={styles.mainContainer}>
      <div className={styles.filterContainer}>
        <select name="filterType" id="filterType">
          <option value="all">All</option>
          <option value="all">Events</option>
          {/* <option value="all">Tasks</option> */}
        </select>
        <select name="contentType" id="contentType">
          <option value="all">All</option>
          <option value="campus">Campus</option>
          <option value="department">Department</option>
          <option value="private">Private</option>
        </select>
      </div>
      <div className={styles.mainContent}>
        {/* shows list of notification */}
      </div>
    </div>
  );
}

export default Notifications;
