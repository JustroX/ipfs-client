import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { KeyBody } from './validation/keys.validator';
import { writeFile } from 'fs/promises';

@Controller('keys')
export class KeysController {
  @Get()
  isSet() {
    return {
      is_missing: !process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY,
    };
  }

  @Post()
  async setKeys(@Body() keys: KeyBody) {
    const is_set = this.isSet();
    if (is_set) throw new ConflictException('Pinata keys are already set.');

    process.env.PINATA_API_KEY = keys.pinata_api;
    process.env.PINATA_SECRET_KEY = keys.pinata_secret;

    const file = `PINATA_API_KEY=${keys.pinata_api}\nPINATA_SECRET_KEY=${keys.pinata_secret}`;
    await writeFile(process.cwd() + '/.env', file);
  }
}
