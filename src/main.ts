import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import morgan from 'morgan';
import { config } from 'dotenv';
import { setup } from './setup';
import open from 'open';

async function main() {
  config();
  if (
    !process.env.PINATA_API_KEY ||
    !process.env.PINATA_SECRET_KEY ||
    !process.env.MASTER_KEY
  ) {
    await setup();
    config();
  }

  await bootstrap();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms'),
  );
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
  console.log(
    `\n\n\n\n
Authors:
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
