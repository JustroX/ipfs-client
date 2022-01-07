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
    return this.sdk.pinList().then((x) =>
      x.rows
        .filter((x) => {
          if (!x.date_unpinned) return true;
          const date = new Date(x.date_unpinned);
          const now = new Date();
          return now < date;
        })
        .map((y) => y.ipfs_pin_hash),
    );
  }

  static getQueue() {
    return this.sdk
      .pinJobs({
        sort: 'ASC',
      })
      .then((x) =>
        x.rows
          .filter((y) => y.status == 'searching')
          .map((y) => y.ipfs_pin_hash),
      );
  }
}
