import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiErrorResponse } from '../interfaces';
import { isProduction } from '../utils';
import { ErrorCodes, ErrorCodeType } from '../constants';
import { BaseException } from '../exceptions';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error_code: ErrorCodeType = ErrorCodes.INTERNAL_SERVER_ERROR;
    let details: any = undefined;
    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();
      const isCustomAppException = exception instanceof BaseException;
      if (typeof response === 'string') {
        message = response;
        details = isProduction() ? undefined : exception.stack;
      } else if (typeof response === 'object' && response !== null) {
        message = response['message'] || message;
        error_code = response['error'] || error_code;
        if (isCustomAppException) {
          details = response['details'] || undefined;
        } else {
          details = isProduction()
            ? undefined
            : response['details'] || exception.stack;
        }
      }
    } else if (exception instanceof Error) {
      message = isProduction() ? 'Internal server error' : exception.message;
      details = !isProduction() ? exception.stack : undefined;
    }

    const responseBody: ApiErrorResponse = {
      status: 'error',
      message,
      error_code,
      details,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
