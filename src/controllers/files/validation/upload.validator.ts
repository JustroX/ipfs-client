import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UploadBody {
  @IsNotEmpty()
  @IsString()
  directory: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(12)
  passphrase: string;
}
