import { Type } from 'class-transformer';
import { IsDefined, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: "body can't be blank" })
  @MaxLength(5000)
  body!: string;
}

export class CreateCommentBodyDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCommentDto)
  comment!: CreateCommentDto;
}
