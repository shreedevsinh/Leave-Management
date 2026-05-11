import { useEffect, useState } from "react";
import {
  Calendar, Search, IndianRupee, ChevronLeft,
  ChevronRight, Users, Wallet, Clock
} from "lucide-react";
import Cookies from "js-cookie";
import Toast from "../../components/common/Toast";
import CustomTimePicker from "../../components/common/CustomTimePicker";

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
    id: string;
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

  const [selectedEmployee, setSelectedEmployee] = useState<Payroll | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [details, setDetails] = useState<any>(null);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [openStatus, setOpenStatus] = useState(false);

  const [officeStartTime, setOfficeStartTime] = useState("");
  const [officeEndTime, setOfficeEndTime] = useState("");

  const [activePicker, setActivePicker] = useState<
    "checkin" | "checkout" | null
  >(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const formatLocalTime = (value: string) => {
    if (!value) return "";

    // already formatted like "10:00 PM"
    if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(value)) {
      return value.toUpperCase();
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).toUpperCase();
  };

  const getOfficeTime = async () => {
    try {
      const res = await fetch(`${API_URL}/officetime/active`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      const start = formatLocalTime(json.startTime);
      const end = formatLocalTime(json.endTime);

      setOfficeStartTime(start);
      setOfficeEndTime(end);


      // ✅ Default values
      setSelectedAttendance((prev: any) => ({
        ...prev,
        checkIn: prev?.checkIn || start,
        checkOut: prev?.checkOut || end,
      }));

    } catch (err) {
      console.error("❌ Failed to fetch office timing", err);
    }
  };

  useEffect(() => {
    getOfficeTime();
  }, [attendanceModalOpen]);

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

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchPayrollDetails = async (
    userId: string,
    month: number,
    year: number,
  ) => {
    const res = await fetch(
      `${API_URL}/payroll/details?userId=${userId}&month=${month}&year=${year}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "GET",
      }
    );

    if (!res.ok) {
      throw new Error(`Failed: ${res.status}`);
    }

    const json = await res.json();

    if (!json || !json.days) {
      throw new Error("Invalid response format");
    }

    return json;
  };

  const openDetails = async (employee: Payroll) => {
    setSelectedEmployee(employee);
    setShowModal(true);

    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);

    const controller = new AbortController();

    try {
      const data = await fetchPayrollDetails(
        employee.user.id,
        month,
        year,
      );

      setDetails(data);
    } catch (err: any) {
      if (err.name === "AbortError") return;

      console.error(err);
      setDetailsError("Failed to load employee details");
    } finally {
      setDetailsLoading(false);
    }

    return () => controller.abort();
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "-";

    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-500/20 border-green-400 text-green-300";
      case "half":
        return "bg-yellow-500/20 border-yellow-400 text-yellow-300";
      case "leave":
        return "bg-purple-500/20 border-purple-400 text-purple-300";
      case "missing_checkout":
        return "bg-red-500/20 border-red-400 text-red-300";
      default:
        return "bg-gray-500/20 border-gray-400 text-gray-300";
    }
  };
  const generateCalendar = (days: any[], month: number, year: number) => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month, 0).getDate();

    const calendar: any[] = [];

    // 🔥 Add empty slots before 1st day
    for (let i = 0; i < firstDay; i++) {
      calendar.push(null);
    }

    // 🔥 Add actual days
    for (let i = 2; i <= totalDays + 1; i++) {
      const dateStr = new Date(year, month - 1, i)
        .toISOString()
        .split("T")[0];

      const dayData = days.find((d: any) => d.date === dateStr);

      calendar.push(dayData || { date: dateStr, status: "leave" });
    }

    return calendar;
  };

  const calendarDays = details?.days
    ? generateCalendar(details.days, month, year)
    : [];

  const markAttendance = async () => {
    if (!selectedAttendance || !selectedEmployee) return;

    try {
      const res = await fetch(`${API_URL}/payroll/mark-attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedAttendance.userId,
          date: selectedAttendance.date,
          status: selectedAttendance.status,
          checkIn: selectedAttendance.checkIn,
          checkOut: selectedAttendance.checkOut,
        }),
      });

      if (res.ok) {
        await fetchReports(true);

        // Refresh details modal data
        const data = await fetchPayrollDetails(
          selectedAttendance.userId,
          month,
          year,
        );

        setDetails(data);

        setToast({
          message: data.message || "Attendance marked successfully",
          type: "success",
        });
      } else {
        setToast({
          message: "Something went wrong",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Mark Attendance Error:", error);

      setToast({
        message: "Server error. Please try again.",
        type: "error",
      });
    }
  };

  useEffect(() => {
    if (selectedAttendance) {
      setSelectedAttendance((prev: any) => ({
        ...prev,
        checkIn: prev?.checkIn
          ? formatLocalTime(prev.checkIn)
          : "",
        checkOut: prev?.checkOut
          ? formatLocalTime(prev.checkOut)
          : "",
      }));
    }
  }, [attendanceModalOpen]);

  return (
    <>
      <div className="p-4 md:p-6 space-y-6 text-white">
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Monthly Reports
            </h1>

            <p className="text-sm text-gray-400 mt-1">
              Payroll & attendance overview for employees
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* MONTH */}
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-[#13263f] border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-green-400"
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
              className="w-28 bg-[#13263f] border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-green-400"
            />

            {/* GENERATE PAYROLL */}
            <button
              onClick={generatePayroll}
              className="bg-gradient-to-r from-green-400 to-teal-400 text-[#0f1e33] font-semibold px-5 py-2.5 rounded-xl hover:scale-[1.02] transition"
            >
              Generate Payroll
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#13263f]/80 backdrop-blur-md p-5 rounded-2xl border border-white/10">
            <p className="text-sm text-gray-400">Employees</p>

            <div className="flex items-end justify-between mt-2">
              <h2 className="text-3xl font-bold">{totalEmployees}</h2>

              <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Users size={20} className="text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#13263f]/80 backdrop-blur-md p-5 rounded-2xl border border-white/10">
            <p className="text-sm text-gray-400">Total Payout</p>

            <div className="flex items-end justify-between mt-2">
              <h2 className="text-3xl font-bold flex items-center gap-1">
                <IndianRupee size={22} />
                {totalSalary.toLocaleString()}
              </h2>

              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Wallet size={20} className="text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-[#13263f]/80 backdrop-blur-md p-5 rounded-2xl border border-white/10">
            <p className="text-sm text-gray-400">Selected Month</p>

            <div className="flex items-end justify-between mt-2">
              <h2 className="text-3xl font-bold">
                {month}/{year}
              </h2>

              <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Calendar size={20} className="text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />

          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#13263f] border border-white/10 outline-none focus:border-green-400"
          />
        </div>

        {/* TABLE */}
        <div className="bg-[#13263f]/80 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-300">
                <tr>
                  <th className="text-left p-5">Employee</th>
                  <th className="text-left p-5">Working</th>
                  <th className="text-left p-5">Leaves</th>
                  <th className="text-left p-5">Payable Days</th>
                  <th className="text-left p-5">Hours</th>
                  <th className="text-left p-5">Base Salary</th>
                  <th className="text-left p-5">Final Salary</th>
                  <th className="text-left p-5">Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center p-10 text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-10 text-gray-400">
                      No data found
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-white/5 hover:bg-white/[0.03] transition"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-r from-green-400 to-teal-400 flex items-center justify-center text-[#0f1e33] font-bold">
                            {p.user.name?.charAt(0)}
                          </div>

                          <div>
                            <p className="font-semibold text-white">
                              {p.user.name}
                            </p>

                            <p className="text-xs text-gray-400 mt-0.5">
                              {p.user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {p.workingDays}
                          </span>

                          <span className="text-xs text-gray-400">
                            / {p.totalDays} days
                          </span>
                        </div>
                      </td>

                      <td className="p-5">
                        <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 text-xs font-medium">
                          {p.leaveDays} Days
                        </span>
                      </td>

                      <td className="p-5">
                        <span className="text-green-400 font-semibold">
                          {p.paidDays}
                        </span>

                        <span className="text-gray-400 text-xs">
                          {" "}
                          / {p.workingDays}
                        </span>
                      </td>

                      <td className="p-5">
                        <span className="text-cyan-300 font-semibold">
                          {p.paidHours}
                        </span>

                        <span className="text-gray-400 text-xs">
                          {" "}
                          / {p.totalWorkingHoursForMonth}
                        </span>
                      </td>

                      <td className="p-5 font-medium">
                        ₹{p.baseSalary}
                      </td>

                      <td className="p-5">
                        <div className="inline-flex px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-300 font-semibold">
                          ₹ {p.salary}
                        </div>
                      </td>

                      <td className="p-5">
                        <button
                          onClick={() => openDetails(p)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-400 to-cyan-400 text-[#0f1e33] font-semibold hover:scale-[1.03] transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-end px-6 py-5 border-t border-white/5 gap-3">
            <button
              disabled={page === 1}
              onClick={prevPage}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition
              ${page === 1
                  ? "bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-400 to-teal-400 hover:scale-105"
                }`}
            >
              <ChevronLeft size={18} className="text-white" />
            </button>

            <div className="px-4 py-2 rounded-xl bg-[#1c2a3f] border border-white/10 text-sm">
              Page {page}
            </div>

            <button
              disabled={!nextCursor}
              onClick={nextPage}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition
              ${!nextCursor
                  ? "bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-400 to-green-400 hover:scale-105"
                }`}
            >
              <ChevronRight size={18} className="text-white" />
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
      </div>

      {/* DETAILS MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#0b1220] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedEmployee?.user.name}
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Attendance Calendar • {month}/{year}
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/70 transition hover:bg-red-500/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-5">
              {detailsLoading ? (
                <p className="py-10 text-center text-gray-400">
                  Loading details...
                </p>
              ) : detailsError ? (
                <p className="py-10 text-center text-red-400">
                  {detailsError}
                </p>
              ) : (
                <>
                  {/* SUMMARY */}
                  <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                      <p className="text-xs text-gray-400">Present</p>

                      <h3 className="mt-2 text-2xl font-bold text-green-400">
                        {details.presentDays}
                      </h3>
                    </div>

                    <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                      <p className="text-xs text-gray-400">Half Days</p>

                      <h3 className="mt-2 text-2xl font-bold text-yellow-400">
                        {details.halfDays}
                      </h3>
                    </div>

                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                      <p className="text-xs text-gray-400">
                        Missing Checkout
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-red-400">
                        {details.missingCheckout}
                      </h3>
                    </div>

                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
                      <p className="text-xs text-gray-400">Leaves</p>

                      <h3 className="mt-2 text-2xl font-bold text-purple-400">
                        {details.leaves}
                      </h3>
                    </div>
                  </div>

                  {/* WEEKDAYS */}
                  <div className="mb-2 grid grid-cols-7 gap-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <div
                          key={d}
                          className="text-center text-xs font-medium text-gray-500"
                        >
                          {d}
                        </div>
                      )
                    )}
                  </div>

                  {/* CALENDAR */}
                  <div className="grid grid-cols-7 gap-2 max-h-[520px] overflow-y-auto pr-1">
                    {calendarDays.map((d: any, index: number) => {
                      if (!d) {
                        return (
                          <div
                            key={index}
                            className="aspect-square rounded-2xl border border-white/5 bg-[#101827]/40"
                          />
                        );
                      }

                      const dateObj = new Date(d.date);
                      const dayNum = dateObj.getDate();

                      return (
                        <div
                          key={d.date}
                          className={`h-[130px] rounded-2xl border p-2 flex flex-col overflow-hidden
                          transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
                          ${getStatusColor(d.status)}`}
                        >
                          {/* TOP */}
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white leading-none">
                                {dayNum}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedAttendance(d);
                                setAttendanceModalOpen(true);
                              }}
                              className="shrink-0 rounded-md bg-blue-500/15 px-2 py-1 text-[9px] font-medium text-blue-300 transition hover:bg-blue-500/25"
                            >
                              Mark
                            </button>
                          </div>

                          {/* STATUS */}
                          <div className="mt-2">
                            {d.status === "present" && (
                              <div className="rounded-md bg-green-500/20 px-2 py-1 text-[9px] font-medium text-green-300 text-center truncate">
                                Present
                              </div>
                            )}

                            {d.status === "half" && (
                              <div className="rounded-md bg-yellow-500/20 px-2 py-1 text-[9px] font-medium text-yellow-300 text-center truncate">
                                Half Day
                              </div>
                            )}

                            {d.status === "leave" && (
                              <div className="rounded-md bg-purple-500/20 px-2 py-1 text-[9px] font-medium text-purple-300 text-center truncate">
                                Leave
                              </div>
                            )}

                            {d.status === "missing_checkout" && (
                              <div className="rounded-md bg-red-500/20 px-2 py-1 text-[9px] font-medium text-red-300 text-center truncate">
                                Missing
                              </div>
                            )}
                          </div>

                          {/* TIME */}
                          <div className="mt-auto border-t border-white/5 pt-2 text-[9px] text-gray-400 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="opacity-70">In</span>

                              <span className="truncate text-right">
                                {formatTime(d.checkIn) || "-"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="opacity-70">Out</span>

                              <span className="truncate text-right">
                                {formatTime(d.checkOut) || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE MODAL */}
      {attendanceModalOpen && selectedAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#13263f] border border-white/10  shadow-2xl">
            {/* HEADER */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Mark Attendance
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  Update attendance details
                </p>
              </div>

              <button
                onClick={() => {
                  setAttendanceModalOpen(false);
                  setSelectedAttendance(null);
                }}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/80 transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-5">
              {/* DATE */}
              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Date
                </label>

                <input
                  type="text"
                  value={selectedAttendance.date}
                  disabled
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white"
                />
              </div>

              {/* STATUS */}
              <div className="relative">
                <label className="text-sm text-white/60 block mb-2">
                  Status
                </label>

                {/* SELECT BOX */}
                <div
                  onClick={() => setOpenStatus(!openStatus)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer flex items-center justify-between hover:border-green-400 transition"
                >
                  <span className="text-white">
                    {selectedAttendance.status === "present" && "Present"}
                    {selectedAttendance.status === "half" && "Half Day"}
                    {selectedAttendance.status === "leave" && "Leave"}
                    {selectedAttendance.status === "missing_checkout" &&
                      "Missing Checkout"}
                    {selectedAttendance.status === "absent" && "Absent"}
                  </span>

                  <span
                    className={`text-gray-400 transition ${openStatus ? "rotate-180" : ""
                      }`}
                  >
                    ▼
                  </span>
                </div>

                {/* DROPDOWN */}
                {openStatus && (
                  <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#13263f] shadow-2xl">
                    {[
                      {
                        value: "present",
                        label: "Present",
                        color: "text-green-400",
                      },
                      {
                        value: "half",
                        label: "Half Day",
                        color: "text-yellow-400",
                      },
                      {
                        value: "leave",
                        label: "Leave",
                        color: "text-purple-400",
                      },
                      {
                        value: "missing_checkout",
                        label: "Missing Checkout",
                        color: "text-red-400",
                      },
                      {
                        value: "absent",
                        label: "Absent",
                        color: "text-gray-300",
                      },
                    ].map((status) => (
                      <div
                        key={status.value}
                        onClick={() => {
                          setSelectedAttendance((prev: any) => ({
                            ...prev,
                            status: status.value,
                          }));

                          setOpenStatus(false);
                        }}
                        className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-white/5"
                      >
                        <span className={`font-medium ${status.color}`}>
                          {status.label}
                        </span>

                        {selectedAttendance.status === status.value && (
                          <span className="text-green-400">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIME GRID */}
              <div className="grid grid-cols-2 gap-4">
                {/* CHECK IN */}
                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    Check In
                  </label>

                  <div className="relative">
                    <CustomTimePicker
                      value={
                        selectedAttendance?.checkIn?.trim()
                          ? selectedAttendance.checkIn
                          : officeStartTime
                      }
                      isOpen={activePicker === "checkin"}
                      onOpen={() => setActivePicker("checkin")}
                      onClose={() => setActivePicker(null)}
                      onChange={(val) =>
                        setSelectedAttendance((prev: any) => ({
                          ...prev,
                          checkIn: val,
                        }))
                      }
                    />

                    <Clock
                      className="absolute left-3 top-3 text-gray-400 pointer-events-none"
                      size={18}
                    />
                  </div>
                </div>

                {/* CHECK OUT */}
                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    Check Out
                  </label>

                  <div className="relative">
                    <CustomTimePicker
                      value={
                        selectedAttendance?.checkOut?.trim()
                          ? selectedAttendance.checkOut
                          : officeEndTime
                      }
                      isOpen={activePicker === "checkout"}
                      onOpen={() => setActivePicker("checkout")}
                      onClose={() => setActivePicker(null)}
                      onChange={(val) =>
                        setSelectedAttendance((prev: any) => ({
                          ...prev,
                          checkOut: val,
                        }))
                      }
                    />

                    <Clock
                      className="absolute left-3 top-3 text-gray-400 pointer-events-none"
                      size={18}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-5 border-t border-white/10 flex gap-3 items-center justify-end">
              <button
                onClick={() => {
                  setAttendanceModalOpen(false);
                  setSelectedAttendance(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/80 transition text-white"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setAttendanceModalOpen(false);
                  setSelectedAttendance(null);
                  markAttendance();
                }}
                className="button-gradient"
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}