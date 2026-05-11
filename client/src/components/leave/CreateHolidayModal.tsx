import { useState } from "react";
import DatePicker from "react-datepicker";
import { Calendar, Upload, FileSpreadsheet } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import Cookies from "js-cookie";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export default function CreateHolidayModal({
    isOpen,
    onClose,
}: Props) {
    const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

    // Single Form
    const [name, setName] = useState("");
    const [date, setDate] = useState<Date | null>(null);
    const [description, setDescription] = useState("");
    const [isOptional, setIsOptional] = useState(false);

    // Bulk Upload
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<any>({});

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const token = Cookies.get("access_token");
    if (!token) return null;

    if (!isOpen) return null;

    const resetForm = () => {
        setName("");
        setDate(null);
        setDescription("");
        setIsOptional(false);
        setExcelFile(null);
        setErrors({});
    };

    const validateSingleForm = () => {
        let newErrors: any = {};

        if (!name.trim()) {
            newErrors.name = "Holiday name is required";
        }

        if (!date) {
            newErrors.date = "Date is required";
        }

        if (description.length > 300) {
            newErrors.description =
                "Description must be under 300 characters";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const validateBulkForm = () => {
        let newErrors: any = {};

        if (!excelFile) {
            newErrors.excelFile = "Excel file is required";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    const handleCreate = async () => {
        if (!validateSingleForm() || !date) return;

        const selected = new Date(date);

        const isoDate = new Date(
            Date.UTC(
                selected.getFullYear(),
                selected.getMonth(),
                selected.getDate()
            )
        ).toISOString();

        try {
            const res = await fetch(`${API_URL}/holidays`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name,
                    date: isoDate,
                    description,
                    isOptional,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to create holiday");
            }

            resetForm();
            onClose();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleBulkUpload = async (file: File) => {
        try {
            const formData = new FormData();

            formData.append("file", file);

            const response = await fetch(
                `${API_URL}/holidays/bulk`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to upload holidays");
            }

            resetForm();
            onClose();
        } catch (error: any) {
            console.error("❌ Upload failed", error);

            alert(error.message);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-[#13263f] text-white w-[550px] rounded-2xl shadow-xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">
                        Create Holiday
                    </h2>

                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab("single")}
                        className={`flex-1 py-2 rounded-lg transition ${activeTab === "single"
                            ? "button-gradient"
                            : "text-white/70 hover:bg-white/10"
                            }`}
                    >
                        Single Holiday
                    </button>

                    <button
                        onClick={() => setActiveTab("bulk")}
                        className={`flex-1 py-2 rounded-lg transition ${activeTab === "bulk"
                            ? "button-gradient"
                            : "text-white/70 hover:bg-white/10"
                            }`}
                    >
                        Bulk Upload
                    </button>
                </div>
                <div className="min-h-[520px] flex flex-col justify-between">
                    {/* SINGLE FORM */}
                    {activeTab === "single" && (
                        <div className="space-y-4">
                            {/* Holiday Name */}
                            <div>
                                <label className="block text-sm mb-2 text-white/70">
                                    Holiday Name
                                </label>

                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);

                                        setErrors((prev: any) => ({
                                            ...prev,
                                            name: "",
                                        }));
                                    }}
                                    placeholder="Enter holiday name"
                                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border outline-none transition
                                        ${errors.name
                                            ? "border-red-400"
                                            : "border-white/10 focus:border-green-400"
                                        }`}
                                />

                                {errors.name && (
                                    <p className="text-red-400 text-xs mt-1">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm mb-2 text-white/70">
                                    Date
                                </label>

                                <div className="relative">
                                    <Calendar
                                        className="absolute left-3 top-3 text-gray-400 z-10"
                                        size={18}
                                    />

                                    <DatePicker
                                        selected={date}
                                        onChange={(selectedDate: Date | null) => {
                                            setDate(selectedDate);

                                            setErrors((prev: any) => ({
                                                ...prev,
                                                date: "",
                                            }));
                                        }}
                                        placeholderText="Select Date"
                                        dateFormat="dd/MM/yyyy"
                                        className={`w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border text-white outline-none transition
                                            ${errors.date
                                                ? "border-red-400"
                                                : "border-white/10 focus:border-green-400"
                                            }`}
                                    />

                                    {errors.date && (
                                        <p className="text-red-400 text-xs mt-1">
                                            {errors.date}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm mb-2 text-white/70">
                                    Description
                                </label>

                                <textarea
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);

                                        setErrors((prev: any) => ({
                                            ...prev,
                                            description: "",
                                        }));
                                    }}
                                    placeholder="Enter description"
                                    rows={6}
                                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border outline-none resize-none transition
                                        ${errors.description
                                            ? "border-red-400"
                                            : "border-white/10 focus:border-green-400"
                                        }`}
                                />

                                <div className="flex justify-between mt-1">
                                    {errors.description ? (
                                        <p className="text-red-400 text-xs">
                                            {errors.description}
                                        </p>
                                    ) : (
                                        <span />
                                    )}

                                    <p className="text-xs text-white/40">
                                        {description.length}/300
                                    </p>
                                </div>
                            </div>

                            {/* Optional Holiday */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isOptional}
                                    onChange={(e) =>
                                        setIsOptional(e.target.checked)
                                    }
                                    className="w-4 h-4"
                                />

                                <label className="text-sm text-white/80">
                                    Optional Holiday
                                </label>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleCreate}
                                    className="w-full button-gradient"
                                >
                                    Create Holiday
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BULK UPLOAD */}
                    {activeTab === "bulk" && (
                        <div>
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/5">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 rounded-full bg-green-500/20">
                                        <FileSpreadsheet
                                            size={32}
                                            className="text-green-400"
                                        />
                                    </div>
                                </div>

                                <h3 className="text-lg font-medium mb-2">
                                    Upload Excel File
                                </h3>

                                <p className="text-sm text-white/60 mb-6">
                                    Upload .xlsx or .csv file to create multiple holidays.
                                </p>

                                <label
                                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl transition cursor-pointer hover:opacity-90"
                                    style={{
                                        background:
                                            "linear-gradient(to right, #4ade80, #2dd4bf)",
                                    }}
                                >
                                    <Upload size={18} />

                                    Choose File

                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];

                                            if (file) {
                                                setExcelFile(file);

                                                setErrors((prev: any) => ({
                                                    ...prev,
                                                    excelFile: "",
                                                }));
                                            }
                                        }}
                                    />
                                </label>

                                {excelFile && (
                                    <div className="mt-5 text-sm text-green-300">
                                        Selected: {excelFile.name}
                                    </div>
                                )}
                                {errors.excelFile && (
                                    <p className="text-red-400 text-xs mt-3">
                                        {errors.excelFile}
                                    </p>
                                )}
                            </div>

                            {/* Sample Format */}
                            <div className="mt-5 p-4 rounded-xl bg-white/5 border border-white/10">
                                <h4 className="font-medium mb-2">
                                    Excel Format
                                </h4>

                                <div className="text-sm text-white/60 space-y-1">
                                    <p>name | date | description | isOptional</p>
                                    <p>
                                        Diwali | 2026-11-08 | Festival |
                                        true
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={() => {
                                        if (!validateBulkForm()) return;

                                        if (excelFile) {
                                            handleBulkUpload(excelFile);
                                        }
                                    }}
                                    disabled={!excelFile}
                                    className="w-full button-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Upload Holidays
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}