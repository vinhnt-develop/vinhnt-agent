import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from '../constants';
import { ApiErrorResponse } from '../interfaces';

export class BaseException extends HttpException {
  constructor(
    errorCode: ErrorCodeType,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    const response: ApiErrorResponse = {
      status: 'error',
      message,
      error_code: errorCode,
      details,
    };
    super(response, status);
  }
}
