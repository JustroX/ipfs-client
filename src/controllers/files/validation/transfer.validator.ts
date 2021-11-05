import { IsNotEmpty, IsString } from 'class-validator';

export class TransferBody {
  @IsNotEmpty()
  @IsString()
  from: string;

  @IsNotEmpty()
  @IsString()
  to: string;
}
