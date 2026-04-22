import { useEffect, useState } from "react";
import {
  Calendar, Search, IndianRupee, ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Cookies from "js-cookie";
import Toast from "../../components/common/Toast";

interface Payroll {
  id: string;
  month: number;
  year: number;
  totalDays: number;
  workingDays: number;
  leaveDays: number;
  paidDays: number;
  baseSalary: number;
  salary: number;
  efficiency: number;
  totalWorkingHoursForMonth: number;
  paidHours: number;
  user: {
    name: string;
    email: string;
  };
}

export default function MonthlyReports() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const token = Cookies.get("access_token");
  if (!token) return null;

  const [data, setData] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = 10;

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState("");

  const [totalSalary, setTotalSalary] = useState(0);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // =========================
  // GLOBAL FETCH FUNCTION
  // =========================
  const fetchReports = async (reset = false, cursor?: string | null) => {
    try {
      setLoading(true);

      const cursorParam = cursor ? `&cursor=${cursor}` : "";

      const res = await fetch(
        `${API_URL}/payroll?month=${month}&year=${year}&limit=${limit}${cursorParam}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      // ✅ HANDLE EMPTY RESPONSE PROPERLY
      if (!json.items || json.items.length === 0) {
        setData([]);              // clear old data
        setTotalSalary(0);        // reset stats
        setNextCursor(null);
        return;
      }

      setTotalSalary(json.totalSalary);

      setData(json.items);

      if (reset) setPrevCursors([]);

      setNextCursor(json.nextCursor || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextPage = () => {
    if (!nextCursor) return;

    setPrevCursors((p) => [...p, nextCursor]);
    setPage((p) => p + 1);
    fetchReports(false, nextCursor);
  };

  const prevPage = () => {
    if (prevCursors.length === 0) return;

    const updated = [...prevCursors];
    updated.pop(); // remove current cursor
    const previousCursor = updated[updated.length - 1] || null;

    setPrevCursors(updated);
    setPage((p) => p - 1);
    fetchReports(false, previousCursor);
  };

  // =========================
  // REFRESH WHEN MONTH/YEAR CHANGES
  // =========================
  useEffect(() => {
    setNextCursor(null);
    setPage(1);
    fetchReports(true);
  }, [month, year]);

  // =========================
  // FILTER SEARCH
  // =========================
  const filtered = data.filter((item) =>
    item.user.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalEmployees = filtered.length;

  // =========================
  // GENERATE PAYROLL
  // =========================
  const generatePayroll = async () => {
    const res = await fetch(
      `${API_URL}/payroll/generate?month=${month}&year=${year}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (res.ok) {
      fetchReports(true);
      setToast({
        message: "Payroll generated successfully",
        type: "success",
      });
    } else {
      fetchReports(true);
      setToast({
        message: "Something went wrong",
        type: "error",
      });
    }
  };

  return (
    <div className="p-3 space-y-6 text-white">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Monthly Reports</h1>

        <div className="flex gap-3">
          {/* MONTH */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-[#13263f] border border-white/10 px-3 py-2 rounded-xl"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i + 1}>
                {new Date(0, i).toLocaleString("default", {
                  month: "long",
                })}
              </option>
            ))}
          </select>

          {/* YEAR */}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 bg-[#13263f] border border-white/10 px-3 py-2 rounded-xl"
          />

          {/* GENERATE PAYROLL */}
          <button
            onClick={generatePayroll}
            className="bg-gradient-to-r from-green-400 to-teal-400 text-[#0f1e33] font-semibold px-5 py-2.5 rounded-xl"
          >
            Generate Payroll
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#13263f]/70 p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Employees</p>
          <h2 className="text-xl font-semibold">{totalEmployees}</h2>
        </div>

        <div className="bg-[#13263f]/70 p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Total Payout</p>
          <h2 className="text-xl font-semibold flex items-center gap-1">
            <IndianRupee size={16} /> {totalSalary.toLocaleString()}
          </h2>
        </div>

        <div className="bg-[#13263f]/70 p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Month</p>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar size={16} /> {month}/{year}
          </h2>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#13263f] border border-white/10"
        />
      </div>

      {/* TABLE */}
      <div className="bg-[#13263f]/70 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-300">
            <tr>
              <th className="text-left p-4">Employee</th>
              <th className="text-left p-4">Working Days</th>
              <th className="text-left p-4">Leaves</th>
              <th className="text-left p-4">Payable Days</th>
              <th className="text-left p-4">Payable Hours</th>
              <th className="text-left p-4">Base Salary</th>
              <th className="text-left p-4">Final Salary</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-6">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-6">
                  No data found
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-white/5 hover:bg-white/5 transition"
                >
                  <td className="p-4">
                    <p className="font-medium">{p.user.name}</p>
                    <p className="text-xs text-gray-400">{p.user.email}</p>
                  </td>

                  <td className="p-4">
                    {p.workingDays}/{p.totalDays}
                  </td>

                  <td className="p-4 text-yellow-400">{p.leaveDays}</td>
                  <td className="p-4 text-green-400">{p.paidDays} / {p.workingDays}</td>
                  <td className="p-4 text-green-400">{p.paidHours} / {p.totalWorkingHoursForMonth}</td>
                  <td className="p-4">₹{p.baseSalary}</td>
                  <td className="p-4 font-semibold text-blue-400">
                    ₹ {p.salary}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* PAGINATION BAR */}
        <div className="flex items-center justify-end m-6 select-none gap-3">

          {/* Previous Button */}
          <button
            disabled={page === 1}
            onClick={prevPage}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition
                    ${page === 1
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-400 to-teal-400"
              }`}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>

          {/* Page Display */}
          <span className="px-4 py-1 text-sm rounded-lg bg-[#1c2a3f] text-white border border-white/10">
            Page {page}
          </span>

          {/* Next Button */}
          <button
            disabled={!nextCursor}
            onClick={nextPage}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition
                    ${!nextCursor
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-400 to-green-400"
              }`}
          >
            <ChevronRight size={20} className="text-white" />
          </button>

        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div >

  );
}