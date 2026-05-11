import { ChevronLeft, ChevronRight } from 'lucide-react';
// import ChevronRight from "@heroicons/react/24/solid/ChevronRightIcon";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type Props = {
    currentMonth: number;
    currentYear: number;
    onChange: (dir: "prev" | "next") => void;
    onOpenLeaveTypes: () => void;
    onOpenCreateLeave: () => void;
    onOpenCreateHoliday: () => void;
};

export default function LeaveHeader({ currentMonth, currentYear, onChange, onOpenLeaveTypes, onOpenCreateHoliday }: Props) {

    // 🔐 Auth
    const token = Cookies.get("access_token");
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    const role = decoded.role;

    return (
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center justify-between w-fit px-4 py-2 rounded-lg border border-white/10 bg-[#13263f] shadow-sm">

                {/* Date */}
                <div className="flex items-center gap-2">
                    <span className="text-xl">📅</span>
                    <h1 className="text-lg font-semibold text-white-700 w-36">
                        {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long", year: "numeric", })}
                    </h1>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 ml-4">
                    {/* Prev */}
                    <button
                        onClick={() => onChange("prev")}
                        className="w-9 h-9 flex items-center justify-center rounded-full
                            bg-gradient-to-r from-green-400 to-teal-400
                            shadow active:scale-95 transition">
                        <ChevronLeft size={20} className="text-white" />
                    </button>

                    {/* Next */}
                    <button
                        onClick={() => onChange("next")}
                        className="w-9 h-9 flex items-center justify-center rounded-full
                            bg-gradient-to-r from-teal-400 to-green-400
                            shadow active:scale-95 transition">
                        <ChevronRight size={20} className="text-white" />
                    </button>
                </div>
            </div>
            <div className="flex gap-4">
                {role === "ADMIN" && (
                <button
                    onClick={onOpenCreateHoliday}
                    className="button-gradient">
                    <span className="relative z-10">Create Holidays</span>
                    <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition rounded-xl"></span>
                </button>
                )}
                <button
                    onClick={onOpenLeaveTypes}
                    className="button-gradient">
                    <span className="relative z-10">Leave Types</span>
                    <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition rounded-xl"></span>
                </button>
            </div>
        </div>
    );
}