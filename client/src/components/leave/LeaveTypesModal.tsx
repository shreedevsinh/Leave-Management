import type { LeaveType } from "./types";
import { Trash2 } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    leaveTypes: LeaveType[];
    onOpenCreate: () => void;
    onDelete: (id: number) => void; // ✅ added
};

export default function LeaveTypesModal({
    isOpen,
    onClose,
    leaveTypes,
    onOpenCreate,
    onDelete,
}: Props) {
    if (!isOpen) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-[#13263f] text-white w-[500px] max-h-[80vh] rounded-2xl shadow-xl p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Leave Types</h2>

                    <button
                        onClick={onOpenCreate}
                        className="button-gradient"
                    >
                        + Add
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {leaveTypes.length === 0 ? (
                        <p className="text-white/60 text-sm">
                            No leave types found.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {leaveTypes.map((lt) => (
                                <div
                                    key={lt.id}
                                    className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                >
                                    <div className="flex justify-between items-start">
                                        {/* Left */}
                                        <div>
                                            <h3 className="font-medium">
                                                {lt.name}
                                            </h3>

                                            <p className="text-sm text-white/60 mt-1">
                                                Max per year: {lt.maxPerYear}
                                            </p>
                                        </div>

                                        {/* Right */}
                                        <div className="flex flex-col items-end gap-2">
                                            {/* Status Badge */}
                                            <span
                                                className={`text-xs px-2 py-1 rounded-md ${
                                                    lt.isPaid
                                                        ? "bg-green-400/20 text-green-300"
                                                        : "bg-red-400/20 text-red-300"
                                                }`}
                                            >
                                                {lt.isPaid ? "Paid" : "Unpaid"}
                                            </span>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => onDelete(lt.id)}
                                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 transition opacity-70 hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="button-gradient mt-6 w-full"
                >
                    Close
                </button>
            </div>
        </div>
    );
}