import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The mobile app connects from a different origin (Expo dev server /
  // Expo Go), and eventually the web dashboard will too — wide open for
  // dev; tighten this once real deployment origins are known.
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Warehouse HQ backend listening on http://localhost:${port}`);
}
bootstrap();
