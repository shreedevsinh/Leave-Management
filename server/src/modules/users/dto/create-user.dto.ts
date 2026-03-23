export class CreateUserDto {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: undefined;
  isActive: boolean;
  joinDate: string;
}
