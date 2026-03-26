import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { User, Mail, Lock, Briefcase, Eye, EyeOff } from "lucide-react";

interface EmployeeFormData {
    id?: string;
    name: string;
    email: string;
    role: string;
    password?: string;
    mobile?: string;
    isActive?: boolean;
    joinDate?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (employee: EmployeeFormData) => void;
    onEdit?: (id: number, employee: EmployeeFormData) => void;
    employee?: EmployeeFormData;
}

function EmployeeFormModal({ isOpen, onClose, onAdd, onEdit, employee }: Props) {
    const [form, setForm] = useState<EmployeeFormData>({
        name: "",
        email: "",
        role: "",
        password: "",
        mobile: "",
        isActive: true,
        joinDate: "",
    });

    const [errors, setErrors] = useState<any>({});
    const [showPassword, setShowPassword] = useState(false);
    const [openRole, setOpenRole] = useState(false);

    const roles = [
        { label: "Admin", value: "ADMIN" },
        { label: "Employee", value: "EMPLOYEE" },
    ];

    useEffect(() => {
        if (employee) setForm(employee);
        else
            setForm({
                name: "",
                email: "",
                role: "",
                password: "",
                mobile: "",
                isActive: true,
                joinDate: "",
            });

        setErrors({});
    }, [employee]);

    const validate = () => {
        let newErrors: any = {};

        // Name
        if (!form.name.trim()) newErrors.name = "Name is required";

        // Email
        if (!form.email.trim()) newErrors.email = "Email is required";
        else if (!/^\S+@\S+\.\S+$/.test(form.email))
            newErrors.email = "Invalid email format";

        // Mobile
        if (!form.mobile) newErrors.mobile = "Mobile is required";
        else if (!/^\d{10}$/.test(form.mobile))
            newErrors.mobile = "Mobile must be 10 digits";

        // Role
        if (!form.role) newErrors.role = "Role is required";

        // Join Date
        if (!form.joinDate) newErrors.joinDate = "Join date is required";

        // Password (only for add)
        if (!employee) {
            if (!form.password) newErrors.password = "Password is required";
            else if (form.password.length < 6)
                newErrors.password = "Minimum 6 characters required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === "checkbox" ? checked : value });

        setErrors((prev: any) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!validate()) return;

        if (employee && onEdit && employee.id) {
            onEdit(employee.id, form);
        } else {
            onAdd(form);
        }
    };

    const handleClose = () => {
        onClose();
        setShowPassword(false);
        setOpenRole(false);
        setErrors({});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-md bg-[#0f1b2e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-xl font-semibold mb-1">{employee ? "Edit Employee" : "Add Employee"}</h2>
                <p className="text-sm text-gray-400 mb-5">
                    Fill details to {employee ? "update" : "create"} employee
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Name */}
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            name="name"
                            placeholder="Full Name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] outline-none"
                        />
                        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                    </div>

                    {/* Email */}
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            name="email"
                            type="email"
                            placeholder="Email Address"
                            value={form.email}
                            onChange={handleChange}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] outline-none"
                        />
                        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                    </div>

                    {/* Mobile */}
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            name="mobile"
                            placeholder="Mobile"
                            value={form.mobile}
                            onChange={handleChange}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] outline-none"
                        />
                        {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
                    </div>

                    {/* Role */}
                    <div className="relative">
                        <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                        <div
                            onClick={() => setOpenRole(!openRole)}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] cursor-pointer flex justify-between items-center"
                        >
                            <span className={form.role ? "text-white" : "text-gray-400"}>
                                {roles.find(r => r.value === form.role)?.label || "Select Role"}
                            </span>
                            <span className="text-gray-400">▼</span>
                        </div>
                        {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role}</p>}

                        {openRole && (
                            <div className="absolute w-full mt-2 bg-[#132033] border border-[#2e3b55] rounded-xl shadow-lg overflow-hidden z-50">
                                {roles.map((role) => (
                                    <div
                                        key={role.value}
                                        onClick={() => {
                                            setForm({ ...form, role: role.value });
                                            setOpenRole(false);
                                            setErrors((prev: any) => ({ ...prev, role: "" }));
                                        }}
                                        className="px-4 py-2 hover:bg-[#1c2a3f] cursor-pointer"
                                    >
                                        {role.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Join Date */}
                    <div>
                        <DatePicker
                            selected={form.joinDate ? new Date(form.joinDate) : null}
                            onChange={(date) => {
                                setForm((prev) => ({
                                    ...prev,
                                    joinDate: date ? date.toISOString() : "",
                                }));
                                setErrors((prev: any) => ({ ...prev, joinDate: "" }));
                            }}
                            placeholderText="Join Date"
                            dateFormat="yyyy-MM-dd"
                            className="w-full px-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white outline-none"
                        />
                        {errors.joinDate && <p className="text-red-400 text-xs mt-1">{errors.joinDate}</p>}
                    </div>

                    {/* Password */}
                    {!employee && (
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                        </div>
                    )}

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3 pl-3">
                        <span className="text-gray-300 font-medium">Active</span>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, isActive: !form.isActive })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full ${form.isActive ? "bg-green-500" : "bg-gray-500/50"}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white ${form.isActive ? "translate-x-5" : "translate-x-1"}`}
                            />
                        </button>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg bg-white/10">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-400 to-green-500 text-black font-medium">
                            {employee ? "Update Employee" : "Add Employee"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EmployeeFormModal;