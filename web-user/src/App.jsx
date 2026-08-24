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

// Feature pages
import CalendarView from "./pages/app/calendar/CalendarView";
import VenuesList from "./pages/app/venues/VenuesList";
import Notifications from "./pages/app/notifications/Notifications";
import Profile from "./pages/app/profile/Profile";
import CreateEvent from "./pages/app/events/CreateEvent";
import CreateTask from "./pages/app/tasks/CreateTask";
import Events from "./pages/app/events/Events";
import EditEvent from "./components/events/EditEvent";
import EditTask from "./components/tasks/EditTask";
import Tasks from "./pages/app/tasks/Tasks";

const RoleRedirect = () => {
  const { user } = useAuth();
  const role = user?.role || "faculty";
  return (
    <Navigate to={`/${role == "officials" ? "heads" : role}/home`} replace />
  );
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
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<RoleRedirect />} />
            {/* <Route path="/officials/home" element={<OfficialsHome />} /> */}
            <Route path="/heads/home" element={<OfficialsHome />} />
            <Route path="/staff/home" element={<StaffHome />} />
            <Route path="/faculty/home" element={<FacultyHome />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/venues" element={<VenuesList />} />
            <Route path="/events" element={<Events />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/create-task" element={<CreateTask />} />
            <Route path="/edit-event/:id" element={<EditEvent />} />
            <Route path="/edit-task/:id" element={<EditTask />} />
            <Route path="*" element={<RoleRedirect />} />
          </Route>

          {/* Catch‑all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
