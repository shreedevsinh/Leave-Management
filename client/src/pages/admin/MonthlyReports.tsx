import { useEffect, useState } from "react";
import { Calendar, Search, IndianRupee } from "lucide-react";

interface Payroll {
  id: string;
  month: number;
  year: number;
  totalDays: number;
  workingDays: number;
  leaveDays: number;
  payableDays: number;
  baseSalary: number;
  finalSalary: number;

  user: {
    name: string;
    email: string;
  };
}

export default function MonthlyReports() {
  const [data, setData] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [year, setYear] = useState<number>(
    new Date().getFullYear()
  );

  const [search, setSearch] = useState("");

  // 🧪 Dummy Data Generator (based on your schema)
  const generateDummyData = (): Payroll[] => {
    return [
      {
        id: "1",
        month,
        year,
        totalDays: 30,
        workingDays: 22,
        leaveDays: 2,
        payableDays: 20,
        baseSalary: 50000,
        finalSalary: 45454,
        user: {
          name: "Pragneysh Dekate",
          email: "pragneysh@company.com",
        },
      },
      {
        id: "2",
        month,
        year,
        totalDays: 30,
        workingDays: 22,
        leaveDays: 0,
        payableDays: 22,
        baseSalary: 60000,
        finalSalary: 60000,
        user: {
          name: "Amit Shah",
          email: "amit@company.com",
        },
      },
      {
        id: "3",
        month,
        year,
        totalDays: 30,
        workingDays: 22,
        leaveDays: 5,
        payableDays: 17,
        baseSalary: 45000,
        finalSalary: 34772,
        user: {
          name: "Neha Patel",
          email: "neha@company.com",
        },
      },
      {
        id: "4",
        month,
        year,
        totalDays: 30,
        workingDays: 22,
        leaveDays: 1,
        payableDays: 21,
        baseSalary: 70000,
        finalSalary: 66818,
        user: {
          name: "Rahul Mehta",
          email: "rahul@company.com",
        },
      },
    ];
  };

  // 🔥 Fetch (fallback to dummy)
  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);

        // 👉 Try API (commented for now)

        const res = await fetch(`http://localhost:3000/payroll?month=${month}&year=${year}`);
        const json = await res.json();


        // 👉 Fallback dummy data
        const dummy = generateDummyData();

        // simulate API delay
        setTimeout(() => {
          setData(dummy);
          setData(json);
          setLoading(false);
        }, 500);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }

    fetchReports();
  }, [month, year]);

  // 🔍 Filter
  const filtered = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // 📊 Summary
  const totalSalary = filtered.reduce(
    (sum, p) => sum + p.finalSalary,
    0
  );

  const totalEmployees = filtered.length;

  return (
    <div className="p-3 space-y-6 text-white">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          Monthly Reports
        </h1>

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-[#13263f] border border-white/10 px-3 py-2 rounded-xl"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i + 1}>
                {new Date(0, i).toLocaleString("default", {
                  month: "long",
                })}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 bg-[#13263f] border border-white/10 px-3 py-2 rounded-xl"
          />
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#13263f]/70 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Employees</p>
          <h2 className="text-xl font-semibold">
            {totalEmployees}
          </h2>
        </div>

        <div className="bg-[#13263f]/70 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Total Payout</p>
          <h2 className="text-xl font-semibold flex items-center gap-1">
            <IndianRupee size={16} />
            {totalSalary.toLocaleString()}
          </h2>
        </div>

        <div className="bg-[#13263f]/70 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
          <p className="text-sm text-gray-400">Month</p>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar size={16} />
            {month}/{year}
          </h2>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search
          className="absolute left-3 top-3 text-gray-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#13263f] border border-white/10"
        />
      </div>

      {/* TABLE */}
      <div className="bg-[#13263f]/70 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-300">
            <tr>
              <th className="text-left p-4">Employee</th>
              <th className="text-left p-4">Working Days</th>
              <th className="text-left p-4">Leaves</th>
              <th className="text-left p-4">Payable Days</th>
              <th className="text-left p-4">Base Salary</th>
              <th className="text-left p-4">Final Salary</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-6">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-6">
                  No data found
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  // key={p.id}
                  className="border-t border-white/5 hover:bg-white/5 transition"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-medium">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.email}
                      </p>
                    </div>
                  </td>

                  <td className="p-4">{p.workingDays}</td>
                  <td className="p-4 text-yellow-400">
                    {p.leaveCount}
                  </td>
                  <td className="p-4 text-green-400">
                    {p.totalDays}
                  </td>
                  <td className="p-4">
                    ₹{p.baseSalary}
                  </td>
                  <td className="p-4 font-semibold text-blue-400">
                    ₹{p.finalSalary}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}