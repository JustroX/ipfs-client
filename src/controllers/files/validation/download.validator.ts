import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DownloadBody {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(12)
  passphrase: string;
}
