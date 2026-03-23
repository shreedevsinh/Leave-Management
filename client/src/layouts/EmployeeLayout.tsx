import { useState } from "react";
import Sidebar from "../components/employee/Sidebar";
import Navbar from "../components/common/Navbar";
import { Outlet } from "react-router-dom";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-b from-[#0f1b2e] to-[#09121f] text-white">

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main */}
      <div className="flex-1 flex flex-col">

        {/* Navbar */}
        <Navbar setSidebarOpen={setSidebarOpen} />

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;