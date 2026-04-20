import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import {
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Laptop,
    Lock,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

interface Device {
    id?: string;
    deviceName: string;
    password: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    employee?: {
        id: string;
        name: string;
    };
    devicesData?: string; // 👈 coming as string
}

function UserDeviceModal({ isOpen, onClose, employee, devicesData }: Props) {
    const [devices, setDevices] = useState<Device[]>([]);

    useEffect(() => {
        if (devicesData && Array.isArray(devicesData)) {
            const formatted = devicesData.map((d: any) => ({
                id: d.id || undefined,
                deviceName: d.deviceName || "",
                password: d.password || "",
            }));

            setDevices(formatted);
        } else {
            setDevices([]);
        }
    }, [devicesData]);


    const [showPassword, setShowPassword] = useState<boolean[]>([]);
    const [loading, setLoading] = useState(false);

    const token = Cookies.get("access_token");

    const handleAddDevice = () => {
        setDevices([...devices, { deviceName: "", password: "" }]);
        setShowPassword([...showPassword, false]);
    };

    const handleChange = (
        index: number,
        field: keyof Device,
        value: string
    ) => {
        const updated = [...devices];
        updated[index][field] = value;
        setDevices(updated);
    };

    const handleRemove = (index: number) => {
        setDevices(devices.filter((_, i) => i !== index));
        setShowPassword(showPassword.filter((_, i) => i !== index));
    };

    const togglePassword = (index: number) => {
        const updated = [...showPassword];
        updated[index] = !updated[index];
        setShowPassword(updated);
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();

        if (!employee?.id) return;

        setLoading(true);

        try {
            const res = await fetch(
                `${API_URL}/users/employee/${employee.id}/devices`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ devices }),
                }
            );

            if (!res.ok) throw new Error("Failed");

            onClose();
        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-[#0f1b2e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Laptop className="text-blue-400" size={20} />
                        <h2 className="text-xl font-semibold">
                            {employee?.name || "Employee"} Devices
                        </h2>
                    </div>

                    <button
                        onClick={handleAddDevice}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
                    >
                        <Plus size={16} />
                        Add Device
                    </button>
                </div>

                <p className="text-sm text-gray-400 mb-5">
                    Manage {employee?.name || "employee"}'s device credentials
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Device List */}
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">

                        {devices.map((device, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                            >
                                {/* Device Input */}
                                <div className="flex items-center gap-2 flex-1">
                                    <Laptop size={16} className="text-gray-400" />
                                    <input
                                        type="text"
                                        value={device.deviceName}
                                        onChange={(e) =>
                                            handleChange(index, "deviceName", e.target.value)
                                        }
                                        placeholder="Device name"
                                        className="w-full bg-transparent outline-none text-sm"
                                    />
                                </div>

                                {/* Password Input */}
                                <div className="flex items-center gap-2 flex-1 relative">
                                    <Lock size={16} className="text-gray-400" />

                                    <input
                                        type={showPassword[index] ? "text" : "password"}
                                        value={device.password}
                                        onChange={(e) =>
                                            handleChange(index, "password", e.target.value)
                                        }
                                        placeholder="Password"
                                        className="w-full bg-transparent outline-none text-sm pr-8"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => togglePassword(index)}
                                        className="absolute right-1 text-gray-400 hover:text-white"
                                    >
                                        {showPassword[index] ? (
                                            <EyeOff size={16} />
                                        ) : (
                                            <Eye size={16} />
                                        )}
                                    </button>
                                </div>

                                {/* Remove */}
                                <button
                                    type="button"
                                    onClick={() => handleRemove(index)}
                                    className="text-red-400 hover:text-red-500 transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 button-gradient disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UserDeviceModal;