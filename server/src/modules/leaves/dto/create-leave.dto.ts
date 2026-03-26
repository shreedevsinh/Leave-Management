export class CreateLeaveDto {
  userId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status?: string;
}
