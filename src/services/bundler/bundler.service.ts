import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { copy } from 'fs-extra';
import { basename } from 'path';
import { tmpdir } from 'os';
import { Archiver } from './archiver';

@Injectable()
export class BundlerService {
  private static generateSymmetricKey(key: string) {
    const iv = randomBytes(16);
    return { key, iv };
  }

  async bundle(
    type: 'file' | 'folder',
    source: string,
    output_file: string,
    passphrase: string,
  ) {
    // Create bundle directory
    const output_name = basename(output_file);
    const tmp_root = tmpdir();
    const bundle_name = `${output_name}-${Date.now()}`;
    const bundle_root = `${tmp_root}/${bundle_name}`;
    await fs.mkdir(`${bundle_root}/data`, { recursive: true });

    // File transfer
    const data_folder = `${bundle_root}/data`;
    const source_name = basename(source);

    if (type == 'file')
      await fs.copyFile(source, `${data_folder}/${source_name}`);
    else await copy(source, `${data_folder}`);

    // Data zipping
    const data_folder_zipped = `${bundle_root}/data.zip`;
    await Archiver.zipFile(data_folder, 'data.zip', data_folder_zipped);
    await fs.rm(data_folder, { recursive: true });

    // Data encryption
    const data_folder_encrypted = `${bundle_root}/data.zip.enc`;
    const { iv } = await this.encryptFile(
      data_folder_zipped,
      data_folder_encrypted,
      passphrase,
    );
    await fs.rm(data_folder_zipped, { recursive: true });

    // Write IV
    await fs.writeFile(`${bundle_root}/iv.dat`, iv);
    await fs.writeFile(`${bundle_root}/type.dat`, type, 'utf-8');

    // Zip bundle
    await Archiver.zipFolder(bundle_root, bundle_name, output_file);
    await fs.rm(bundle_root, { recursive: true });
  }

  async unbundle(source: string, output_file: string, passphrase: string) {
    // Create unbundle directory
    const tmp_root = tmpdir();
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
    const iv = await fs.readFile(`${unbundle_root}/iv.dat`);
    const type = (await fs.readFile(`${unbundle_root}/type.dat`, 'utf-8')) as
      | 'file'
      | 'folder';

    // Data decryption
    const data_folder_encrypted = `${unbundle_root}/data.zip.enc`;
    const data_folder_zipped = `${unbundle_root}/data.zip`;
    await this.decryptFile(
      data_folder_encrypted,
      data_folder_zipped,
      passphrase,
      iv,
    );
    await fs.rm(data_folder_encrypted, { recursive: true });

    if (type == 'folder') {
      await fs.copyFile(data_folder_zipped, output_file);
    } else {
      const data_folder = `${unbundle_root}/data`;
      await Archiver.unzip(data_folder_zipped, data_folder);
      const files = await fs.readdir(data_folder);
      await fs.copyFile(files[0], output_file);
    }

    await fs.rm(unbundle_root, { recursive: true });
    return output_file;
  }

  private async encryptFile(source: string, dest: string, passphrase: string) {
    const { key, iv } = BundlerService.generateSymmetricKey(passphrase);
    await pipeline(
      createReadStream(source),
      createCipheriv('aes-256-gcm', key, iv),
      createWriteStream(dest),
    );
    return { dest, iv };
  }

  private async decryptFile(
    source: string,
    dest: string,
    key: string,
    iv: Buffer,
  ) {
    await pipeline(
      createReadStream(source),
      createDecipheriv('aes-256-gcm', key, iv),
      createWriteStream(dest),
    );
    return dest;
  }
}
