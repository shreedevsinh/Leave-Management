export class UpdateUserDto {
  name?: string;
  email?: string | undefined;
  mobile?: string | undefined;
  password?: string;
  role?: undefined;
  isActive?: boolean;
  joinDate?: string;
}
