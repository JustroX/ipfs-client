import pinata from '@pinata/sdk';

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
}
