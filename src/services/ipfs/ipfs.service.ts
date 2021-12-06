import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import * as IPFS from 'ipfs-core';
import { CID } from 'ipfs-core';
import { pipeline, Readable, Stream } from 'stream';
import { Pinata } from './pinata';

export interface Entry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  cid: string;
  is_pinned: boolean;
  is_pinned_pinata: boolean;
}

const nodeSource = IPFS.create({
  repo: `${process.cwd()}/ipfs-repo`,
});

nodeSource.then((node) => {
  node.pin.remote.service.add('pinata', {
    endpoint: new URL('https://api.pinata.cloud'),
    key: process.env.PINATA_API_KEY,
  });
});

nodeSource.catch((err) => {
  console.error(err);
});

@Injectable()
export class IpfsService {
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
    const fullname = `${directory}/${filename}`;
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

    for await (const file of results) {
      // check if locally pinned
      let is_pinned = false;
      const pins = await node.pin.ls({
        paths: [file.cid],
      });
      for await (const pin of pins) {
        if (pin.cid.equals(file.cid)) {
          is_pinned = true;
          break;
        }
      }

      // check if remotely pinned
      let is_pinned_pinata = false;
      const pinata_pins = await node.pin.remote.ls({
        service: 'pinata',
        cid: [file.cid],
      });
      for await (const pin of pinata_pins) {
        if (pin.cid.equals(file.cid) && pin.status == 'pinned') {
          is_pinned = true;
          break;
        }
      }

      data.push({
        name: file.name,
        type: file.type,
        size: file.size,
        cid: file.cid.toString(),
        is_pinned,
        is_pinned_pinata,
      });
    }
    return data;
  }

  async copy(from: string, to: string) {
    const node = await this.getNode();
    await node.files.cp(from, to);
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
    const node = await this.getNode();
    await node.pin.add(CID.parse(cid));
  }

  async unpin(cid: string) {
    const node = await this.getNode();
    await node.pin.rm(CID.parse(cid));
  }

  pinPinata(cid: string) {
    return Pinata.pin(cid);
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
}
