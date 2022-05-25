import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import morgan from 'morgan';
import { config } from 'dotenv';
import open from 'open';
import { track } from 'temp';
import { IPFSNode } from './shared/ipfs-node';

async function main() {
  track();
  config();
  await bootstrap();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms'),
  );
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
  await IPFSNode.getNode();
  console.log(
    `\n\n\n\n
Advisor:
- Feria, Rommel
Developers:
- Romero, Justine Che T.
- Surara, Ron Christian C.
--------------------------------------
  Open app at http://127.0.0.1:3000 
--------------------------------------
\n\n\n`,
  );
  open('http://127.0.0.1:3000');
}

main();
