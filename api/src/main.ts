import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './setup.js';

try {
  process.loadEnvFile();
} catch {
  // .env is optional (production uses host environment variables)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Workflows can run any script in the scripts directory, so the API stays on
  // the loopback interface unless HOST says otherwise.
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
}
await bootstrap();
