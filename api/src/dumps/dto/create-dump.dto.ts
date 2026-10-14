import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDumpDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
