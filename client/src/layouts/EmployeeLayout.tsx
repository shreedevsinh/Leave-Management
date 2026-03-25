import { useState } from "react";
import Sidebar from "../components/employee/Sidebar";
import Navbar from "../components/common/Navbar";
import { Outlet } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = Cookies.get("access_token");
  if (!token) return null;

  const decoded: any = jwtDecode(token);
  const userName = decoded.name;
  const role = decoded.role;

  return (
    <div className="flex h-screen bg-gradient-to-b from-[#0f1b2e] to-[#09121f] text-white">

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} userName={userName} />

      {/* Main */}
      <div className="flex-1 flex flex-col">

        {/* Navbar */}
        <Navbar setSidebarOpen={setSidebarOpen} userName={userName} role={role} />

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;