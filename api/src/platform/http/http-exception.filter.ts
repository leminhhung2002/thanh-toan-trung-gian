import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestWithContext } from './request-context.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext & Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Lỗi máy chủ nội bộ.';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        code = this.codeForStatus(status);
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const payload = exceptionResponse as {
          code?: string;
          details?: unknown;
          message?: string | string[];
          error?: string;
        };

        code =
          typeof payload.code === 'string'
            ? payload.code
            : this.codeForStatus(status);
        if (payload.details !== undefined) {
          details = payload.details;
        }
        if (Array.isArray(payload.message)) {
          message = 'Dữ liệu gửi lên không hợp lệ.';
          details = payload.details ?? payload.message;
        } else if (payload.message) {
          message = payload.message;
        } else if (payload.error) {
          message = payload.error;
        }

        if (
          status === HttpStatus.NOT_FOUND &&
          payload.error === 'Not Found' &&
          typeof payload.message === 'string' &&
          payload.message.startsWith('Cannot ')
        ) {
          code = 'not_found';
          message = 'Không tìm thấy đường dẫn yêu cầu.';
          details = null;
        }
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 'not_found';
        message = 'Không tìm thấy đường dẫn yêu cầu.';
      }
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({
      error: {
        code,
        details,
        message,
        requestId: request.requestId ?? 'unknown',
      },
    });
  }

  private codeForStatus(status: number) {
    if (status === 400) {
      return 'bad_request';
    }

    if (status === 401) {
      return 'unauthorized';
    }

    if (status === 403) {
      return 'forbidden';
    }

    if (status === 404) {
      return 'not_found';
    }

    if (status === 409) {
      return 'conflict';
    }

    return 'http_error';
  }
}
