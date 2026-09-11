import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCodeType } from '../constants';

export class BusinessException extends BaseException {
  constructor(
    errorCode: ErrorCodeType,
    message: string,
    status = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super(errorCode, message, status, details);
  }
}
