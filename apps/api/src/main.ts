import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import * as express from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { validateProductionConfig } from "./config/validate-production-config";

async function bootstrap() {
  validateProductionConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Structured, leveled logging (§18 of the build plan) — pino would be a
    // drop-in upgrade later; Nest's built-in logger is enough for the MVP
    // and never logs request bodies, so secrets/PII don't end up in logs.
    logger: ["error", "warn", "log"],
    // Disabled so we can install our own express.json() below that captures
    // the raw body for webhook signature verification — see the comment
    // there for why that can't be bolted on after Nest's default parser.
    bodyParser: false,
  });

  app.use(helmet());

  // Keep the raw request body around for the Razorpay webhook route, which
  // must verify an HMAC signature over the exact bytes Razorpay sent — a
  // re-serialized JSON object would not reproduce the same signature. Every
  // other route still gets the normal parsed `req.body`.
  app.use(
    express.json({
      // Every request body this API accepts is a small JSON object (a
      // profile update, a booking, a report) — 1MB is generous headroom
      // for that and a firm stop against an oversized-request DoS attempt.
      // Explicit rather than relying on express's own 100kb default so
      // it's a documented decision, not an implicit one.
      limit: "1mb",
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174").split(","),
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Global input validation: every DTO is checked against its class-validator
  // rules before a controller method ever runs. Unknown fields are stripped
  // rather than silently accepted, and validation failures never leak which
  // internal field type was wrong beyond the human-readable message.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Never let a raw error (stack trace, DB error text, internal path) reach
  // a client — see §08 "Error messages" in the build plan.
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`K-Meets API listening on http://localhost:${port}`);
}

bootstrap();
