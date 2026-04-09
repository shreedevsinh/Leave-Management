import { useState, useEffect } from "react";
import { Clock, Plus, CheckCircle } from "lucide-react";

type OfficeTiming = {
    startTime: string;
    endTime: string;
    workingHours: number;
    graceMinutes: number;
    isActive: boolean;
};

export default function OfficeTimes() {
    const [open, setOpen] = useState(false);
    const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);
    const [timings, setTimings] = useState<OfficeTiming[]>([]);


    // ✅ Fetch data from API
    const fetchTimings = async () => {
        try {
            const res = await fetch("http://localhost:3000/officetime");
            if (!res.ok) throw new Error("Failed to fetch office timings");

            const data: OfficeTiming[] = await res.json();
            setTimings(data);
        } catch (err) {
            console.error("❌ Fetch error:", err);
        }
    };

    // ✅ Call on mount
    useEffect(() => {
        fetchTimings();
    }, []);

    const [form, setForm] = useState({
        startTime: "",
        endTime: "",
        workingHours: "",
        graceMinutes: "",
    });

    const [errors, setErrors] = useState({
        startTime: "",
        endTime: "",
        workingHours: "",
        graceMinutes: "",
    });

    const resetForm = () => {
        setForm({
            startTime: "",
            endTime: "",
            workingHours: "",
            graceMinutes: "",
        });

        setErrors({
            startTime: "",
            endTime: "",
            workingHours: "",
            graceMinutes: "",
        });

        setActivePicker(null);
    };

    const validate = () => {
        const newErrors = {
            startTime: "",
            endTime: "",
            workingHours: "",
            graceMinutes: "",
        };

        if (!form.startTime) newErrors.startTime = "Start time is required";
        if (!form.endTime) newErrors.endTime = "End time is required";
        if (!form.workingHours)
            newErrors.workingHours = "Working hours is required";
        if (!form.graceMinutes)
            newErrors.graceMinutes = "Grace minutes is required";

        setErrors(newErrors);

        return Object.values(newErrors).every((e) => !e);
    };

    const convertToISODateTime = (time12h: string) => {
        const [time, modifier] = time12h.split(" ");
        let [hours, minutes] = time.split(":").map(Number);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        // 👉 Create LOCAL (IST) date
        const localDate = new Date(1970, 0, 1, hours, minutes, 0);

        // 👉 Convert to UTC ISO
        return localDate.toISOString();
    };

    const setWorkingHours = (start: string, end: string) => {
        const startDate = new Date(convertToISODateTime(start));
        const endDate = new Date(convertToISODateTime(end));
        const diffMs = endDate.getTime() - startDate.getTime();
        return diffMs / (1000 * 60 * 60); // convert ms to hours
    };

    useEffect(() => {
        const startDateTime = form.startTime ? new Date(convertToISODateTime(form.startTime)) : null;
        const endDateTime = form.endTime ? new Date(convertToISODateTime(form.endTime)) : null;
        if (startDateTime && endDateTime) {
            setForm((prevForm) => ({
                ...prevForm,
                workingHours: setWorkingHours(form.startTime, form.endTime),
            }));
        }
    }, [form.startTime, form.endTime]);

    const formatPlainTime = (isoString: string) => {
        const date = new Date(isoString);

        return date.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const handleCreate = async () => {
        if (!validate()) return;

        const newTiming = {
            startTime: convertToISODateTime(form.startTime),
            endTime: convertToISODateTime(form.endTime),
            workingHours: Number(form.workingHours),
            graceMinutes: Number(form.graceMinutes),
            isActive: false,
        };

        console.log("Creating timing:", newTiming);

        try {
            const res = await fetch("http://localhost:3000/officetime", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newTiming),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to create timing");
            } else {
                fetchTimings();
                resetForm();
                setOpen(false);
            }

        } catch (error: any) {
            console.error("Error:", error.message);
            alert(error.message); // you can replace with toast
        }
    };

    const setActive = async (id: string) => {
        try {
            const res = await fetch(`http://localhost:3000/officetime/active/${id}`, {
                method: "PUT"
            });

            if (!res.ok) throw new Error("Failed to set active timing");

            // ✅ Update local state to reflect active timing
            setTimings((prev) =>
                prev.map((t) => ({
                    ...t,
                    isActive: t.id === id,
                }))
            );

            console.log("✅ Timing set as active");
        } catch (err) {
            console.error("❌ Error setting active timing:", err);
        }
    };
    return (
        <div className="p-3 text-white">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold">Office Timings</h1>
                    <p className="text-gray-400 text-sm">
                        Manage working hours and policies
                    </p>
                </div>

                <button
                    onClick={() => setOpen(true)}
                    className="bg-gradient-to-r from-green-400 to-teal-400 text-[#0f1e33] font-semibold px-5 py-2.5 rounded-xl"
                >
                    + Add Timing
                </button>
            </div>

            {/* Timing Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {timings.map((t) => (
                    <div
                        key={t.id}
                        className={`p-5 rounded-2xl border transition hover:scale-[1.02] ${t.isActive
                            ? "border-green-500 bg-green-500/10 shadow-green-500/10 shadow-md"
                            : "border-gray-700 bg-gray-900 hover:border-gray-600"
                            }`}
                    >
                        {/* Top */}
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-medium flex items-center gap-2 text-lg">
                                <Clock size={18} />
                                {formatPlainTime(t.startTime)} - {formatPlainTime(t.endTime)}
                            </h2>

                            {t.isActive && (
                                <span className="flex items-center gap-1 text-green-400 text-xs bg-green-500/10 px-2 py-1 rounded-full border border-green-500  ">
                                    <CheckCircle size={14} />
                                    Active
                                </span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="text-sm text-gray-400 space-y-1">
                            <p>
                                ⏱ Working Hours:{" "}
                                <span className="text-white font-medium">
                                    {t.workingHours} hrs
                                </span>
                            </p>
                            <p>
                                🕒 Grace Time:{" "}
                                <span className="text-white font-medium">
                                    {t.graceMinutes} mins
                                </span>
                            </p>
                        </div>

                        {/* Action */}
                        {!t.isActive && (
                            <button
                                onClick={() => setActive(t.id)}
                                className="mt-4 w-full bg-indigo-600 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
                            >
                                Set Active
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="relative w-full max-w-md bg-[#0f1b2e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl">

                        {/* Header */}
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-white">
                                Create Office Timing
                            </h2>
                            <p className="text-sm text-gray-400">
                                Define working hours and grace policy
                            </p>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4">

                            {/* Start Time */}
                            <div className="relative">
                                <CustomTimePicker
                                    value={form.startTime}
                                    isOpen={activePicker === "start"}
                                    onOpen={() => setActivePicker("start")}
                                    onClose={() => setActivePicker(null)}
                                    onChange={(val) => {
                                        const updatedForm = { ...form, startTime: val };
                                        setForm(updatedForm);
                                    }}
                                />
                                <Clock className="absolute left-3 top-3 text-gray-400" size={18} />

                                {errors.startTime && (
                                    <p className="text-red-400 text-xs mt-1">{errors.startTime}</p>
                                )}
                            </div>
                            {/* End Time */}
                            <div className="relative">
                                <CustomTimePicker
                                    value={form.endTime}
                                    isOpen={activePicker === "end"}
                                    onOpen={() => setActivePicker("end")}
                                    onClose={() => setActivePicker(null)}
                                    onChange={(val) => {
                                        const updatedForm = { ...form, endTime: val };
                                        setForm(updatedForm);
                                    }}
                                />
                                <Clock className="absolute left-3 top-3 text-gray-400" size={18} />

                                {errors.endTime && (
                                    <p className="text-red-400 text-xs mt-1">{errors.endTime}</p>
                                )}
                            </div>
                            {/* Working Hours */}
                            <div>
                                <input
                                    type="number"
                                    placeholder="Working Hours"
                                    value={form.workingHours}
                                    onChange={(e) => {
                                        setForm({ ...form, workingHours: e.target.value });
                                        setErrors({ ...errors, workingHours: "" });
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white outline-none hover:border-green-400 focus:border-green-400"
                                />

                                {errors.workingHours && (
                                    <p className="text-red-400 text-xs mt-1">
                                        {errors.workingHours}
                                    </p>
                                )}
                            </div>

                            {/* Grace Minutes */}
                            <div>
                                <input
                                    type="number"
                                    placeholder="Grace Minutes"
                                    value={form.graceMinutes}
                                    onChange={(e) => {
                                        setForm({ ...form, graceMinutes: e.target.value });
                                        setErrors({ ...errors, graceMinutes: "" });
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white outline-none hover:border-green-400 focus:border-green-400"
                                />

                                {errors.graceMinutes && (
                                    <p className="text-red-400 text-xs mt-1">
                                        {errors.graceMinutes}
                                    </p>
                                )}
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    resetForm();
                                }}
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-400 to-teal-400 text-black font-medium text-sm transition"
                            >
                                Save Timing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CustomTimePicker({
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