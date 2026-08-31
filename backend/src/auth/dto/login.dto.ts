import { Type } from 'class-transformer';
import { IsDefined, IsEmail, IsString, MinLength, ValidateNested } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false }, { message: 'email is invalid' })
  email!: string;

  @IsString()
  @MinLength(1, { message: "password can't be blank" })
  password!: string;
}

export class LoginBodyDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginDto)
  user!: LoginDto;
}
