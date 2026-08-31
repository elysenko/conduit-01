import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "username can't be blank" })
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsEmail({ require_tld: false }, { message: 'email is invalid' })
  @MaxLength(254)
  email?: string;

  // Absent => the stored hash is left byte-identical. Never re-hash a blank string.
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "password can't be blank" })
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;
}

export class UpdateUserBodyDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  user!: UpdateUserDto;
}
