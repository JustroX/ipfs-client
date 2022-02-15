import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class KeyBody {
  @IsNotEmpty()
  @IsString()
  pinata_api: string;

  @IsNotEmpty()
  @IsString()
  pinata_secret: string;
}
