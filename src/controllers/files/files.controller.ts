import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Logger,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { copy } from 'fs-extra';
import moment from 'moment';
import { basename } from 'path/posix';
import { BundlerService } from 'src/services/bundler/bundler.service';
import { IpfsService } from 'src/services/ipfs/ipfs.service';
import { DownloadBody } from './validation/download.validator';
import { DirectoryBody } from './validation/mkdir.validator';
import { CIDBody } from './validation/param.validator';
import { TransferBody } from './validation/transfer.validator';
import { UploadFolderBody } from './validation/upload-folder.validator';
import { UploadBody } from './validation/upload.validator';

@Controller('/api/files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly ipfs: IpfsService,
    private readonly bundler: BundlerService,
  ) {}

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
    const start = moment();
    this.logger.log('Upload started');
    const cid = await this.ipfs.uploadFile(
      body.directory,
      file.originalname,
      createReadStream(file.path),
    );
    this.logger.log(`Upload time ${moment().diff(start, 'milliseconds')} ms`);

    return { cid };
  }

  @Put('list')
  async getFiles(@Body() body: DirectoryBody) {
    const files = await this.ipfs.getFiles(body.directory);
    return files;
  }

  @Put('copy')
  async copy(@Body() body: TransferBody) {
    const { from, to } = body;
    await this.ipfs.copy(from, to);
  }

  @Put('import/:cid')
  import(
    @Param('cid') cid: string,
    @Body() { directory, name }: DirectoryBody,
  ) {
    return this.ipfs.importFile(cid.trim(), directory, name ?? cid.trim());
  }

  @Delete('import/:cid')
  importCancel(
    @Param('cid') cid: string,
    @Body() { directory }: DirectoryBody,
  ) {
    return this.ipfs.cancelImportFile(cid.trim(), directory);
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
  async file(@Param() body: CIDBody, @Res({ passthrough: true }) res) {
    this.logger.log('Download started');

    try {
      const fileType = await this.ipfs.getFileType(body.cid);
      if (fileType) {
        const { ext } = fileType;
        res.set({
          'Content-Type': 'application/octet-stream/json',
          'Content-Disposition': `attachment; filename="${body.cid}.${ext}"`,
          'File-Name': `${body.cid}.${ext}`,
        });
      }
    } catch (err) {
      console.error(err);
    }

    const stream = await this.ipfs.read(body.cid);
    return new StreamableFile(stream);
  }

  @Put('pin/pinata/:cid')
  async pinPinata(@Param() body: CIDBody) {
    await this.ipfs.pinPinataDirect(body.cid);
  }

  @Delete('pin/pinata/:cid')
  async unpinPinata(@Param() body: CIDBody) {
    await this.ipfs.unpinPinata(body.cid);
  }

  @Post('bundle/upload/file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBundleFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBody,
  ) {
    if (!file) throw new HttpException('No file attached', 409);

    const bundledFile = `${process.cwd()}/tmp/bundle.zip`;
    await this.bundler.bundle('file', file.path, bundledFile, body.passphrase);

    const filename = `${file.originalname}.encrypted`;
    const file_buffer = createReadStream(bundledFile);
    const cid = await this.ipfs.uploadFile(
      body.directory,
      filename,
      file_buffer,
    );

    // if (body.willSaveKey) await Keystore.setKey(cid, body.passphrase);

    return { cid };
  }

  @Post('bundle/upload/folder')
  @UseInterceptors(FileInterceptor('files'))
  async uploadBundleFolder(
    @UploadedFile() files: Express.Multer.File[],
    @Body() body: UploadFolderBody,
  ) {
    if (!files) throw new HttpException('No files attached', 409);
    if (!files.length) throw new HttpException('No files attached', 409);

    const bundle_root = `${process.cwd()}/tmp/bundle-${Date.now()}`;
    const data_folder = `${bundle_root}/${body.name}`;
    await fs.mkdir(data_folder);

    // copy file to directory
    for (const file of files) {
      const filename = file.originalname;
      await copy(file.path, `${data_folder}/${filename}`);
    }

    const bundledFile = `${process.cwd()}/tmp/bundle.zip`;
    await this.bundler.bundle(
      'folder',
      data_folder,
      bundledFile,
      body.passphrase,
    );
    await fs.rm(bundle_root, { recursive: true });

    const filename = `${body.name}.encrypted`;
    const file_buffer = createReadStream(bundledFile);
    const cid = await this.ipfs.uploadFile(
      body.directory,
      filename,
      file_buffer,
    );
    // if (body.willSaveKey) await Keystore.setKey(cid, body.passphrase);
    return { cid };
  }

  @Post('bundle/:cid')
  async download(
    @Body() body: DownloadBody,
    @Param() param: CIDBody,
    @Res({ passthrough: true }) res,
  ) {
    // Remove filename and `encrypted` extension
    const chunks = basename(body.filename).split('.');
    if (chunks[chunks.length - 1] == 'encrypted') chunks.pop();
    const filename = chunks.join('.');

    const unbundled_file = `${process.cwd()}/tmp/unbundled-${Date.now()}-${filename}`;
    await this.ipfs.download(param.cid, unbundled_file);

    // const saved_passphrase = await Keystore.getKey(param.cid);
    const passphrase = body.passphrase;

    const output_path = `${process.cwd()}/tmp/`;
    const download_name = await this.bundler.unbundle(
      unbundled_file,
      output_path,
      passphrase,
    );

    await fs.rm(unbundled_file, { recursive: true });
    res.set({
      'Content-Type': 'application/octet-stream/json',
      'Content-Disposition': `attachment; filename="${download_name}"`,
      'File-Name': download_name,
    });
    return new StreamableFile(
      createReadStream(`${output_path}${download_name}`),
    );
  }

  @Get('/encrypted/:cid')
  async isEncrypted(@Param() param: CIDBody) {
    const is_encrypted = await this.ipfs.isEncrypted(param.cid);
    return { is_encrypted };
  }
}
