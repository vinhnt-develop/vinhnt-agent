import { HttpStatus, ValidationError } from '@nestjs/common';
import { BaseException } from '../exceptions';
import { ErrorCodes } from '../constants';

export interface IValidationErrorItem {
  errorCode: string;
  [key: string]: any;
}
export interface IValidationDetails {
  [field: string]: IValidationErrorItem[];
}

const buildValidationErrors = (
  errors: ValidationError[],
  parentProperty = '',
): IValidationDetails => {
  return errors.reduce((acc: IValidationDetails, err) => {
    const propertyPath = parentProperty
      ? `${parentProperty}.${err.property}`
      : err.property;
    const errorItems: IValidationErrorItem[] = [];
    if (err.constraints) {
      for (const ruleName of Object.keys(err.constraints)) {
        const customContext = err.contexts?.[ruleName];

        errorItems.push({
          errorCode: customContext?.errorCode || `${ruleName.toUpperCase()}`,
          ...(customContext ? { ...customContext } : {}),
        });
      }
      acc[propertyPath] = errorItems;
    }
    if (err.children && err.children.length > 0)
      Object.assign(acc, buildValidationErrors(err.children, propertyPath));
    return acc;
  }, {});
};

export class ValidationException extends BaseException {
  constructor(errors: ValidationError[], parentProperty?: string) {
    const formattedErrors = buildValidationErrors(errors, parentProperty);
    super(
      ErrorCodes.BAD_REQUEST,
      'Validation error',
      HttpStatus.BAD_REQUEST,
      formattedErrors,
    );
  }
}
