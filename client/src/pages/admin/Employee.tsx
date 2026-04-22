import { useState, useEffect } from "react";
import EmployeeFormModal from "../../components/Form/EmployeeFormModal";
import type { EmployeeFormData } from "../../components/Form/EmployeeFormModal";
import type { UpdateSalaryFormData } from "../../components/Form/EmployeeFormModal";
import ConfirmModal from "../../components/common/ConfirmModal";
import UpdateSalaryFormModal from "../../components/Form/UpdateSalaryFormModal";
import UserDeviceModal from "../../components/admin/UserDeviceModal";
import { IndianRupee } from "lucide-react";
import Cookies from "js-cookie";

interface Employee {
    id: string;
    name: string;
    email: string;
    role: string;
    mobile: string;
    isActive: boolean;
    joinDate: string;
    salary: {
        id?: string; // ✅ optional
        baseSalary: number;
    };
    isHourly: boolean;
    devices: string;
}

interface Salary {
    id: string;
    name: string;
    salary: number;
}

function Employee() {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const token = Cookies.get("access_token");
    if (!token) return null;

    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdateSalaryModalOpen, setUpdateSalaryModalOpen] = useState(false);
    const [isUserDeviceModalOpen, setUserDeviceModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [updateSalary, setUpdateSalary] = useState<Salary | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/users/employees`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!res.ok) throw new Error("Failed to fetch employees");

            const data: Employee[] = await res.json();
            const normalized = data.map(emp => ({
                ...emp,
                salary: {
                    baseSalary: Number(emp.salary?.baseSalary ?? emp.salary ?? 0),
                    id: emp.salary?.id,
                },
            }));

            setEmployees(normalized);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleAddEmployee = async (data: EmployeeFormData) => {
        try {
            const payload = {
                ...data,
                salary: {
                    baseSalary: data.salary || 0,
                },
            };

            const res = await fetch(`${API_URL}/users/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to add employee");

            setIsModalOpen(false);
            fetchEmployees();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEditEmployee = async (id: string, data: EmployeeFormData) => {
        try {
            const payload = {
                ...data,
                salary: {
                    baseSalary: data.salary || 0,
                },
            };

            const res = await fetch(`${API_URL}/users/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to update employee");

            setIsModalOpen(false);
            setEditingEmployee(null);
            fetchEmployees();
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateSalary = async (data: UpdateSalaryFormData) => {
        try {
            const res = await fetch(`${API_URL}/users/${data.id}/salary`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ newSalary: data.newSalary }),
            });

            if (!res.ok) throw new Error("Failed to update salary");

            setUpdateSalaryModalOpen(false);
            setUpdateSalary(null);
            fetchEmployees();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch(`${API_URL}/users/${deleteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to delete employee");

            setEmployees(employees.filter((emp) => emp.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error("Error deleting employee:", error);
        }
    };

    if (loading) return <div>Loading employees...</div>;
    if (error) return <div>Error: {error}</div>;

    const toggleHourly = (id: string, isHourly: boolean) => {
        fetch(`${API_URL}/users/${id}/salary-type`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isHourly }),
        })
            .then((res) => res.json())
            .then((data) => console.log(data))
            .catch((error) => console.error("Error updating hourly:", error));
        setEmployees((prev) =>
            prev.map((emp) =>
                emp.id === id ? { ...emp, isHourly } : emp
            )
        );
    };
    return (
        <div className="min-h-screen text-white p-3">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Employees</h1>

                <button
                    onClick={() => { setIsModalOpen(true); setEditingEmployee(null); }}
                    className="button-gradient"
                >
                    + Add Employee
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full md:w-1/3 bg-[#1c2a3f] border border-[#2e3b55] rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-green-400"
                />
            </div>

            {/* Employee Table */}
            <div className="bg-[#132033]/70 backdrop-blur-lg border border-[#2a3a55] rounded-2xl p-6 shadow-lg">
                <div className="grid grid-cols-8 text-gray-400 text-sm mb-4 px-2">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span>Mobile</span>
                    <span>Salary</span>
                    <span>Is Hourly</span>
                    <span>Active</span>
                    <span className="text-right">Actions</span>
                </div>

                <div className="space-y-3">
                    {employees
                        .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))
                        .map((emp) => (
                            <div
                                key={emp.id}
                                className="grid grid-cols-8 items-center bg-[#1a2a40] hover:bg-[#22314d] transition rounded-xl px-4 py-3"
                            >
                                <span className="font-medium">{emp.name}</span>
                                <span className="text-gray-300 truncate max-w-[200px] block pr-2">
                                    {emp.email}
                                </span>
                                <span className="text-gray-300">{emp.role}</span>
                                <span className="text-gray-300">{emp.mobile}</span>
                                <span className="text-gray-300">
                                    <IndianRupee className="inline-block mr-1" size={16} />
                                    {Number(emp.salary?.baseSalary) || 0}
                                </span>
                                <button
                                    onClick={() => toggleHourly(emp.id, !emp.isHourly)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${emp.isHourly
                                        ? "bg-gradient-to-r from-green-400 to-teal-400"
                                        : "bg-gray-600"
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${emp.isHourly ? "translate-x-6" : "translate-x-1"
                                            }`}
                                    />
                                </button>
                                <span>
                                    <span
                                        className={`px-2 py-1 rounded-full text-sm font-medium ${emp.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}
                                    >
                                        {emp.isActive ? "Active" : "Inactive"}
                                    </span>
                                </span>

                                <div className="flex justify-end gap-2">

                                    <button
                                        className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                        onClick={() => {
                                            setUpdateSalary({
                                                id: emp.id,
                                                name: emp.name,
                                                salary: emp.salary.baseSalary, // ✅ convert
                                            });
                                            setUpdateSalaryModalOpen(true);
                                        }}
                                    >
                                        Salary
                                    </button>
                                    <button
                                        className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                        onClick={() => {
                                            setEditingEmployee(emp); 
                                            setUserDeviceModalOpen(true);
                                        }}
                                    >
                                        Devices
                                    </button>
                                    <button
                                        className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                        onClick={() => { setEditingEmployee(emp); setIsModalOpen(true); }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(emp.id)}
                                        className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>

                {employees.length === 0 && (
                    <div className="text-center text-gray-400 py-10">No employees found</div>
                )}
            </div>

            {/* Modal */}
            <EmployeeFormModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEmployee(null); }}
                onAdd={handleAddEmployee}
                onEdit={handleEditEmployee}
                employee={
                    editingEmployee
                        ? {
                            id: editingEmployee.id,
                            name: editingEmployee.name,
                            email: editingEmployee.email,
                            role: editingEmployee.role,
                            mobile: editingEmployee.mobile,
                            isActive: editingEmployee.isActive,
                            isHourly: editingEmployee.isHourly,
                            salary: editingEmployee.salary.baseSalary, 
                            devices: editingEmployee.devices,
                            joinDate: editingEmployee.joinDate
                        }
                        : undefined
                }
            />

            {/* Update Salary Modal */}
            <UpdateSalaryFormModal
                isOpen={isUpdateSalaryModalOpen}
                onClose={() => { setUpdateSalaryModalOpen(false); setUpdateSalary(null); }}
                onUpdate={handleUpdateSalary}
                data={
                    updateSalary
                        ? {
                            employee: updateSalary.name,
                            name: updateSalary.name,
                            id: updateSalary.id,
                            currentSalary: updateSalary.salary,
                            salary: 0,
                        }
                        : undefined
                }
            />

            {/* User Device Modal */}
            <UserDeviceModal
                isOpen={isUserDeviceModalOpen}
                onClose={() => { setUserDeviceModalOpen(false); setEditingEmployee(null); }}
                employee={
                    editingEmployee
                        ? {
                            id: editingEmployee.id,
                            name: editingEmployee.name,
                        }
                        : undefined
                }
                devicesData={
                    editingEmployee
                        ? editingEmployee.devices
                        : undefined
                } 
            />

            {/* Confirm Delete */}
            <ConfirmModal
                isOpen={deleteId !== null}
                title="Delete Employee"
                message="Are you sure you want to delete this employee?"
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}

export default Employee;