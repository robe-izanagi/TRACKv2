import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";

// Public pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AuthCallback from "./pages/auth/AuthCallback";
import RequestAccountCode from "./pages/request-account-code/RequestAccountCode";

// Protected layout
import AppLayout from "./pages/app/AppLayout";

// Role dashboards
import OfficialsHome from "./pages/app/officials/Home";
import StaffHome from "./pages/app/staff/Home";
import FacultyHome from "./pages/app/faculty/Home";

// Feature pages (placeholders)
import CalendarView from "./pages/app/calendar/CalendarView";
import TasksList from "./pages/app/tasks/TasksList";
import UserAnalytics from "./pages/app/analytics/UserAnalytics";
import VenuesList from "./pages/app/venues/VenuesList";
import Notifications from "./pages/app/notifications/Notifications";
import Profile from "./pages/app/profile/Profile";
import CreateEvent from "./pages/app/events/CreateEvent";
import CreateTask from "./pages/app/tasks/CreateTask";

const RoleRedirect = () => {
  const { user } = useAuth();
  const role = user?.role || "faculty";
  return <Navigate to={`/${role}/home`} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/request-account-code"
            element={<RequestAccountCode />}
          />

          {/* Protected layout */}
          <Route
            element={
              // <RequireAuth>
                <AppLayout />
              // {/* </RequireAuth> */}
            }
          >
            <Route index element={<RoleRedirect />} />
            <Route path="/officials/home" element={<OfficialsHome />} />
            <Route path="/staff/home" element={<StaffHome />} />
            <Route path="/faculty/home" element={<FacultyHome />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/tasks" element={<TasksList />} />
            <Route path="/analytics" element={<UserAnalytics />} />
            <Route path="/venues" element={<VenuesList />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/create-task" element={<CreateTask />} />
            <Route path="*" element={<RoleRedirect />} />
          </Route>

          {/* Catch‑all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
