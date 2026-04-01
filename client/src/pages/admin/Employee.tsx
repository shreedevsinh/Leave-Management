import { useState, useEffect } from "react";
import EmployeeFormModal from "../../components/Form/EmployeeFormModal";
import ConfirmModal from "../../components/common/ConfirmModal";

interface Employee {
    id: number;
    name: string;
    email: string;
    role: string;
    mobile: string;
    isActive: boolean;
    joinDate: string;
}

function Employee() {
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await fetch("https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/users/employees");
            if (!res.ok) throw new Error("Failed to fetch employees");

            const data: Employee[] = await res.json();
            setEmployees(data);
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

    const handleAddEmployee = async (newEmp: Partial<Employee>) => {
        try {
            const res = await fetch("https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/users/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEmp),
            });

            if (!res.ok) throw new Error("Failed to add employee");

            setIsModalOpen(false);
            setEditingEmployee(null);
            fetchEmployees();
        } catch (error) {
            console.error("Error adding employee:", error);
        }
    };

    const handleEditEmployee = async (id: number, updatedEmp: Partial<Employee>) => {
        try {
            const res = await fetch(`https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedEmp),
            });

            if (!res.ok) throw new Error("Failed to update employee");

            setIsModalOpen(false);
            setEditingEmployee(null);
            fetchEmployees();
        } catch (error) {
            console.error("Error updating employee:", error);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch(`https://6hyatgyy2k.execute-api.ap-south-1.amazonaws.com/users/${deleteId}`, {
                method: "DELETE",
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
                <div className="grid grid-cols-6 text-gray-400 text-sm mb-4 px-2">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span>Mobile</span>
                    <span>Active</span>
                    <span className="text-right">Actions</span>
                </div>

                <div className="space-y-3">
                    {employees
                        .filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()))
                        .map((emp) => (
                            <div
                                key={emp.id}
                                className="grid grid-cols-6 items-center bg-[#1a2a40] hover:bg-[#22314d] transition rounded-xl px-4 py-3"
                            >
                                <span className="font-medium">{emp.name}</span>
                                <span className="text-gray-300">{emp.email}</span>
                                <span className="text-gray-300">{emp.role}</span>
                                <span className="text-gray-300">{emp.mobile}</span>
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
                employee={editingEmployee || undefined}
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