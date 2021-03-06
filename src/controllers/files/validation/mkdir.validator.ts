import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DirectoryBody {
  @IsNotEmpty()
  @IsString()
  directory: string;

  @IsOptional()
  name?: string;
}
