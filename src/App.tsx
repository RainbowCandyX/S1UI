import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Threats from "./pages/Threats";
import Sites from "./pages/Sites";
import Exclusions from "./pages/Exclusions";
import DeepVisibility from "./pages/DeepVisibility";
import Settings from "./pages/Settings";
import { useAuthStore } from "./store/auth";

function RequireAuth({ children }: { children: JSX.Element }) {
  const connected = useAuthStore((s) => s.connected);
  return connected ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="threats" element={<Threats />} />
        <Route path="sites" element={<Sites />} />
        <Route path="exclusions" element={<Exclusions />} />
        <Route path="deep-visibility" element={<DeepVisibility />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
