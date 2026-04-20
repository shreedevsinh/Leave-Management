import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import LeaveHeader from "./LeaveHeader";
import LeaveCalendar from "./LeaveCalendar";
import LeaveModal from "./LeaveModal";
import LeaveTypesModal from "./LeaveTypesModal";
import CreateLeaveTypeModal from "./CreateLeaveTypeModal";
import ConfirmModal from "../common/ConfirmModal";
import type { LeaveType } from "./types";

/* ✅ Correct Leave type */
type Leave = {
    date: string;
    employee: string;
    type: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    startDate: string;
    endDate: string;
};

export default function LeaveContainer() {
    const API_URL = import.meta.env.VITE_API_URL;

    const today = new Date();

    const token = Cookies.get("access_token");
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    const userId = decoded.sub;
    const role = decoded.role;

    const [openLeaveTypes, setOpenLeaveTypes] = useState(false);
    const [openCreateLeaveType, setOpenCreateLeaveType] = useState(false);
    const [openCreateLeave, setOpenCreateLeave] = useState(false);
    console.log("openCreateLeave ==> ", openCreateLeave);

    const [deleteId, setDeleteId] = useState<number | null>(null);

    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    /* ✅ FIXED TYPE */
    const [leaves, setLeaves] = useState<Leave[]>([]);

    /* ✅ Fetch + expand multi-day leaves */
    const fetchLeaves = async () => {
        try {
            const res = await fetch(`${API_URL}/leaves/monthly?month=${currentMonth + 1}&year=${currentYear}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                throw new Error("Failed to fetch leaves");
            }

            if (!res.ok) throw new Error("Failed to fetch leaves");

            const response = await res.json();

            // ✅ Filter only logged-in user's data
            const data =
                role === "ADMIN"
                    ? response
                    : response.filter((item: any) => item.userId === userId);

            const expanded: Leave[] = [];

            data.forEach((item: any) => {
                const start = new Date(item.startDate);
                const end = new Date(item.endDate);

                let current = new Date(start);

                while (current <= end) {
                    const localDate = current.toLocaleDateString("en-CA");

                    expanded.push({
                        date: localDate,
                        employee: item.user?.name || `User ${item.userId}`,
                        type: item.type?.name || "Leave",
                        status: item.status as "PENDING" | "APPROVED" | "REJECTED",
                        startDate: item.startDate,
                        endDate: item.endDate,
                    });

                    current.setDate(current.getDate() + 1);
                }
            });

            setLeaves(expanded);

        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchLeaves();
    }, [currentMonth, currentYear]);

    /* Calendar helpers */
    const getDaysInMonth = (year: number, month: number) =>
        new Date(year, month + 1, 0).getDate();

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();

    const formatDate = (day: number) =>
        `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    /* ✅ FIXED getLeaves */
    const getLeaves = (date: string) => {
        return leaves.filter((leave) => leave.date === date);
    };

    /* Leave Types API */
    const fetchLeaveTypes = async () => {
        try {
            const res = await fetch(`${API_URL}/leave-types/`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status} - Failed to fetch`);
            }

            const data: LeaveType[] = await res.json();
            setLeaveTypes(data);
        } catch (err: any) {
            console.error(err.message);
        }
    };

    useEffect(() => {
        fetchLeaveTypes();
    }, []);

    const handleAddLeaveType = (newType: LeaveType) => {
        setLeaveTypes((prev) => [...prev, newType]);
    };

    const handleDeleteClick = (id: number) => {
        setDeleteId(id);
    };

    const handleLeaveTypeDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch(
                `${API_URL}/leave-types/${deleteId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                throw new Error("Failed to delete leave type");
            }

            setLeaveTypes((prev) =>
                prev.filter((lt) => lt.id !== deleteId)
            );
        } catch (error: any) {
            alert(error.message);
        } finally {
            setDeleteId(null);
        }
    };

    /* Calendar grid */
    const daysArray: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
        daysArray.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        daysArray.push(i);
    }

    return (
        <div className="min-h-screen text-white p-3">
            <LeaveHeader
                currentMonth={currentMonth}
                currentYear={currentYear}
                onChange={(dir) => {
                    if (dir === "prev") {
                        if (currentMonth === 0) {
                            setCurrentMonth(11);
                            setCurrentYear((y) => y - 1);
                        } else {
                            setCurrentMonth((m) => m - 1);
                        }
                    } else {
                        if (currentMonth === 11) {
                            setCurrentMonth(0);
                            setCurrentYear((y) => y + 1);
                        } else {
                            setCurrentMonth((m) => m + 1);
                        }
                    }
                }}
                onOpenLeaveTypes={() => setOpenLeaveTypes(true)}
                onOpenCreateLeave={() => setOpenCreateLeave(true)}
            />

            <LeaveCalendar
                daysArray={daysArray}
                formatDate={formatDate}
                getLeaves={getLeaves}
                today={today}
                currentMonth={currentMonth}
                currentYear={currentYear}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
            />

            <LeaveModal
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                getLeaves={getLeaves}
            />

            <LeaveTypesModal
                isOpen={openLeaveTypes}
                onClose={() => setOpenLeaveTypes(false)}
                leaveTypes={leaveTypes}
                onOpenCreate={() => setOpenCreateLeaveType(true)}
                onDelete={handleDeleteClick}
            />

            <CreateLeaveTypeModal
                isOpen={openCreateLeaveType}
                onClose={() => setOpenCreateLeaveType(false)}
                onCreate={handleAddLeaveType}
            />

            <ConfirmModal
                isOpen={deleteId !== null}
                title="Delete Leave Type"
                message="Are you sure you want to delete this leave type?"
                onConfirm={handleLeaveTypeDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}