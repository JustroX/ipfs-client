import pinata from '@pinata/sdk';
import { config } from 'dotenv';

config();

export class Pinata {
  private static sdk = pinata(
    process.env.PINATA_API_KEY,
    process.env.PINATA_SECRET_KEY,
  );

  static pin(cid: string) {
    return this.sdk.pinByHash(cid);
  }

  static unpin(cid: string) {
    return this.sdk.unpin(cid);
  }

  static getpins() {
    return this.sdk.pinList().then((x) => x.rows.map((y) => y.ipfs_pin_hash));
  }

  static getQueue() {
    return this.sdk
      .pinJobs({
        sort: 'ASC',
        status: 'searching',
      })
      .then((x) => x.rows.map((y) => y.ipfs_pin_hash));
  }
}
