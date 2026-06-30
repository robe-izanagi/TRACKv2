import React from "react";
import styles from "./HomeFaculty.module.css";
import { useState } from "react";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";

function Home() {
  const [quickStat, setQuickStat] = useState("campus"); // "campus" | "department" | "private" | "task"

  return (
    <div className={styles.mainContainer}>
      <div className={styles.introContent}>
        <h1>Welcome, User FUllname</h1>
        {/* if null value, hide it, also remove the seperator "|" if hidden */}
        <p>Position | office | department</p>
      </div>
      <div className={styles.quickStat}>
        {quickStat == "campus" && (
          <div className={styles.quickCampus}>
            <div className={styles.quickTop}>
              <h2>Quick Stats, Campus Events</h2>
              <div className={styles.btnContainer}>
                <button className={styles.circleArrowButton}>
                  <IoIosArrowBack />
                </button>
                <button className={styles.circleArrowButton}>
                  <IoIosArrowForward />
                </button>
              </div>
            </div>
            <div className={styles.quickNav}>
              <div className={styles.filterButtons}>
                <button type="button">This Week</button>
                <button type="button">This Month</button>
              </div>
              <button type="button">View Analytics</button>
            </div>
          </div>
        )}
        {quickStat == "department" && (
          <div className={styles.quickDepartment}>
            <div className={styles.quickTop}>
              <h2>Quick Stats, Campus Events</h2>
            </div>
          </div>
        )}
        {quickStat == "private" && (
          <div className={styles.quickPrivate}>
            <div className={styles.quickTop}>
              <h2>Quick Stats, Campus Events</h2>
            </div>
          </div>
        )}
        {quickStat == "task" && (
          <div className={styles.quickTask}>
            <div className={styles.quickTop}>
              <h2>Quick Stats, Campus Events</h2>
            </div>
          </div>
        )}
      </div>
      <div className={styles.todaysEvent}>
        <div className={styles.titleContent}>
          <h1>Today's Event</h1>
          <div className={styles.btnArrowContainer}>
            <button type="button">
              <IoIosArrowBack />
            </button>
            <button type="button">
              <IoIosArrowForward />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.upcomingEvent}></div>
      <div className={styles.upcomingTask}></div>
    </div>
  );
}

export default Home;
