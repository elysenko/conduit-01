import { Type } from 'class-transformer';
import { IsDefined, IsEmail, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1, { message: "username can't be blank" })
  @MaxLength(64)
  username!: string;

  // require_tld:false is NOT optional styling: the seeded demo author is
  // `jake@demo`, which the default @IsEmail() rejects with a 400.
  @IsEmail({ require_tld: false }, { message: 'email is invalid' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1, { message: "password can't be blank" })
  @MaxLength(200)
  password!: string;
}

/** RealWorld envelopes the payload: `{ "user": { ... } }`. */
export class RegisterBodyDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterDto)
  user!: RegisterDto;
}
