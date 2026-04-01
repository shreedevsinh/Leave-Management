import { useState, useEffect } from "react";
import { Calendar, FileText, Briefcase, User, NotebookPen  } from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

interface LeaveType {
    id: number;
    name: string;
    balance?: any;
}

export default function CreateLeaveModal({ isOpen, onClose, onSubmit }: Props) {
    const token = Cookies.get("access_token");
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    const role = decoded.role;

    // if (role !== "EMPLOYEE") return null;
    const userId = decoded.sub;

    const [form, setForm] = useState({
        userId: "",
        startDate: "",
        endDate: "",
        typeId: "",
        reason: "",
        totalDays: 0,
        status: "",
    });

    const [errors, setErrors] = useState<any>({});

    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const [error, setError] = useState("");
    const [openUser, setOpenUser] = useState(false);
    const [openType, setOpenType] = useState(false);
    const [openStatus, setOpenStatus] = useState(false);

    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [employees, setEmployees] = useState<LeaveType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);

    type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

    const statusTypes: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED"];

    const getStatusColor = (status: LeaveStatus) => {
        switch (status) {
            case "APPROVED": return "text-green-400";
            case "REJECTED": return "text-red-400";
            default: return "text-yellow-400";
        }
    };

    // Fetch Leave Types
    useEffect(() => {
        if (!userId) return;

        let isMounted = true;
        const fetchLeaveTypes = async () => {
            try {
                setLoadingTypes(true);

                const res = await fetch("https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/leave-types/");

                if (!res.ok) {
                    throw new Error("Failed to fetch leave types");
                }

                const data = await res.json();

                const leaveTypesData = data.leaveTypes || data;

                const effectiveUserId =
                    role === "ADMIN" && form.userId ? form.userId : userId;

                console.log(effectiveUserId);


                const filtered = leaveTypesData.map((leaveType: any) => {
                    const userBalance = leaveType.balances?.find(
                        (b: any) => b.userId == effectiveUserId
                    );

                    console.log(userBalance);

                    const { balances, ...rest } = leaveType;

                    return {
                        ...rest,
                        balance: userBalance || null,
                    };
                });
                console.log(filtered);

                setLeaveTypes(filtered);
            } catch (err) {
                console.error("❌ Failed to fetch leave types", err);
            } finally {
                setLoadingTypes(false);
            }
        };

        fetchLeaveTypes();
    }, [userId, role, form.userId]);

    // Fetch Employees
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                setLoadingTypes(true);

                const res = await fetch("https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/users/employees");
                const data = await res.json();

                setEmployees(data);
            } catch (err) {
                console.error("❌ Failed to fetch employees", err);
            } finally {
                setLoadingTypes(false);
            }
        };

        fetchEmployees();
    }, []);

    // Auto calculate total days
    useEffect(() => {
        if (startDate && endDate) {
            const diff =
                (endDate.getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24) +
                1;

            setForm((prev) => ({
                ...prev,
                totalDays: diff > 0 ? diff : 0,
            }));
        }
    }, [startDate, endDate]);

    const validate = () => {
        let newErrors: any = {};

        if (role === "ADMIN") {
            if (!form.userId) newErrors.userId = "User is required";
        } else {
            form.userId = userId
        }

        if (!form.typeId) newErrors.typeId = "Leave type is required";

        if (!startDate) newErrors.startDate = "Start date is required";

        if (!endDate) newErrors.endDate = "End date is required";

        if (startDate && endDate && endDate < startDate) {
            newErrors.endDate = "End date must be after start date";
        }

        if (form.totalDays <= 0) {
            newErrors.totalDays = "Invalid date range";
        }

        if (form.reason && form.reason.length > 200) {
            newErrors.reason = "Reason must be under 200 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onSubmit({
            ...form,
            typeId: Number(form.typeId),
            startDate,
            endDate,
            userId: Number(form.userId),
            status: form.status,
        });

        handleClose();
    };

    const handleClose = () => {
        onClose();
        setErrors({});
        setOpenUser(false);
        setOpenType(false);
        setStartDate(null);
        setEndDate(null);
        setForm({
            userId: "",
            startDate: "",
            endDate: "",
            typeId: "",
            reason: "",
            totalDays: 0,
            status: "PENDING",
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-md bg-[#0f1b2e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl">

                <h2 className="text-xl font-semibold mb-1">Create Leave</h2>
                <p className="text-sm text-gray-400 mb-5">
                    Fill details to apply leave
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* User Selection */}
                    {role === "ADMIN" && (
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-400" size={18} />
                            <div
                                onClick={() => setOpenUser(!openUser)}
                                className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] cursor-pointer flex justify-between items-center hover:border-green-400"
                            >
                                <span className={form.userId ? "text-white" : "text-gray-400"}>
                                    {
                                        employees.find(e => e.id.toString() === form.userId)?.name ||
                                        (loadingTypes ? "Loading..." : "Select Employee")
                                    }
                                </span>
                                <span className="text-gray-400">▼</span>
                            </div>
                            {openUser && (
                                <div className="absolute w-full mt-2 bg-[#132033] border border-[#2e3b55] rounded-xl shadow-lg overflow-hidden z-50">
                                    {employees.map((employee) => (
                                        <div
                                            key={employee.id}
                                            onClick={() => {
                                                setForm({ ...form, userId: employee.id.toString() });
                                                setOpenUser(false);
                                            }}
                                            className="px-4 py-3 hover:bg-[#1c2a3f] cursor-pointer flex items-center justify-between"
                                        >
                                            {/* Left: Leave Name */}
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">
                                                    {employee.name}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {!loadingTypes && leaveTypes.length === 0 && (
                                        <div className="px-4 py-2 text-gray-400 text-sm">
                                            No leave types found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Leave Type */}
                    <div className="relative">
                        <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                        <div
                            onClick={() => setOpenType(!openType)}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] cursor-pointer flex justify-between items-center hover:border-green-400"
                        >
                            <span className={form.typeId ? "text-white" : "text-gray-400"}>
                                {
                                    leaveTypes.find(t => t.id.toString() === form.typeId)?.name ||
                                    (loadingTypes ? "Loading..." : "Select Leave Type")
                                }
                            </span>
                            <span className="text-gray-400">▼</span>
                        </div>

                        {openType && (
                            <div className="absolute w-full mt-2 bg-[#132033] border border-[#2e3b55] rounded-xl shadow-lg overflow-hidden z-50">
                                {leaveTypes.map((type) => (
                                    <div
                                        key={type.id}
                                        onClick={() => {
                                            setForm({ ...form, typeId: type.id.toString() });
                                            setOpenType(false);
                                        }}
                                        className="px-4 py-3 hover:bg-[#1c2a3f] cursor-pointer flex items-center justify-between"
                                    >
                                        {/* Left: Leave Name */}
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">
                                                {type.name}
                                            </span>

                                            {type.balance && (
                                                <span className="text-xs text-gray-400">
                                                    Used: {type.balance.used}
                                                </span>
                                            )}
                                        </div>

                                        {/* Right: Remaining Badge */}
                                        {type.balance && (
                                            <div className="text-right">
                                                <span className="text-sm font-semibold text-green-400">
                                                    {type.balance.remaining}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    / {type.balance.total}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {!loadingTypes && leaveTypes.length === 0 && (
                                    <div className="px-4 py-2 text-gray-400 text-sm">
                                        No leave types found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Start Date */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                        <DatePicker
                            selected={startDate}
                            onChange={(date) => {
                                setStartDate(date);
                                setErrors((prev: any) => ({ ...prev, startDate: "" }));
                            }}
                            selectsStart
                            startDate={startDate}
                            endDate={endDate}
                            placeholderText="Start Date"
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white outline-none"
                        />
                        {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate}</p>}
                    </div>

                    {/* End Date */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                        <DatePicker
                            selected={endDate}
                            onChange={(date) => {
                                setEndDate(date);
                                setErrors((prev: any) => ({ ...prev, endDate: "" }));
                            }}
                            selectsEnd
                            startDate={startDate}
                            endDate={endDate}
                            minDate={startDate}
                            placeholderText="End Date"
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white outline-none"
                        />
                        {errors.endDate && <p className="text-red-400 text-xs mt-1">{errors.endDate}</p>}
                    </div>

                    {/* Total Days */}
                    <div className="px-3 py-2 rounded-xl bg-[#0f1e33] border border-[#2e3b55] text-gray-300 text-sm">
                        Total: {form.totalDays} day(s)
                        {errors.totalDays && <p className="text-red-400 text-xs">{errors.totalDays}</p>}
                    </div>

                    {/* Status */}
                    {role === "ADMIN" && (
                        <div className="relative">
                            <NotebookPen className="absolute left-3 top-3 text-gray-400" size={18} />

                            <div
                                onClick={() => setOpenStatus((prev) => !prev)}
                                className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] cursor-pointer flex justify-between items-center hover:border-green-400"
                            >
                                <span className={`font-medium ${getStatusColor(form.status)}`}>
                                    {form.status || "Select Status"}
                                </span>
                                <span className="text-gray-400">▼</span>
                            </div>

                            {openStatus && (
                                <div className="absolute w-full mt-2 bg-[#132033] border border-[#2e3b55] rounded-xl shadow-lg overflow-hidden z-50">
                                    {statusTypes.map((status) => (
                                        <div
                                            key={status}
                                            onClick={() => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    status,
                                                }));
                                                setOpenStatus(false);
                                            }}
                                            className="px-4 py-3 hover:bg-[#1c2a3f] cursor-pointer"
                                        >
                                            <span className="text-white font-medium">
                                                {status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reason */}
                    <div className="relative">
                        <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                        <textarea
                            placeholder="Reason (optional)"
                            value={form.reason}
                            onChange={(e) => {
                                setForm({ ...form, reason: e.target.value });
                                setErrors((prev: any) => ({ ...prev, reason: "" }));
                            }}
                            rows={3}
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#1c2a3f]/80 border border-[#2e3b55] text-white resize-none"
                        />
                        {errors.reason && <p className="text-red-400 text-xs mt-1">{errors.reason}</p>}
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg bg-white/10">
                            Cancel
                        </button>

                        <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-400 to-green-500 text-black font-medium">
                            Apply Leave
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}