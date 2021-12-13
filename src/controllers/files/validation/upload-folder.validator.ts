import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UploadFolderBody {
  @IsNotEmpty()
  @IsString()
  directory: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(12)
  passphrase: string;

  willSaveKey?: boolean;
}
