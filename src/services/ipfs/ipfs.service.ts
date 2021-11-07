import { Injectable } from '@nestjs/common';
import * as IPFS from 'ipfs-core';
import { Readable } from 'stream';

export interface Entry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  cid: string;
}

const nodeSource = IPFS.create({
  repo: `${process.cwd()}/ipfs-repo`,
});

@Injectable()
export class IpfsService {
  private async getNode() {
    return await nodeSource;
  }

  async createDir(path: string) {
    const node = await this.getNode();
    await node.files.mkdir(path);
  }

  async uploadFile(directory: string, filename: string, data: string | Buffer) {
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
      data.push({
        name: file.name,
        type: file.type,
        size: file.size,
        cid: file.cid.toString(),
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
}
