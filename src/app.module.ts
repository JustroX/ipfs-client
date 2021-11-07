import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FilesController } from './controllers/files/files.controller';
import { IpfsService } from './services/ipfs/ipfs.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..', 'static/ipfs-client-ui'),
      exclude: ['/api'],
    }),
  ],
  controllers: [AppController, FilesController],
  providers: [IpfsService],
})
export class AppModule {}
