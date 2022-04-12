import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { fromFile } from 'file-type';
import { createWriteStream, promises as fs } from 'fs';
import * as IPFS from 'ipfs-core';
import { basename } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Archiver } from '../bundler/archiver';
import { Pinata } from './pinata';

export interface Entry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  cid: string;
  is_pinned_pinata: boolean;
  is_pinned_pinata_queued: boolean;
  is_loading: boolean;
}

const nodeSource = IPFS.create({
  repo: `${process.cwd()}/ipfs-repo`,
  silent: true,
});

nodeSource.then((node) => {
  // node.pin.remote.service.add('pinata', {
  //   endpoint: new URL('https://api.pinata.cloud'),
  //   key: process.env.PINATA_API_KEY,
  // });
});

nodeSource.catch((err) => {
  console.error(err);
});

@Injectable()
export class IpfsService {
  private loading_files: {
    cid: string;
    directory: string;
    promise: Promise<void>;
  }[] = [];

  private async getNode() {
    return await nodeSource;
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
    const fullname =
      directory == '/' ? `/${filename}` : `${directory}/${filename}`;
    await node.files.write(fullname, data, {
      create: true,
      parents: true,
      filename: filename,
    });
    const { cid } = await node.files.stat(fullname);
    return cid.toString();
  }

  async getFiles(directory: string) {
    const node = await this.getNode();
    const results = node.files.ls(directory);
    const data: Entry[] = [];

    const pinned = await Pinata.getpins();
    const queue = await Pinata.getQueue();
    for await (const file of results) {
      // check if remotely pinned

      const cid = file.cid.toString();
      let is_pinned_pinata = pinned.includes(cid);
      let is_pinned_pinata_queued = queue.includes(cid);

      data.push({
        name: file.name,
        type: file.type,
        size: file.size,
        cid: file.cid.toString(),
        is_pinned_pinata,
        is_pinned_pinata_queued,
        is_loading: !!this.loading_files.find((x) => x.cid == cid),
      });
    }

    for (const file of this.loading_files) {
      if (directory != file.directory) continue;
      const isAlready = data.find((x) => x.cid == file.cid);
      if (isAlready) continue;
      data.push({
        name: 'Importing...',
        type: 'file',
        size: NaN,
        cid: file.cid,
        is_pinned_pinata: false,
        is_pinned_pinata_queued: false,
        is_loading: true,
      });
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

  async pin(cid: string) {
    throw new InternalServerErrorException('Not yet implemented.');
    // const node = await this.getNode();
    // await node.pin.add(CID.parse(cid));
  }

  async unpin(cid: string) {
    throw new InternalServerErrorException('Not yet implemented.');
    // const node = await this.getNode();
    // await node.pin.rm(CID.parse(cid));
  }

  pinPinata(cid: string) {
    return Pinata.pin(cid);
  }

  async pinPinataDirect(cid: string) {
    const node = await this.getNode();
    const stream = node.cat(cid);
    const readable = Readable.from(stream);
    return Pinata.pinBinaryByHash(readable);
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

  importFile(cid: string, directory: string) {
    const p = (async () => {
      const node = await this.getNode();
      console.log(`File ${cid}: Importing`);
      const stream = node.cat(cid);
      await this.uploadFile(directory, cid, stream);
    })();

    const state = {
      cid,
      promise: p,
      directory,
    };

    // check if file is encrypted
    p.then(() => {
      console.log(`File ${cid}: File import success.`);

      this.loading_files = this.loading_files.filter((x) => x.cid != cid);
    }).catch((err) => {
      console.error('Failed to import', err);
      this.loading_files = this.loading_files.filter((x) => x.cid != cid);
    });

    this.loading_files.push(state);
  }

  async isEncrypted(cid: string) {
    const source = `${process.cwd()}/tmp/unbundled-${Date.now()}-test`;
    await this.download(cid, source);

    const { ext } = await fromFile(source);
    if (ext != 'zip') return false;

    try {
      const tmp_root = `${process.cwd()}/tmp`;
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
}
