import { useState } from "react";
import type { LeaveType } from "./types";
import Toast from "../common/Toast";
import Cookies from "js-cookie";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: LeaveType) => void;
};

export default function CreateLeaveTypeModal({
    isOpen,
    onClose,
    onCreate,
}: Props) {
    const API_URL = import.meta.env.VITE_API_URL;

    const token = Cookies.get("access_token");
    if (!token) return null;

    const [name, setName] = useState("");
    const [maxPerYear, setMaxPerYear] = useState(0);
    const [isPaid, setIsPaid] = useState(true);
    const [loading, setLoading] = useState(false);

    const [errors, setErrors] = useState<any>({});
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    if (!isOpen) return null;

    const validate = () => {
        let newErrors: any = {};

        if (!name.trim()) {
            newErrors.name = "Leave name is required";
        } else if (name.trim().length < 3) {
            newErrors.name = "Minimum 3 characters required";
        }

        if (!maxPerYear || maxPerYear <= 0) {
            newErrors.maxPerYear = "Enter a valid number (> 0)";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/leave-types/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name,
                    maxPerYear,
                    isPaid,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create leave type");
            }

            const created = await res.json();

            onCreate(created);


            // Reset form
            setName("");
            setMaxPerYear(0);
            setIsPaid(true);
            setErrors({});

            // ✅ Success Toast
            setToast({
                message: "Leave type created successfully!",
                type: "success",
            });

            onClose();
        } catch (error: any) {
            console.error("Create Leave Type Error:", error.message);

            // ❌ Error Toast
            setToast({
                message: error.message || "Something went wrong",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <div
                    className="bg-[#13263f] text-white w-[400px] rounded-2xl shadow-xl p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">
                            Create Leave Type
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Form */}
                    <div className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Leave Name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setErrors((prev: any) => ({
                                        ...prev,
                                        name: "",
                                    }));
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 outline-none focus:border-green-400"
                            />
                            {errors.name && (
                                <p className="text-red-400 text-xs mt-1">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div>
                            <input
                                type="number"
                                placeholder="Max per year"
                                value={maxPerYear}
                                onChange={(e) => {
                                    setMaxPerYear(Number(e.target.value));
                                    setErrors((prev: any) => ({
                                        ...prev,
                                        maxPerYear: "",
                                    }));
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 outline-none focus:border-green-400"
                            />
                            {errors.maxPerYear && (
                                <p className="text-red-400 text-xs mt-1">
                                    {errors.maxPerYear}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                className="accent-green-400"
                                type="checkbox"
                                checked={isPaid}
                                onChange={(e) =>
                                    setIsPaid(e.target.checked)
                                }
                            />
                            <label className="text-sm text-white/80">
                                Paid Leave
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-400 to-teal-400 text-[#0f1e33] font-medium hover:opacity-90 transition disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ✅ Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}