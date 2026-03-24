import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { CalendarDays, CheckCircle, XCircle, Clock } from "lucide-react";
import CreateLeaveModal from "../../components/leave/CreateLeaveModal";
import Toast from "../../components/common/Toast";

export default function EmployeeDashboard() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("startDate");
  const [sortOrder, setSortOrder] = useState("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const fetchLeaves = async () => {
    try {
      const res = await fetch("http://localhost:3000/leaves", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      const formatted = data
        .filter((leave: any) => leave.userId === userId)
        .map((leave: any) => ({
          id: leave.id,
          type: leave.type?.name || "Unknown",
          days: leave.totalDays,
          status:
            leave.status.charAt(0).toUpperCase() +
            leave.status.slice(1).toLowerCase(),
          startDate: formatDate(leave.startDate),
          endDate: formatDate(leave.endDate),
          rawStart: new Date(leave.startDate),
        }));

      setRequests(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleCreateLeave = async (data: any) => {
    try {
      const res = await fetch("http://localhost:3000/leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, userId }),
      });

      const result = await res.json();

      // ❌ Handle API errors
      if (!res.ok) {
        setToast({
          message: result.message.message,
          type: "error",
        });
      }else{
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

  const stats = [
    {
      label: "My Leaves",
      value: requests.reduce((sum, r) => sum + r.days, 0),
      icon: CalendarDays,
      key: "ALL",
    },
    {
      label: "Pending Requests",
      value: requests
        .filter((r) => r.status === "Pending")
        .reduce((sum, r) => sum + r.days, 0),
      icon: Clock,
      key: "Pending",
    },
    {
      label: "Approved",
      value: requests
        .filter((r) => r.status === "Approved")
        .reduce((sum, r) => sum + r.days, 0),
      icon: CheckCircle,
      key: "Approved",
    },
    {
      label: "Rejected",
      value: requests
        .filter((r) => r.status === "Rejected")
        .reduce((sum, r) => sum + r.days, 0),
      icon: XCircle,
      key: "Rejected",
    },
  ];

  const filteredRequests = useMemo(() => {
    let data = [...requests];

    if (filter !== "ALL") {
      data = data.filter((r) => r.status === filter);
    }

    if (search) {
      data = data.filter((r) =>
        r.type.toLowerCase().includes(search.toLowerCase())
      );
    }

    data.sort((a, b) => {
      if (sortKey === "days") {
        return sortOrder === "asc" ? a.days - b.days : b.days - a.days;
      }
      return sortOrder === "asc"
        ? a.rawStart - b.rawStart
        : b.rawStart - a.rawStart;
    });

    return data;
  }, [requests, filter, search, sortKey, sortOrder]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const paginatedData = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <>
      <div className="space-y-6 p-3">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              My Dashboard
            </h1>
            <p className="text-gray-400 text-sm">
              Track your leave activity and requests
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

        {/* Table */}
        <div className="bg-[#13263f]/80 p-5 rounded-2xl border border-white/10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-white font-semibold">
              My Leave Requests
            </h2>

            <input
              type="text"
              placeholder="Search by type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#1f2937] text-sm px-3 py-2 rounded-lg border border-white/10 outline-none text-white w-full sm:w-64"
            />
          </div>

          {/* Table with fixed height */}
          <div className="overflow-x-auto">
            <div className="min-h-[500px] overflow-y-auto rounded-xl">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="py-3 text-left">Type</th>
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
                      Start Date
                    </th>
                    <th className="text-left">End Date</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedData.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="text-white py-3">{r.type}</td>
                      <td className="text-gray-300">{r.days}</td>

                      <td>
                        <span
                          className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 w-fit
                          ${r.status === "Approved"
                              ? "text-green-400 bg-green-400/20"
                              : r.status === "Rejected"
                                ? "text-red-400 bg-red-400/20"
                                : "text-yellow-400 bg-yellow-400/20"
                            }`}
                        >
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
                        </span>
                      </td>

                      <td className="text-gray-300">{r.startDate}</td>
                      <td className="text-gray-300">{r.endDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <p className="text-xs text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of{" "}
              {filteredRequests.length}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-teal-400"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm
                    ${currentPage === page
                      ? "button-gradient text-white"
                      : "text-gray-400 hover:bg-white/10"
                    }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-green-400"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <CreateLeaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={handleCreateLeave}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}