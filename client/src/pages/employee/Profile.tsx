import { useEffect, useState } from "react";
import { User, Mail, Briefcase, Save, Lock, Phone } from "lucide-react";
import { CheckCircle, Clock, XCircle, CalendarDays } from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

interface ProfileData {
    name: string;
    email: string;
    role: string;
    mobile: string;
    password: string;
}

interface LeaveSummary {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
}

export default function Profile() {
    const [isEditing, setIsEditing] = useState(false);

    const [profile, setProfile] = useState<ProfileData>({
        name: "",
        email: "",
        role: "",
        mobile: "",
        password: "",
    });

    const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>({
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
    });

    const [leaves, setLeaves] = useState<any[]>([]);

    // 🔐 Auth
    const token = Cookies.get("access_token");
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    const userId = decoded.sub;

    // =========================
    // 🔹 Fetch Data
    // =========================
    useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            try {
                const { data: userData } = await axios.get(
                    `http://localhost:3000/users/employee/${userId}`
                );

                if (!userData) return;

                // 👤 Profile
                setProfile({
                    name: userData.name,
                    email: userData.email,
                    role: userData.role,
                    mobile: userData.mobile,
                    password: "",
                });

                // 📊 Leaves
                const leaveData = userData?.leaves ?? [];
                setLeaves(leaveData);

                setLeaveSummary(calculateSummary(leaveData));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [userId]);

    // =========================
    // 🔹 Helper: Summary Logic
    // =========================
    const calculateSummary = (leaveData: any[]): LeaveSummary => {
        return leaveData.reduce(
            (acc, leave) => {
                const days = leave.totalDays || 0;

                acc.total += days;

                switch (leave.status) {
                    case "APPROVED":
                        acc.approved += days;
                        break;
                    case "PENDING":
                        acc.pending += days;
                        break;
                    case "REJECTED":
                        acc.rejected += days;
                        break;
                }

                return acc;
            },
            { total: 0, approved: 0, pending: 0, rejected: 0 }
        );
    };

    // =========================
    // 🔹 Handlers
    // =========================
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSave = async () => {
        try {
            const payload = {
                name: profile.name,
                email: profile.email,
                mobile: profile.mobile,
                ...(profile.password && { password: profile.password }),
            };

            const { data } = await axios.put(
                `http://localhost:3000/users/user/${userId}`,
                payload
            );

            setProfile((prev) => ({ ...prev, password: "" }));
            setIsEditing(false);

            console.log("Profile updated:", data);
        } catch (error) {
            console.error("Error updating profile:", error);
        }
    };

    return (
        <div className="p-4 min-h-screen text-white">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">My Profile</h1>
                <p className="text-gray-400 text-sm">
                    Manage your personal information
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 ">

                {/* Profile Card */}
                <div className="lg:col-span-7 border border-white/10 rounded-2xl p-6 bg-[#0f1e35]">

                    {/* Avatar */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center text-xl font-bold text-[40px] text-black">
                            {profile.name?.[0] || "U"}
                        </div>
                        <div>
                            <h2 className="text-lg font-medium">{profile.name}</h2>
                            <p className="text-gray-400 text-sm">{profile.email}</p>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { name: "name", icon: User, type: "text" },
                            { name: "email", icon: Mail, type: "email" },
                            { name: "mobile", icon: Phone, type: "text" },
                            { name: "password", icon: Lock, type: "password" },
                        ].map(({ name, icon: Icon, type }) => (
                            <div key={name} className="relative">
                                <Icon className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input
                                    type={type}
                                    name={name}
                                    value={(profile as any)[name]}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    placeholder={name === "password" ? "New Password" : ""}
                                    className="w-full pl-10 py-2 bg-white/10 rounded-xl focus:outline-none"
                                />
                            </div>
                        ))}

                        {/* Role */}
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={profile.role}
                                disabled
                                className="w-full pl-10 py-2 bg-white/10 rounded-xl opacity-70"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex justify-end">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl"
                            >
                                Edit Profile
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl"
                            >
                                <Save size={16} />
                                Save Changes
                            </button>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-5">
                    <div className="grid grid-cols-2 gap-4">

                        {[
                            {
                                label: "Total Leaves",
                                value: leaveSummary.total,
                                icon: CalendarDays,
                                color: "blue",
                            },
                            {
                                label: "Approved",
                                value: leaveSummary.approved,
                                icon: CheckCircle,
                                color: "green",
                            },
                            {
                                label: "Pending",
                                value: leaveSummary.pending,
                                icon: Clock,
                                color: "yellow",
                            },
                            {
                                label: "Rejected",
                                value: leaveSummary.rejected,
                                icon: XCircle,
                                color: "red",
                            },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div
                                key={label}
                                className="relative bg-[#0f1e35] border border-white/10 rounded-2xl p-4 flex items-center justify-between transition hover:scale-[1.03] hover:bg-white/10"
                            >
                                {/* Left Content */}
                                <div>
                                    <p className="text-sm text-gray-400">{label}</p>
                                    <h3 className="text-2xl font-semibold mt-1">{value}</h3>
                                </div>

                                {/* Icon */}
                                <div
                                    className={`p-3 rounded-xl bg-${color}-500/20 text-${color}-400`}
                                >
                                    <Icon size={22} />
                                </div>
                            </div>
                        ))}

                    </div>
                </div>

            </div>
        </div>
    );
}