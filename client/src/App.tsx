import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";

import AdminLayout from "./layouts/AdminLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";

import Dashboard from "./pages/admin/Dashboard";
import Employee from "./pages/admin/Employee";
import Leave from "./pages/leave/Leave";

import ProtectedRoute from "./components/common/ProtectedRoute";

// Employee Pages (create these)
import EmployeeDashboard from "./pages/employee/Dashboard";
import Profile from "./pages/employee/Profile";
// import EmployeeLeaves from "./pages/employee/Leaves";
// import Profile from "./pages/employee/Profile";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Auth */}
        <Route path="/" element={<Login />} />

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Default redirect */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employees" element={<Employee />} />
          <Route path="leaves" element={<Leave />} />
          <Route path="reports" element={<div>Reports Page</div>} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* ================= EMPLOYEE ================= */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          {/* Default redirect */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="leaves" element={<Leave />} />
          <Route path="profile" element={<Profile />} />
          <Route path="reports" element={<div>Employee Reports</div>} />
        </Route>

        {/* Unauthorized */}
        <Route path="/unauthorized" element={<div>Unauthorized Access</div>} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;