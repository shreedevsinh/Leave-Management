import { useState } from "react";

export default function CustomTimePicker({
    value,
    onChange,
    isOpen,
    onOpen,
    onClose,
}: {
    value: string;
    onChange: (val: string) => void;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const hours = Array.from({ length: 12 }, (_, i) =>
        (i + 1).toString().padStart(2, "0")
    );
    const minutes = Array.from({ length: 60 }, (_, i) =>
        i.toString().padStart(2, "0")
    );
    const periods = ["AM", "PM"];

    const [tempH, setTempH] = useState("09");
    const [tempM, setTempM] = useState("00");
    const [tempP, setTempP] = useState("AM");

    const apply = () => {
        onChange(`${tempH}:${tempM} ${tempP}`);
        onClose(); // 🔥 closes picker
    };

    return (
        <div className="relative">
            {/* Display */}
            <div
                onClick={() => (isOpen ? onClose() : onOpen())}
                className="w-full pl-10 px-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white cursor-pointer hover:border-green-400"
            >
                {value || "--:-- --"}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-fill bg-[#0f1b2e] border border-[#2e3b55] rounded-xl p-3 shadow-xl">

                    <div className="flex gap-3 justify-center">

                        {/* Hours */}
                        <div className="h-40 overflow-y-auto no-scrollbar">
                            {hours.map((h) => (
                                <div
                                    key={h}
                                    onClick={() => setTempH(h)}
                                    className={`px-3 py-1 text-center rounded cursor-pointer ${tempH === h
                                        ? "bg-gradient-to-r from-green-400 to-teal-400 text-black"
                                        : "text-gray-400 hover:bg-white/10"
                                        }`}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>

                        {/* Minutes */}
                        <div className="h-40 overflow-y-auto no-scrollbar">
                            {minutes.map((m) => (
                                <div
                                    key={m}
                                    onClick={() => setTempM(m)}
                                    className={`px-3 py-1 text-center rounded cursor-pointer ${tempM === m
                                        ? "bg-gradient-to-r from-green-400 to-teal-400 text-black"
                                        : "text-gray-400 hover:bg-white/10"
                                        }`}
                                >
                                    {m}
                                </div>
                            ))}
                        </div>

                        {/* AM / PM */}
                        <div className="h-40 overflow-y-auto no-scrollbar">
                            {periods.map((p) => (
                                <div
                                    key={p}
                                    onClick={() => setTempP(p)}
                                    className={`px-3 py-1 text-center rounded cursor-pointer ${tempP === p
                                        ? "bg-gradient-to-r from-green-400 to-teal-400 text-black"
                                        : "text-gray-400 hover:bg-white/10"
                                        }`}
                                >
                                    {p}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={apply}
                        className="mt-3 w-full bg-gradient-to-r from-green-400 to-teal-400 text-black py-1 rounded-lg"
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}