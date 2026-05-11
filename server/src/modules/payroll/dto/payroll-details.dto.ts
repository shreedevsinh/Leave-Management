export class DayRecordDto {
  date!: string;
  day!: string;
  checkIn!: string | null;
  checkOut!: string | null;
  hours!: string | null;
  status!: string;
}

export class PayrollDetailsResponseDto {
  presentDays!: number;
  halfDays!: number;
  missingCheckout!: number;
  leaves!: number;
  totalDays!: number;
  days!: DayRecordDto[];
}
