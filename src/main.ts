import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as morgan from 'morgan';

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
}
bootstrap();
