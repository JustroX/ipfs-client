import { createInterface } from 'readline';
import { writeFile } from 'fs/promises';

function ask(question: string) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(question, function (answer) {
      rl.close();
      resolve(answer);
    });
  });
}

export async function setup() {
  const pinata_key = await ask(
    'Please provide Pinata API key (See https://docs.pinata.cloud/#your-api-keys):',
  );
  const pinata_secret = await ask('Please provide Pinata secret:');
  const master_password = await ask('Please provide application master key:');

  const file = `PINATA_API_KEY=${pinata_key}\nPINATA_SECRET_KEY=${pinata_secret}\nMASTER_KEY=${master_password}`;
  await writeFile(process.cwd() + '/.env', file);

  process.env.PINATA_API_KEY = pinata_key;
  process.env.PINATA_SECRET_KEY = pinata_secret;
  process.env.MASTER_KEY = master_password;
}
