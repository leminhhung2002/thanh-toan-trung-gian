import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { getAccessUrls } from './platform/http/access-urls';
import { configureApp } from './platform/http/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST', '0.0.0.0');
  const port = configService.get<number>('PORT', 3000);
  configureApp(app);
  await app.listen(port, host);

  const urls = getAccessUrls({ host, port });
  const networkSection =
    urls.networkUrls.length > 0
      ? `\n[api] Network: ${urls.networkUrls.join(', ')}`
      : '';

  console.log(
    `[api] Listening on ${host}:${port}\n[api] Local: ${urls.localUrl}${networkSection}\n[api] Docs: ${urls.docsUrl}`,
  );
}
void bootstrap();
