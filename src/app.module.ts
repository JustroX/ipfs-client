import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FilesController } from './controllers/files/files.controller';
import { IpfsService } from './services/ipfs/ipfs.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { BundlerService } from './services/bundler/bundler.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { KeysController } from './controllers/keys/keys.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static/ipfs-client-ui'),
      exclude: ['/api'],
    }),

    MulterModule.register({
      dest: './upload',
      storage: diskStorage({
        filename: function (req, file, callback) {
          callback(null, file.originalname);
        },
      }),
    }),
  ],
  controllers: [AppController, FilesController, KeysController],
  providers: [IpfsService, BundlerService],
})
export class AppModule {}
