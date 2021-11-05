import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  get(): string {
    return 'Welcome to IPFS client';
  }
}
