import { useEffect, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Search,
  Users,
  CalendarDays,
  CheckCircle,
  XCircle,
} from "lucide-react";
import DatePicker from "react-datepicker";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import Toast from "../../components/common/Toast";
import CreateLeaveModal from "../../components/leave/CreateLeaveModal";
import { set } from "date-fns";

export default function AdminDashboard() {
  const [open, setOpen] = useState(false);

  const [requests, setRequests] = useState<any[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("startDate");
  const [sortOrder, setSortOrder] = useState("desc");

  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [approvedLeaves, setApprovedLeaves] = useState(0);
  const [rejectedLeaves, setRejectedLeaves] = useState(0);

  const [totalLeaves, setTotalLeaves] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("ALL");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("ALL");

  const [startDateFilter, setStartDateFilter] = useState<Date | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<Date | null>(null);

  const [openEmployee, setOpenEmployee] = useState(false);

  // 🔥 Pagination states
  const [lastKey, setLastKey] = useState<any>(null);
  const [currentKey, setCurrentKey] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const token = Cookies.get("access_token");
  if (!token) return null;

  const decoded: any = jwtDecode(token);
  const userId = decoded.sub;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  // 🔥 Build Query
  const buildQuery = (key: any = null) => {
    let params = new URLSearchParams();

    params.append("limit", String(itemsPerPage));

    if (key) params.append("lastKey", JSON.stringify(key));
    if (filter !== "ALL") params.append("status", filter);
    if (search) params.append("search", search);
    if (selectedEmployeeId !== "ALL") params.append("employeeId", selectedEmployeeId);

    console.log(selectedEmployeeId);

    if (startDateFilter)
      params.append("startDate", startDateFilter.toISOString());
    if (endDateFilter) params.append("endDate", endDateFilter.toISOString());

    params.append("sortKey", sortKey);
    params.append("sortOrder", sortOrder);

    console.log(params.toString());
    return params.toString();
  };

  // 🔥 Fetch Leaves
  const fetchLeaves = async (key = null) => {
    try {
      const query = buildQuery(key);

      const res = await fetch(`http://localhost:3000/leaves?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      setTotalLeaves(data.totalCount);

      const formatted = data.items.map((leave: any) => ({
        id: leave.id,
        name: leave.user?.name || "Unknown",
        type: leave.type?.name || "Unknown",
        isPaid: leave.type?.isPaid ?? false,
        days: leave.totalDays,
        status:
          leave.status?.charAt(0).toUpperCase() +
          leave.status?.slice(1).toLowerCase(),
        startDate: formatDate(leave.startDate),
        endDate: formatDate(leave.endDate),
        rawStart: new Date(leave.startDate),
      }));

      setPendingLeaves(data.pending);
      setApprovedLeaves(data.approved);
      setRejectedLeaves(data.rejected);

      setRequests(formatted);
      setCurrentKey(key);
      setLastKey(data.lastKey || null);
    } catch (err) {
      console.error(err);
    }
  };

  // 🔥 Pagination
  const handleNext = () => {
    if (!lastKey) return;

    setHistory((prev) => [...prev, currentKey]);
    fetchLeaves(lastKey);
    setCurrentPage((p) => p + 1);
  };

  const handlePrev = () => {
    if (history.length === 0) return;

    const prevHistory = [...history];
    const prevKey = prevHistory.pop();

    setHistory(prevHistory);

    fetchLeaves(prevKey ?? null);
    setCurrentPage((p) => Math.max(p - 1, 1));
  };

  // 🔥 Fetch Employees
  const fetchEmployees = async () => {
    try {
      const res = await fetch("http://localhost:3000/users/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      setTotalEmployees(data.length);
      setEmployees(
        data.map((emp: any) => ({
          id: emp.id,
          name: emp.name,
        })),
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 🔥 Initial Load
  useEffect(() => {
    fetchLeaves(null);
    fetchEmployees();
  }, []);

  // 🔥 Reset on Filters
  useEffect(() => {
    setCurrentPage(1);
    setLastKey(null);
    setCurrentKey(null);
    setHistory([]);

    fetchLeaves(null);
  }, [
    filter,
    search,
    selectedEmployeeId,
    startDateFilter,
    endDateFilter,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    const closeDropdown = () => setOpenId(null);
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  const toggleDropdown = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    leaveId: number | null;
  }>({ open: false, leaveId: null });

  const [rejectionReason, setRejectionReason] = useState("");

  const handleStatusChange = async (
    id: number,
    newStatus: string,
    reason: string = "",
  ) => {
    await fetch(
      `http://localhost:3000/leaves/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus.toUpperCase(),
          approvedBy: userId,
          rejectionReason: reason,
        }),
      },
    );

    setRequests((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item,
      ),
    );

    setToast({
      message: `Leave ${newStatus.toLowerCase()} successfully`,
      type: "success",
    });

    setRejectModal({ open: false, leaveId: null });

    setOpenId(null);
  };

  // 🔥 Stats
  const stats = useMemo(() => {
    return [
      {
        label: "Total Employees",
        value: selectedEmployeeId === "ALL" ? totalEmployees : 1,
        icon: Users,
        key: "ALL",
      },
      {
        label: "Pending Requests",
        value: pendingLeaves,
        icon: CalendarDays,
        key: "Pending",
      },
      {
        label: "Approved Leaves",
          value: approvedLeaves,
        icon: CheckCircle,
        key: "Approved",
      },
      {
        label: "Rejected",
        value: rejectedLeaves,
        icon: XCircle,
        key: "Rejected",
      },
    ];
  }, [requests, selectedEmployeeId, totalEmployees]);

  const handleCreateLeave = async (data: any) => {
    try {
      const res = await fetch("http://localhost:3000/leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data }),
      });

      console.log(res);

      const result = await res.json();

      // ❌ Handle API errors
      if (!res.ok) {
        console.log(result);
        setToast({
          message: result.message.message,
          type: "error",
        });
      } else {
        setToast({
          message: "Leave applied successfully",
          type: "success",
        });
      }

      await fetchLeaves();
      setOpen(false);

    } catch (err: any) {
      setToast({
        message: err.message.message,
        type: "error",
      });
    }
  };

  return (
    <>
      <div className="space-y-6 p-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              Dashboard Overview
            </h1>
            <p className="text-gray-400 text-sm">
              Monitor employee leave activity and requests
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-green-400 to-teal-400 text-[#0f1e33] font-semibold px-5 py-2.5 rounded-xl"
          >
            + Create Leave
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                onClick={() =>
                  setFilter((prev) =>
                    prev === item.key ? "ALL" : item.key
                  )
                }
                className={`bg-[#13263f]/80 p-4 rounded-2xl border border-white/10 cursor-pointer transition
              ${filter === item.key
                    ? "ring-2 ring-green-400"
                    : "hover:bg-[#1b3654]"
                  }`}
              >
                <div className="flex justify-between mb-2">
                  <p className="text-gray-400 text-sm">{item.label}</p>
                  <Icon size={18} className="text-green-400" />
                </div>
                <h3 className="text-white font-bold text-xl">
                  {item.value}
                </h3>
              </div>
            );
          })}
        </div>

        <div className="bg-[#13263f]/80 p-5 rounded-2xl border border-white/10">

          {/* Header */}
          <div className="flex flex-col gap-4 mb-5">

            {/* Top Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

              {/* Left */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-green-400/10 border border-green-400/20">
                  <CalendarDays size={30} className="text-green-400" />
                </div>

                <div>
                  <h2 className="text-white font-semibold text-lg tracking-wide">
                    Recent Leave Requests
                  </h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Manage and review employee leave activity
                  </p>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400 bg-[#0f1e33]/60 px-3 py-1.5 rounded-lg border border-white/10">
                  {totalLeaves} records
                </div>
              </div>
            </div>

            {/* Filters + Search (Single Unified Bar) */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-[#0f1e33]/70 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
              {/* LEFT: Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Employee Dropdown */}
                <div className="relative min-w-[180px]">
                  <User
                    className="absolute left-3 top-3 text-gray-400"
                    size={16}
                  />

                  <div
                    onClick={() => setOpenEmployee((prev) => !prev)}
                    className="pl-9 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-sm text-white cursor-pointer flex justify-between items-center hover:border-green-400 transition"
                  >
                    <span>
                      {selectedEmployeeName === "ALL"
                        ? "All Employees"
                        : selectedEmployeeName}
                    </span>
                    <span className="text-gray-400 text-xs">▼</span>
                  </div>

                  {openEmployee && (
                    <div className="absolute w-full mt-2 bg-[#132033] border border-[#2e3b55] rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                      <div
                        onClick={() => {
                          setSelectedEmployeeId("ALL");
                          setSelectedEmployeeName("ALL");
                          setOpenEmployee(false);
                        }}
                        className="px-4 py-2 hover:bg-[#1c2a3f] cursor-pointer text-gray-300"
                      >
                        All Employees
                      </div>

                      {employees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setSelectedEmployeeName(emp.name);
                            fetchLeaves();
                            setOpenEmployee(false);
                          }}
                          className="px-4 py-2 hover:bg-[#1c2a3f] cursor-pointer text-white"
                        >
                          {emp.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Start Date */}
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-3 text-gray-400"
                    size={16}
                  />
                  <DatePicker
                    selected={startDateFilter}
                    onChange={(date) => setStartDateFilter(date)}
                    placeholderText="Start Date"
                    className="pl-9 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-sm text-white outline-none w-[150px] focus:border-green-400 transition"
                  />
                </div>

                {/* End Date */}
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-3 text-gray-400"
                    size={16}
                  />
                  <DatePicker
                    selected={endDateFilter}
                    onChange={(date) => setEndDateFilter(date)}
                    placeholderText="End Date"
                    className="pl-9 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-sm text-white outline-none w-[150px] focus:border-green-400 transition"
                  />
                </div>

                {/* Divider */}
                <div className="hidden md:block h-6 w-px bg-white/10 mx-1" />

                {/* Reset */}
                <button
                  onClick={() => {
                    setSelectedEmployeeId("ALL");
                    setSelectedEmployeeName("ALL");
                    setStartDateFilter(null);
                    setEndDateFilter(null);
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition"
                >
                  Reset
                </button>
              </div>

              {/* RIGHT: Search */}
              <div className="relative w-full sm:w-72">
                <Search
                  className="absolute left-3 top-3 text-gray-400"
                  size={16}
                />

                <input
                  type="text"
                  placeholder="Search employee or type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-sm text-white outline-none focus:border-green-400 transition"
                />
              </div>
            </div>
          </div>

          {/* Table Wrapper */}
          <div className="overflow-x-auto">
            <div className="min-h-[500px] overflow-y-auto rounded-xl">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="py-3 text-left">Employee</th>
                    <th className="text-left">Type</th>
                    <th
                      className="text-left cursor-pointer"
                      onClick={() => toggleSort("days")}
                    >
                      Days
                    </th>
                    <th className="text-left">Status</th>
                    <th
                      className="text-left cursor-pointer"
                      onClick={() => toggleSort("startDate")}
                    >
                      Start
                    </th>
                    <th className="text-left">End</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-10 text-gray-400"
                      >
                        No leave requests found
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="text-white py-3">{r.name}</td>
                        <td className="text-gray-300">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1 py-1 rounded-md text-xs ${r.isPaid
                                ? "bg-green-500/80 text-green-400"
                                : "bg-red-500/80 text-red-400"
                                }`}
                            />
                            {r.type}
                          </div>
                        </td>
                        <td className="text-gray-300">{r.days}</td>

                        <td className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDropdown(r.id);
                            }}
                            className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 font-medium min-w-[110px] justify-between
                  ${r.status === "Approved"
                                ? "text-green-400 bg-green-400/20"
                                : r.status === "Rejected"
                                  ? "text-red-400 bg-red-400/20"
                                  : "text-yellow-400 bg-yellow-400/20"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full
                      ${r.status === "Approved"
                                    ? "bg-green-400"
                                    : r.status === "Rejected"
                                      ? "bg-red-400"
                                      : "bg-yellow-400"
                                  }`}
                              />
                              {r.status}
                            </div>
                            <span className="text-[10px]">▼</span>
                          </button>

                          {openId === r.id && (
                            <div className="absolute left-0 mt-2 w-40 bg-[#1f2937] border border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
                              {["Pending", "Approved", "Rejected"].map(
                                (status) => (
                                  <div
                                    key={status}
                                    onClick={() => {
                                      if (status === "Rejected") {
                                        setRejectModal({
                                          open: true,
                                          leaveId: r.id,
                                        });
                                        setOpenId(null);
                                      } else {
                                        handleStatusChange(r.id, status);
                                      }
                                    }}
                                    className="px-4 py-2 text-sm cursor-pointer hover:bg-white/10"
                                  >
                                    {status}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </td>

                        <td className="text-gray-300">{r.startDate}</td>
                        <td className="text-gray-300">{r.endDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            {/* ✅ Fixed Showing Text */}
            <p className="text-xs text-gray-400">
              Showing {requests.length} records (Page {currentPage})
            </p>

            {/* Pagination */}
            <div className="flex items-center gap-3">
              {/* Prev */}
              <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition
                  ${currentPage === 1
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-400 to-teal-400"
                  }`}
              >
                <ChevronLeft size={20} className="text-white" />
              </button>

              {/* Page */}
              <span className="px-4 py-1 text-sm rounded-lg bg-[#1c2a3f] text-white border border-white/10">
                Page {currentPage}
              </span>

              {/* Next */}
              <button
                onClick={handleNext}
                disabled={!lastKey}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition
                  ${!lastKey
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-teal-400 to-green-400"
                  }`}
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
        {rejectModal.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#13263f] w-[380px] rounded-2xl border border-white/10 shadow-xl p-6">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-white text-lg font-semibold">
                  Reject Leave Request
                </h3>
                <p className="text-gray-400 text-xs mt-1">
                  Please provide a reason for rejecting this leave request.
                </p>
              </div>

              {/* Input */}
              <div className="mb-4">
                <textarea
                  placeholder="Type your reason here..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-24 bg-[#1f2937] text-white p-3 rounded-xl border border-white/10 outline-none text-sm resize-none focus:ring-1 focus:ring-red-400"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRejectModal({ open: false, leaveId: null });
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (!rejectionReason.trim()) return;

                    handleStatusChange(
                      rejectModal.leaveId!,
                      "Rejected",
                      rejectionReason,
                    );

                    setRejectModal({ open: false, leaveId: null });
                    setRejectionReason("");
                  }}
                  className={`px-4 py-2 text-sm rounded-lg text-white transition
          ${rejectionReason.trim()
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-red-500/50 cursor-not-allowed"
                    }`}
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
      <CreateLeaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={handleCreateLeave}
      />
    </>
  );
}
