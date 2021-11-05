import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IpfsService } from 'src/services/ipfs/ipfs.service';
import { DirectoryBody } from './validation/mkdir.validator';
import { TransferBody } from './validation/transfer.validator';

@Controller('files')
export class FilesController {
  constructor(private readonly ipfs: IpfsService) {}

  @Post('directory')
  async createDir(@Body() body: DirectoryBody) {
    await this.ipfs.createDir(body.directory);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: DirectoryBody,
  ) {
    if (!file) throw new HttpException('No file attached', 409);
    const cid = await this.ipfs.uploadFile(
      body.directory,
      file.originalname,
      file.buffer,
    );
    return cid;
  }

  @Post('list')
  async getFiles(@Body() body: DirectoryBody) {
    const files = await this.ipfs.getFiles(body.directory);
    return files;
  }

  @Post('copy')
  async copy(@Body() body: TransferBody) {
    const { from, to } = body;
    await this.ipfs.copy(from, to);
  }

  @Post('move')
  async move(@Body() body: TransferBody) {
    const { from, to } = body;
    await this.ipfs.move(from, to);
  }

  @Post('remove')
  async remove(@Body() body: DirectoryBody) {
    await this.ipfs.remove(body.directory);
  }

  @Get(':cid')
  async file(@Param('cid') cid: string) {
    const stream = await this.ipfs.read(cid);
    return new StreamableFile(stream);
  }
}
