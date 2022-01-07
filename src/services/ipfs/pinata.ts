import pinata, { PinataClient } from '@pinata/sdk';

export class Pinata {
  private static sdk?: PinataClient;

  static async getSDK(): Promise<PinataClient> {
    if (!this.sdk)
      this.sdk = pinata(
        process.env.PINATA_API_KEY,
        process.env.PINATA_SECRET_KEY,
      );
    return this.sdk;
  }

  static async pin(cid: string) {
    const sdk = await this.getSDK();
    return sdk.pinByHash(cid);
  }

  static async unpin(cid: string) {
    const sdk = await this.getSDK();
    return sdk.unpin(cid);
  }

  static async getpins() {
    const sdk = await this.getSDK();
    return sdk.pinList().then((x) =>
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

  static async getQueue() {
    const sdk = await this.getSDK();
    return sdk
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
