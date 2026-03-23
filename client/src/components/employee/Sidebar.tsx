import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface Props {
  open: boolean;
  setOpen: (val: boolean) => void;
}

export default function EmployeeSidebar({ open, setOpen }: Props) {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
    { name: "My Leaves", icon: CalendarDays, path: "/employee/leaves" },
    { name: "Reports", icon: FileText, path: "/employee/reports" },
    { name: "Profile", icon: User, path: "/employee/profile" },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-50 top-0 left-0 h-full w-64 
        bg-[#13263f]/80 backdrop-blur-2xl border-r border-white/10 
        p-5 transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center font-bold">
              E
            </div>
            <h1 className="text-lg font-semibold">Employee</h1>
          </div>

          <button className="md:hidden" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Menu */}
        <nav className="space-y-2">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.path);

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors
                ${
                  isActive
                    ? "bg-blue-400/10 text-blue-400"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}