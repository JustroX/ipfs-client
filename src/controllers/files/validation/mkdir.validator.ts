import { IsNotEmpty, IsString } from 'class-validator';

export class DirectoryBody {
  @IsNotEmpty()
  @IsString()
  directory: string;
}
