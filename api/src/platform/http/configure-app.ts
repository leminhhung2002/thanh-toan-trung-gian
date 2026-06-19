import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PUBLIC_API_NAME } from '../config/branding';
import { getCorsOrigins } from './cors';
import { HttpExceptionFilter } from './http-exception.filter';

export function getSwaggerTitle() {
  return PUBLIC_API_NAME;
}

export function configureApp(app: INestApplication) {
  const configService = app.get(ConfigService);
  app.enableCors({
    credentials: true,
    origin: getCorsOrigins(configService.get<string>('CORS_ALLOWED_ORIGINS')),
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(getSwaggerTitle())
    .setDescription('Redesigned wallet and operations API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}
