import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDumpDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
