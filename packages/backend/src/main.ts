import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';

import { AppModule } from './app.module';
import { UPLOADS_DIR } from './uploads/uploads.constants';

async function bootstrap() {
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // The mobile app connects from a different origin (Expo dev server /
  // Expo Go), and eventually the web dashboard will too — wide open for
  // dev; tighten this once real deployment origins are known.
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Warehouse HQ backend listening on http://localhost:${port}`);
}
bootstrap();
