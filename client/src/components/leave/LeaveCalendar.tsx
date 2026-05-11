import LeaveDayCell from "./LeaveDayCell";
import type { Leave } from "./leave";

type Props = {
    daysArray: (number | null)[];
    formatDate: (day: number) => string;
    getLeaves: (date: string) => Leave[];
    today: Date;
    currentMonth: number;
    currentYear: number;
    selectedDate: string | null;
    setSelectedDate: (date: string) => void;
    holidays: any[];
    onDeleteHoliday: (holidayId: string) => void;
};

export default function LeaveCalendar(props: Props) {
    
    return (
        <div className="bg-[#13263f] rounded-2xl p-4 border border-white/10">
            <div className="grid grid-cols-7 text-sm text-gray-400 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center py-2">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {props.daysArray.map((day, idx) => (
                    <LeaveDayCell key={idx} day={day} {...props} />
                ))}
            </div>
        </div>
    );
}