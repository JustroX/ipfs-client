import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { fromBuffer } from 'file-type';
import core from 'file-type/core';
import { createWriteStream, existsSync, mkdirSync, promises as fs } from 'fs';

import { basename } from 'path';
import { Entry } from 'src/shared/entry.interface';
import { IPFSNode } from 'src/shared/ipfs-node';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Archiver } from '../bundler/archiver';
import { FileImportService } from '../file-import/file-import.service';
import { Pinata } from './pinata';
import { open, mkdir } from 'temp';

@Injectable()
export class IpfsService {
  constructor(private fileImportService: FileImportService) {}

  private getNode() {
    return IPFSNode.getNode();
  }

  async createDir(path: string) {
    try {
      const node = await this.getNode();
      await node.files.mkdir(path);
    } catch (err) {}
  }

  async uploadFile(
    directory: string,
    filename: string,
    data:
      | string
      | Buffer
      | Blob
      | AsyncIterable<Uint8Array>
      | Iterable<Uint8Array>,
  ) {
    const node = await this.getNode();
    let fullname =
      directory == '/' ? `/${filename}` : `${directory}/${filename}`;

    try {
      await node.files.stat(fullname, {});
      fullname += ' (1)';
    } catch (err) {}
    await node.files.write(fullname, data, {
      create: true,
      parents: true,
    });
    const { cid } = await node.files.stat(fullname);
    return cid.toString();
  }

  async getFiles(directory: string) {
    const node = await this.getNode();
    const results = node.files.ls(directory);
    const data: Entry[] = [];

    for await (const file of results) {
      const cid = file.cid.toString();
      const status_pin: Entry['status_pin'] = Pinata.getPinStatus(cid);
      data.push({
        name: file.name,
        type: file.type,
        size: file.size,
        cid: file.cid.toString(),
        status_pin,
        status_content: 'available',
      });
    }

    for (const file of this.fileImportService.getFilesInDirectory(directory)) {
      const isAlready = data.find((x) => x.cid == file.cid);
      if (isAlready) continue;
      data.push(file);
    }

    return data;
  }

  async copy(from: string, to: string) {
    const node = await this.getNode();
    await node.files.cp(from, to, { timeout: 60 * 1000 });
  }

  async move(from: string, to: string) {
    const node = await this.getNode();
    await node.files.mv(from, to);
  }

  async read(cid: string) {
    const node = await this.getNode();
    const stream = node.cat(cid);
    return Readable.from(stream);
  }

  async remove(path: string) {
    const node = await this.getNode();
    await node.files.rm(path, { recursive: true });
  }

  pinPinata(cid: string) {
    return Pinata.pin(cid);
  }

  async pinPinataDirect(cid: string) {
    const node = await this.getNode();
    const stream = node.cat(cid);
    return Pinata.pinBinaryByHash(cid, Readable.from(stream));
  }

  unpinPinata(cid: string) {
    return Pinata.unpin(cid);
  }

  async download(cid: string, dest: string) {
    const node = await this.getNode();
    const stream = node.cat(cid);
    const output = await createWriteStream(dest);
    await pipeline(Readable.from(stream), output);
  }

  importFile(cid: string, directory: string, name: string) {
    this.fileImportService.addImport(cid, directory, name);
  }

  cancelImportFile(cid: string, directory: string) {
    this.fileImportService.cancel(cid, directory);
  }

  async isEncrypted(cid: string) {
    const type = await this.getFileType(cid);
    if (type?.ext != 'zip') return false;

    const temp = await open();
    const source = temp.path;
    await this.download(cid, source);

    try {
      const tmp_root = await mkdir();
      const unbundle_root = `${tmp_root}/unbundle-${Date.now()}`;
      await fs.mkdir(unbundle_root, { recursive: true });

      // File transfer
      const source_name = basename(source);
      const bundle = `${unbundle_root}/${source_name}`;
      await fs.copyFile(source, bundle);

      // Unzip bundle
      await Archiver.unzip(bundle, unbundle_root);
      await fs.rm(bundle, { recursive: true });

      // Read IV
      await fs.readFile(`${unbundle_root}/content/iv.dat`);
      (await fs.readFile(`${unbundle_root}/content/type.dat`, 'utf-8')) as
        | 'file'
        | 'folder';
      return true;
    } catch (err) {
      return false;
    }
  }

  async getFileType(cid: string): Promise<core.FileTypeResult | null> {
    const node = await this.getNode();
    const stream = node.cat(cid, {
      offset: 0,
      length: 100,
    });
    try {
      const chunks: number[] = [];
      for await (const chunk of stream) {
        chunks.push(...chunk.values());
      }
      const details = await fromBuffer(Uint8Array.from(chunks));
      if (!details) return null;
      return details;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}
