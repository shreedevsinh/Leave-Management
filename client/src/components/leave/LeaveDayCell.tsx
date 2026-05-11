import { Trash2 } from "lucide-react";
import type { Leave } from "./leave";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type Props = {
    day: number | null;
    formatDate: (day: number) => string;
    getLeaves: (date: string) => Leave[];
    today: Date;
    currentMonth: number;
    currentYear: number;
    selectedDate: string | null;
    setSelectedDate: (date: string) => void;
    holidays: any[];
    onDeleteHoliday: (holidayId: string) => void;
};

export default function LeaveDayCell({
    day,
    formatDate,
    getLeaves,
    today,
    currentMonth,
    currentYear,
    selectedDate,
    setSelectedDate,
    holidays,
    onDeleteHoliday,
}: Props) {
    const dateStr = day ? formatDate(day) : "";

    const dayLeaves = day ? getLeaves(dateStr) : [];

    const isToday =
        day === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear === today.getFullYear();

    const isSelected = selectedDate === dateStr;

    const holiday = holidays.find(
        (holiday) => holiday.date?.split("T")[0] === dateStr
    );

    const isHoliday = !!holiday;

    const currentDate = day
        ? new Date(currentYear, currentMonth, day)
        : null;

    const dayOfWeek = currentDate?.getDay();

    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    // 🔐 Auth
    const token = Cookies.get("access_token");
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    const role = decoded.role;

    return (
        <div
            onClick={() => day && setSelectedDate(dateStr)}
            className={`relative h-28 rounded-xl p-2 border cursor-pointer flex flex-col transition
                ${
                    isSelected
                        ? "bg-gradient-to-br from-purple-600 to-indigo-600 border-transparent"
                        : isHoliday
                        ? "bg-red-500/15 border-red-500/30 hover:bg-red-500/20"
                        : isSunday
                        ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/15"
                        : isSaturday
                        ? "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15"
                        : "bg-[#0f1e35] border-white/5 hover:bg-white/5"
                }
                ${isToday ? "border-green-400" : ""}
            `}
        >
            {day && (
                <>

                    {/* Delete Holiday Button */}
                    {isHoliday && holiday?.id && role === "ADMIN" && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteHoliday(holiday.id);
                            }}
                            className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/40 text-xs transition"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}

                    {/* Day Number */}
                    <div
                        className={`text-xs mb-1 font-medium
                            ${
                                isHoliday
                                    ? "text-red-300"
                                    : isSunday
                                    ? "text-red-400"
                                    : isSaturday
                                    ? "text-blue-400"
                                    : "text-gray-300"
                            }
                        `}
                    >
                        {day}
                    </div>

                    {/* Holiday Badge */}
                    {isHoliday && (
                        <div className="text-[10px] px-2 py-1 rounded-md bg-red-500/20 text-red-300 w-fit mb-1 truncate">
                            {holiday.name || "Holiday"}
                        </div>
                    )}

                    {/* Weekend Badge */}
                    {!isHoliday && isSunday && (
                        <div className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-300 w-fit mb-1">
                            Sunday
                        </div>
                    )}

                    {!isHoliday && isSaturday && (
                        <div className="text-[10px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-300 w-fit mb-1">
                            Saturday
                        </div>
                    )}

                    {/* Leaves */}
                    <div className="flex flex-col gap-1 overflow-hidden">
                        {dayLeaves.slice(0, 3).map((leave, i) => (
                            <div
                                key={i}
                                className={`text-[10px] px-2 py-1 rounded-md truncate font-medium
                                    ${
                                        leave.status === "APPROVED"
                                            ? "bg-green-500/20 text-green-300"
                                            : leave.status === "REJECTED"
                                            ? "bg-red-500/20 text-red-300"
                                            : "bg-yellow-500/20 text-yellow-300"
                                    }
                                `}
                            >
                                {leave.employee}
                            </div>
                        ))}

                        {dayLeaves.length > 3 && (
                            <div className="text-[10px] text-gray-400">
                                +{dayLeaves.length - 3} more
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}