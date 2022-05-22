import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { Entry } from 'src/shared/entry.interface';
import { IPFSNode } from 'src/shared/ipfs-node';
import { Readable } from 'stream';

class FileImport {
  private status: Entry['status_content'] = 'searching';
  private size: number = 0;
  private abort: AbortController;
  private started = 0;
  isDone = false;

  constructor(
    public name: string,
    public cid: string,
    public directory: string,
  ) {}

  isGarbage() {
    const time = moment.now();
    const duration = moment.unix(this.started).diff(time, 'minute');
    return this.status == 'available' && duration >= 5;
  }

  start() {
    this.isDone = false;
    this.abort = new AbortController();
    this.started = moment.now();
    this.run();
  }

  cancel() {
    if (this.status == 'failed' || this.status == 'timeout') return;
    this.abort.abort();
  }

  private async run() {
    try {
      await this.searchFile();
      await this.downloadFile();
      this.status = 'available';
      this.isDone = true;
    } catch (err: any) {
      if (err.name == 'TimeoutError' && err.code == 'ERR_TIMEOUT') {
        this.status = 'timeout';
        console.warn(`FILE IMPORT: TIMEOUT ${this.cid}`);
      } else {
        this.status = 'failed';
        if (err.name == 'AbortError')
          console.warn(`FILE IMPORT: ABORTED ${this.cid}`);
        else {
          console.warn(`FILE IMPORT: FAILED ${this.cid}`);
          console.error(err);
        }
      }
    }
  }

  private async searchFile() {
    // 5 minutes timeout
    this.status = 'searching';
    const timeout = 1 * 60 * 1000;
    const node = await IPFSNode.getNode();

    const stream = node.cat(this.cid, {
      length: 100,
    });
    await node.add(stream, {
      timeout,
      signal: this.abort.signal,
    });
  }

  private async downloadFile() {
    this.status = 'downloading';

    const node = await IPFSNode.getNode();
    const full_filename =
      this.directory == '/'
        ? `/${this.name}`
        : `${this.directory}/${this.name}`;

    const stream = Readable.from(
      node.files.read(`/ipfs/${this.cid}`, {
        signal: this.abort.signal,
      }),
    );

    await node.add(stream, {
      chunker: 'size-262144',
      signal: this.abort.signal,
      // create: true,
    });
    // await node.files.write(full_filename, stream, {
    //   signal: this.abort.signal,
    //   create: true,
    // });
    await node.files.cp(`/ipfs/${this.cid}`, full_filename, {
      signal: this.abort.signal,
    });

    const { size } = await node.files.stat(`/ipfs/${this.cid}`, {
      size: true,
      signal: this.abort.signal,
    });
    this.size = size;
  }

  getEntry(): Entry {
    return {
      name: this.name,
      cid: this.cid,
      type: 'file',
      status_content: this.status,
      size: this.size,
      status_pin: 'unpinned',
    };
  }
}

@Injectable()
export class FileImportService {
  queue: FileImport[] = [];

  constructor() {
    //   Garbage collect every minute
    setInterval(() => {
      this.garbage_collect();
    }, 60 * 1000);
  }

  private garbage_collect() {
    this.queue = this.queue.filter((x) => !x.isGarbage());
  }

  getFilesInDirectory(directory: string) {
    return this.queue
      .filter((x) => x.directory == directory)
      .map((x) => x.getEntry());
  }

  addImport(cid: string, directory: string, name: string) {
    let file = this.queue.find((x) => x.directory == directory && x.cid == cid);

    if (!file) {
      file = new FileImport(name, cid, directory);
      this.queue.push(file);
    } else file.name = name;

    file.start();
  }

  cancel(directory: string, cid: string) {
    const files = this.queue.filter(
      (x) => x.directory == directory && x.cid == cid,
    );
    files.forEach((file) => {
      file.cancel();
    });
  }
}
