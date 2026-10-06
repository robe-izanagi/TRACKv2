import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AccountCodes from "./pages/AccountCodes";
import Declaration from "./pages/Declaration";
import ManageUsers from "./pages/ManageUser";
import Feedback from "./pages/Feedback";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import "./App.css";
import Termsnconditions from "./pages/Termsnconditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<Termsnconditions />} />

          {/* Protected routes */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/account-codes" element={<AccountCodes />} />
            <Route path="/declaration" element={<Declaration />} />
            <Route path="/users" element={<ManageUsers />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
          </Route>

          {/* Default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
