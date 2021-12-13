import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { promises as fs } from 'fs';

export class Keystore {
  private static async isRecordExist(cid: string) {
    const root = `${process.cwd()}/data/${cid}`;
    try {
      await fs.stat(root);
      return true;
    } catch (err) {
      return false;
    }
  }

  private static getMasterKey() {
    const master = process.env.MASTER_KEY;
    const output = scryptSync(master, 'random-salt', 32);
    return output;
  }
  private static encrypt(val: string) {
    const key = this.getMasterKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encryptedData = cipher.update(val, 'utf-8', 'hex');
    encryptedData += cipher.final('hex');
    return encryptedData + ':' + iv.toString('hex');
  }
  private static decrypt(val: string) {
    const key = this.getMasterKey();
    const [data, iv] = val.split(':');

    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex'),
    );
    let plain = decipher.update(data, 'hex', 'utf-8');
    plain += decipher.final('utf-8');
    return plain;
  }

  static async getKey(cid: string): Promise<string | false> {
    if (!(await this.isRecordExist(cid))) return false;

    const root = `${process.cwd()}/data/${cid}`;
    const data = await fs.readFile(root, 'utf-8');
    const decrypted = this.decrypt(data);
    return decrypted;
  }
  static async setKey(cid: string, passphrase: string) {
    const data = this.encrypt(passphrase);
    const root = `${process.cwd()}/data/${cid}`;
    await fs.writeFile(root, data, 'utf-8');
  }
}
