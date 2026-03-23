import type { Leave } from "./LeaveContainer";

type Props = {
    selectedDate: string | null;
    setSelectedDate: (val: string | null) => void;
    getLeaves: (date: string) => Leave[];
};

export default function LeaveModal({ selectedDate, setSelectedDate, getLeaves }: Props) {
    if (!selectedDate) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#13263f] rounded-2xl p-6 w-96 border border-white/10 shadow-xl">
                <h2 className="text-lg font-semibold mb-4">
                    {new Date(selectedDate).toDateString()}
                </h2>

                {getLeaves(selectedDate).length > 0 ? (
                    <div className="space-y-3">
                        {getLeaves(selectedDate).map((leave, i) => (
                            <div key={i} className="p-3 rounded-lg bg-[#0f1e35] border border-white/5">
                                <p className="font-medium">{leave.employee}</p>
                                <p className="text-sm text-gray-400 capitalize">
                                    {leave.type}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400">No records</p>
                )}

                <button
                    onClick={() => setSelectedDate(null)}
                    className="button-gradient mt-6 w-full">
                    Close
                </button>
            </div>
        </div>
    );
}