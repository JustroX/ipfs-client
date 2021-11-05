import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FilesController } from './controllers/files/files.controller';
import { IpfsService } from './services/ipfs/ipfs.service';

@Module({
  imports: [],
  controllers: [AppController, FilesController],
  providers: [IpfsService],
})
export class AppModule {}
