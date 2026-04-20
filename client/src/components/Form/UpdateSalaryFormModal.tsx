import { useState, useEffect } from "react";
import { User, IndianRupee } from "lucide-react";

interface UpdateSalaryFormData {
    employeeName: string;
    currentSalary: number;
    newSalary: number;
    id: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (data: UpdateSalaryFormData) => void;
    data?: {
        employee: string;
        currentSalary: number;
        name: string;
        id: string;
        salary: number;
    };
}

function UpdateSalaryFormModal({ isOpen, onClose, onUpdate, data }: Props) {
    const [form, setForm] = useState<UpdateSalaryFormData>({
        id: "",
        employeeName: "",
        currentSalary: 0,
        newSalary: 0,
    });

    const [errors, setErrors] = useState<any>({});

    useEffect(() => {
        if (data) {
            setForm({
                id: data.id,
                employeeName: data.name,
                currentSalary: data.salary || 0,
                newSalary: data.currentSalary || 0,
            });
        }

        setErrors({});
    }, [data]);

    const validate = () => {
        let newErrors: any = {};

        if (!form.newSalary || form.newSalary <= 0) {
            newErrors.newSalary = "Salary must be greater than 0";
        }

        if (form.newSalary === form.currentSalary) {
            newErrors.newSalary = "New salary must be different";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;

        setForm((prev) => ({
            ...prev,
            newSalary: Number(value),
        }));

        setErrors((prev: any) => ({ ...prev, newSalary: "" }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onUpdate(form);
    };

    const handleClose = () => {
        onClose();
        setErrors({});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-md bg-[#0f1b2e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-xl font-semibold mb-1">
                    Update Salary
                </h2>
                <p className="text-sm text-gray-400 mb-5">
                    Modify employee salary details
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Employee Name (readonly) */}
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            value={form.employeeName}
                            disabled
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/50 border border-[#2e3b55] text-gray-400 cursor-not-allowed"
                        />
                    </div>

                    {/* Current Salary (readonly) */}
                    <div className="relative">
                        <IndianRupee className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            value={form.currentSalary}
                            disabled
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/50 border border-[#2e3b55] text-gray-400 cursor-not-allowed"
                        />
                    </div>

                    {/* New Salary */}
                    <div className="relative">
                        <IndianRupee className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            type="number"
                            name="newSalary"
                            placeholder="New Salary"
                            value={form.newSalary}
                            onChange={handleChange}
                            onWheel={(e) => e.currentTarget.blur()} // prevent scroll change
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] outline-none"
                        />
                        {errors.newSalary && (
                            <p className="text-red-400 text-xs mt-1">
                                {errors.newSalary}
                            </p>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-lg bg-white/10"
                        >
                            Cancel
                        </button>
                        <button type="submit" className="button-gradient">
                            Update Salary
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UpdateSalaryFormModal;