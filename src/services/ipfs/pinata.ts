import pinata, { PinataClient } from '@pinata/sdk';
import { Readable } from 'stream';
import Cache from 'node-cache';
import { Entry } from 'src/shared/entry.interface';
import Bottleneck from 'bottleneck';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { open } from 'temp';

export class Pinata {
  private static sdk?: PinataClient;

  private static cache: Cache = new Cache();
  private static limiter = new Bottleneck({
    minTime: 667,
    maxConcurrent: 1,
    reservoir: 180,
    reservoirRefreshAmount: 180,
    reservoirRefreshInterval: 60 * 1000,
    highWater: 900,
  });

  static async getSDK(): Promise<PinataClient> {
    if (!this.sdk) {
      this.sdk = pinata(
        process.env.PINATA_API_KEY,
        process.env.PINATA_SECRET_KEY,
      );
      setInterval(() => {
        this.schedule(this.refreshPinnedList());
        this.schedule(this.refreshQueuedList());
      }, 5000);
    }
    return this.sdk;
  }

  private static async schedule(p: Promise<any>) {
    try {
      await this.limiter.schedule(() => p);
    } catch (err) {
      console.error(err);
    }
  }

  private static async refreshPinStatus(cid: string) {
    const sdk = await this.getSDK();
    const pinJob = await sdk
      .pinJobs({
        ipfs_pin_hash: cid,
        sort: 'ASC',
      })
      .then((x) => x.rows[0]);
    if (pinJob) {
      const queued_status = ['prechecking', 'searching', 'retrieving'];
      const isQueued = queued_status.includes(pinJob.status);
      if (isQueued) {
        this.cache.set(cid, 'queued');
        console.log('PIN STATUS ', cid, 'queued');
        return;
      }
    }

    const pinList = await sdk
      .pinList({
        hashContains: cid,
        status: 'pinned',
      })
      .then((x) => x.rows.find((x) => x.ipfs_pin_hash == cid));

    if (pinList) {
      this.cache.set(cid, 'pinned');
      console.log('PIN STATUS ', cid, 'Pinned');
    } else {
      this.cache.set(cid, 'unpinned');
      console.log('PIN STATUS ', cid, 'Unpinned');
    }
  }

  private static async refreshQueuedList() {
    const sdk = await this.getSDK();
    const in_queue = await sdk
      .pinJobs({
        sort: 'ASC',
      })
      .then((x) =>
        x.rows
          .filter(
            (y) =>
              y.status == 'searching' ||
              y.status == 'prechecking' ||
              y.status == 'retrieving',
          )
          .map((y) => y.ipfs_pin_hash),
      );

    this.cache.mset(
      in_queue.map((x) => ({
        key: x,
        val: 'queued',
        ttl: 60 * 1000, // one minute pinning
      })),
    );
  }

  private static async refreshPinnedList() {
    const sdk = await this.getSDK();
    const in_pinned = await sdk
      .pinList({ status: 'pinned' })
      .then((x) => x.rows.map((x) => x.ipfs_pin_hash));

    this.cache.mset(
      in_pinned.map((cid) => ({
        key: cid,
        val: 'pinned',
      })),
    );
  }

  static getPinStatus(cid: string): Entry['status_pin'] {
    const value = this.cache.get<Entry['status_pin']>(cid);
    if (!value) {
      this.schedule(this.refreshPinStatus(cid));
      return 'unpinned';
    }
    return value;
  }

  static async pin(cid: string) {
    const status = this.getPinStatus(cid);
    if (status == 'unpinned') this.cache.set(cid, 'queued');

    const sdk = await this.getSDK();
    return sdk.pinByHash(cid).then((file) => {
      this.schedule(this.refreshPinStatus(cid));
      return file;
    });
  }

  static async pinBinaryByHash(cid: string, file: Readable) {
    this.safePin(cid, file);
  }

  private static async safePin(cid: string, file: Readable) {
    const status = this.getPinStatus(cid);
    if (status == 'unpinned') this.cache.set(cid, 'queued');
    const temp = await open();
    const output = createWriteStream(temp.path);
    try {
      await pipeline(file, output);
      const f = await this.sdk.pinFileToIPFS(createReadStream(temp.path));
      if (f.IpfsHash != cid) await this.pin(cid);
      else {
        this.schedule(this.refreshPinStatus(cid));
        console.log(`PIN STATUS ${cid} Sent to pinata`);
      }
    } catch (err) {
      if (status == 'unpinned') this.cache.set(cid, 'unpinned');
      console.error(err);
    }
  }

  static async unpin(cid: string) {
    const sdk = await this.getSDK();
    this.cache.set(cid, 'queued');
    sdk
      .unpin(cid)
      .then(() => {
        this.schedule(this.refreshPinStatus(cid));
      })
      .catch((err) => {
        console.error(err);
        this.schedule(this.refreshPinStatus(cid));
      });
  }
}
