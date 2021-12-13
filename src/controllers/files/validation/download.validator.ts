import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class DownloadBody {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  passphrase?: string;
}
