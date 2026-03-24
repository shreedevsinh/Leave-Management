export class CreateLeaveDto {
  userId: number;
  typeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}
