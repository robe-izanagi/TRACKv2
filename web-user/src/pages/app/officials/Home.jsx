// import React from "react";
// import styles from "./HomeOfficials.module.css";
// import { useState } from "react";
// import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";

// function Home() {
//   const [quickStat, setQuickStat] = useState("campus"); // "campus" | "department" | "private" | "task"

//   // const nav = navigation();

//   const gotoCalendar = () => {};

//   const sampleEvents = [
//     {
//       title: "Architechture Mapping Symposium",
//       description:
//         "the quick brown fox jumped over the lazy dogs the quick brown fox jumped over the lazy dogsthe quick brown fox jumped over the lazy dogs",
//       date: "Nov 15 - Nov 17, 2026",
//       time: "9:00 AM - 5:00 PM",
//       method: "Face To Face",
//       hierarchy: "Local",
//       eventType: "Meeting",
//       venue: "Gymnasium, Ground Floor Gym",
//       eventCreator: "Shiela Marie Garcia - Dean | CICS", // fullname - position - offices - department
//       participantDepartment: ["CICS", "CET", "CAS"],
//       participantOffice: ["Dean", "Chancellor"],
//     },
//   ];

//   return (
//     <div className={styles.mainContainer}>
//       <div className={styles.introContent}>
//         <h1>Welcome, User FUllname</h1>
//         {/* if null value, hide it, also remove the seperator "|" if hidden */}
//         <p>Position | office | department</p>
//       </div>
//       <div className={styles.quickStat}>
//         {quickStat == "campus" && (
//           <div className={styles.quickCampus}>
//             <div className={styles.quickTop}>
//               <h2>Quick Stats, Campus Events</h2>
//               <div className={styles.btnContainer}>
//                 <button className={styles.circleArrowButton}>
//                   <IoIosArrowBack />
//                 </button>
//                 <button className={styles.circleArrowButton}>
//                   <IoIosArrowForward />
//                 </button>
//               </div>
//             </div>
//             <div className={styles.quickNav}>
//               <div className={styles.filterButtons}>
//                 <button type="button">This Week</button>
//                 <button type="button">This Month</button>
//               </div>
//               <button type="button">View Analytics</button>
//             </div>
//           </div>
//         )}
//         {quickStat == "department" && (
//           <div className={styles.quickDepartment}>
//             <div className={styles.quickTop}>
//               <h2>Quick Stats, Campus Events</h2>
//             </div>
//           </div>
//         )}
//         {quickStat == "private" && (
//           <div className={styles.quickPrivate}>
//             <div className={styles.quickTop}>
//               <h2>Quick Stats, Campus Events</h2>
//             </div>
//           </div>
//         )}
//         {quickStat == "task" && (
//           <div className={styles.quickTask}>
//             <div className={styles.quickTop}>
//               <h2>Quick Stats, Campus Events</h2>
//             </div>
//           </div>
//         )}
//       </div>
//       <div className={styles.todaysEvent}>
//         <div className={styles.titleContainer}>
//           <div className={styles.titleContent}>
//             <h1>Today's Event</h1>
//             <div className={styles.btnArrowContainer}>
//               <button type="button">
//                 <IoIosArrowBack />
//               </button>
//               <button type="button">
//                 <IoIosArrowForward />
//               </button>
//             </div>
//           </div>
//           <div className={styles.subTitle}>
//             <h2>June 29, 2026</h2> {/* date */}
//             <button type="button" onClick={gotoCalendar()}>
//               View Calendar
//             </button>
//           </div>
//         </div>
//         <div className={styles.todayContent}>
//           {sampleEvents.forEach((sample) => {
//             <>
//               <p>{sample.title}</p>
//               <p>{sample.description}</p>
//               <p>{sample.date}</p>
//               <p>{sample.time}</p>
//               <p>{sample.method}</p>
//               <p>{sample.hierarchy}</p>
//               <p>{sample.eventType}</p>
//               <p>{sample.venue}</p> {/* if hierarchy !local : location will be used instead of venue */}
//               <p>{sample.eventCreator}</p>
//               <p>{sample.participantDepartment}</p>
//               <p>{sample.participantOffice}</p>
//             </>;
//           })}
//         </div>
//       </div>
//       <div className={styles.upcomingEvent}>
//         0
//       </div>
//       <div className={styles.upcomingTask}></div>
//     </div>
//   );
// }

// export default Home;

import React from 'react'

function Home() {
  return (
    <div>Home</div>
  )
}

export default Home