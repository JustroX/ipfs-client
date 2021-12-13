import archiver from 'archiver';
import { rejects } from 'assert';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';

interface ZipContentDirectory {
  type: 'directory';
  source: string;
  directory: string;
}

interface ZipContentFile {
  type: 'file';
  source: string;
  filename: string;
}

interface ZipContentBuffer {
  type: 'buffer';
  name: string;
  data: Buffer;
}

type ZipContent = ZipContentDirectory | ZipContentFile | ZipContentBuffer;

export class Archiver {
  static zip(contents: ZipContent[], output_file: string) {
    const output = createWriteStream(output_file);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });
    const pipe = pipeline(archive, output);

    for (const content of contents) {
      switch (content.type) {
        case 'file':
          {
            const { source, filename } = content;
            archive.file(source, {
              name: filename,
            });
          }
          break;
        case 'directory':
          {
            const { source, directory } = content;
            archive.directory(source, directory);
          }
          break;
        case 'buffer':
          {
            const { name, data } = content;
            archive.append(data, { name });
          }
          break;
      }
    }

    archive.finalize();
    return pipe;
  }

  static zipFile(source: string, filename: string, output_file: string) {
    return this.zip(
      [
        {
          type: 'file',
          source,
          filename,
        },
      ],
      output_file,
    );
  }

  static zipFolder(source: string, directory: string, output_file: string) {
    return this.zip(
      [
        {
          type: 'directory',
          source,
          directory,
        },
      ],
      output_file,
    );
  }

  static unzip(source: string, destination: string) {
    const extractor = unzipper.Extract({
      path: destination,
    });
    const archive = createReadStream(source);
    return new Promise<void>((resolve, reject) => {
      archive
        .pipe(extractor)
        .on('close', () => {
          resolve();
        })
        .on('error', (err) => reject(err));
    });
  }
}
