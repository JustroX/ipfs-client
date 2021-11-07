import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CIDBody {
  @IsNotEmpty()
  @IsString()
  @Length(46)
  cid: string;
}
