import { Bell, Search, ChevronDown, Menu } from "lucide-react";
import { useState } from "react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

interface Props {
  setSidebarOpen: (val: boolean) => void;
}

export default function Navbar({ setSidebarOpen }: Props) {
  const [openProfile, setOpenProfile] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // 1️⃣ Remove JWT cookie
    Cookies.remove("access_token");

    // 2️⃣ Redirect to login page
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 bg-[#13263f]/80 backdrop-blur-2xl border-b border-white/10">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-2 rounded-lg hover:bg-white/5"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
        <h2 className="text-lg sm:text-xl font-semibold">Dashboard</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-white/5">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full"></span>
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setOpenProfile(!openProfile)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center text-black font-bold">
              A
            </div>
            <ChevronDown size={16} className="hidden sm:block" />
          </button>

          {openProfile && (
            <div className="absolute right-0 mt-2 w-40 bg-[#13263f]/90 border border-white/10 rounded-xl">
              <button className="w-full text-left px-4 py-2 hover:bg-white/5">
                Profile
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-white/5">
                Settings
              </button>
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-white/5"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}