import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

/**
 * Приводит любые ошибки к единой форме ApiError из @expense-tracker/shared,
 * чтобы фронтенду не приходилось разбирать три разных формата.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';
    let errors: Record<string, string[]> | undefined;

    // ZodValidationException — обёртка nestjs-zod над ZodError; она же HttpException,
    // поэтому проверять её нужно раньше общей ветки, иначе потеряем разбор по полям.
    const zodError =
      exception instanceof ZodValidationException
        ? exception.getZodError()
        : exception instanceof ZodError
          ? exception
          : null;

    if (zodError instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Ошибка валидации';
      errors = {};

      for (const issue of zodError.issues) {
        const field = issue.path.join('.') || '_';
        (errors[field] ??= []).push(issue.message);
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? message);
    }

    // Подробности 5xx пишем в лог, но наружу не отдаём: в стектрейсе бывают строки подключения.
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
