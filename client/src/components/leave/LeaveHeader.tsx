import { ChevronLeft, ChevronRight } from 'lucide-react';
// import ChevronRight from "@heroicons/react/24/solid/ChevronRightIcon";

type Props = {
    currentMonth: number;
    currentYear: number;
    onChange: (dir: "prev" | "next") => void;
    onOpenLeaveTypes: () => void;
    onOpenCreateLeave: () => void;
};

export default function LeaveHeader({ currentMonth, currentYear, onChange, onOpenLeaveTypes, onOpenCreateLeave }: Props) {


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

function Legend({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-3 h-3 ${color} rounded-full`}></span>
            {label}
        </div>
    );
}