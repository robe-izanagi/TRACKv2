import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user?.username || 'Admin'}!</p>
      <button onClick={logout}>Logout</button>
      <p><em>(More features coming soon)</em></p>
    </div>
  );
}