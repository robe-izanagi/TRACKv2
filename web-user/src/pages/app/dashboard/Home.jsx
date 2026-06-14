import { useAuth } from '../../../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <button onClick={logout}>Logout</button>
      <p>Your calendars and tasks will appear here.</p>
    </div>
  );
}