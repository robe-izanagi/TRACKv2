import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.container}>
      {/* SIDEBAR / HEADER – you can customize later */}
      <aside className={styles.sidebar}>
        <h2>TRACK</h2>
        <nav>
          <ul>
            <li><a href="/">Dashboard</a></li>
            <li><a href="/calendar">Calendar</a></li>
            <li><a href="/events">Events</a></li>
            <li><a href="/tasks">Tasks</a></li>
            <li><a href="/venues">Venues</a></li>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/notifications">Notifications</a></li>
            <li><a href="/analytics">Analytics</a></li>
          </ul>
        </nav>
        <button onClick={logout}>Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className={styles.main}>
        <Outlet />   {/* child route renders here */}
      </main>
    </div>
  );
}