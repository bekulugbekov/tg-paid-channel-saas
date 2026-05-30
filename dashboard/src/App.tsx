import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login       from "./pages/Login";
import Overview    from "./pages/Overview";
import Plans       from "./pages/Plans";
import Subscribers from "./pages/Subscribers";
import Settings    from "./pages/Settings";
import Admin       from "./pages/Admin";
import Layout      from "./components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview"    element={<Overview />} />
          <Route path="plans"       element={<Plans />} />
          <Route path="subscribers" element={<Subscribers />} />
          <Route path="settings"    element={<Settings />} />
          <Route path="admin"       element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
