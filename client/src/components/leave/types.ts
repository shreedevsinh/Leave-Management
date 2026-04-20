export type LeaveType = {
  id: number;
  name: string;
  maxPerYear: number;
  isPaid: boolean;
};

export type Leave = {
  date: string;
  employee: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string;
  endDate: string;
};
