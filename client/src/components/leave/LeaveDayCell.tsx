import type { Leave } from "./leave";

type Props = {
    day: number | null;
    formatDate: (day: number) => string;
    getLeaves: (date: string) => Leave[];
    today: Date;
    currentMonth: number;
    currentYear: number;
    selectedDate: string | null;
    setSelectedDate: (date: string) => void;
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
}: Props) {
    const dateStr = day ? formatDate(day) : "";
    const dayLeaves = day ? getLeaves(dateStr) : [];
    
    const isToday =
        day === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear === today.getFullYear();

    const isSelected = selectedDate === dateStr;

    return (
        <div
            onClick={() => day && setSelectedDate(dateStr)}
            className={`h-28 rounded-xl p-2 border cursor-pointer flex flex-col transition
                ${isSelected
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 border-transparent"
                    : "bg-[#0f1e35] border-white/5 hover:bg-white/5"}
                ${isToday ? "border-green-400" : ""}
            `}
        >
            {day && (
                <>
                    <div className="text-xs text-gray-300 mb-1">{day}</div>

                    <div className="flex flex-col gap-1 overflow-hidden">
                        {dayLeaves.slice(0, 3).map((leave, i) => (
                            <div
                                key={i}
                                className={`text-[10px] px-2 py-1 rounded-md truncate font-medium
                                ${leave.status === "APPROVED"
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