import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { IPFSNode } from './shared/ipfs-node';

@Controller()
export class AppController {
  @Get()
  get(@Res() res: Response) {
    res.redirect('/index.html');
  }

  @Get('/api/peers')
  getPeers() {
    return IPFSNode.peers;
  }
}
