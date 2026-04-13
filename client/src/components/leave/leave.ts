export type Leave = {
  date: string;
  employee: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string;
  endDate: string;
  type: string;
};
