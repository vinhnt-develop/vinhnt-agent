import { ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ApiSuccessResponse, MetaData } from '../interfaces/response.interface';
import { applyDecorators, Type } from '@nestjs/common';

// 'node_modules/@nestjs/swagger/dist/interfaces/open-api-spec.interface';
type OpenApiSchemaObject = Record<string, any>;
type OpenApiReferenceObject = { $ref: string };

export class DataMetaData implements MetaData {
  @ApiProperty({ description: 'Total number of items' })
  totalItems!: number;

  @ApiProperty({ description: 'Number of items returned in the current page' })
  itemCount!: number;

  @ApiProperty({ description: 'Number of items per page' })
  itemsPerPage!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;

  @ApiProperty({ description: 'Current page' })
  currentPage!: number;

  constructor(meta?: Partial<MetaData>) {
    if (meta) {
      this.totalItems = meta.totalItems!;
      this.itemCount = meta.itemCount!;
      this.itemsPerPage = meta.itemsPerPage!;
      this.totalPages = meta.totalPages!;
      this.currentPage = meta.currentPage!;
    }
  }
}

export class DataResponse<T> implements ApiSuccessResponse<T> {
  @ApiProperty({ description: 'Status of the response', default: 'success' })
  status: 'success' | 'ok' = 'success';

  @ApiProperty({
    description: 'Response message',
    required: false,
    default: 'Success!',
  })
  message?: string = 'Success!';

  @ApiProperty({ description: 'Response data' })
  data: T | T[] | null;

  constructor(data?: T | T[] | null, message?: string) {
    this.data = data ?? null;
    this.message = message ?? 'Success!';
  }
}

export function getSwaggerSchema(
  type: any,
  isArray = false,
): OpenApiSchemaObject | OpenApiReferenceObject {
  let schema: OpenApiSchemaObject | OpenApiReferenceObject;

  switch (true) {
    case !type:
      schema = { nullable: true, default: null };
      break;
    case type === String:
      schema = { type: 'string' };
      break;
    case type === Number:
      schema = { type: 'number' };
      break;
    case type === Boolean:
      schema = { type: 'boolean' };
      break;
    case !!type.enum:
      schema = { enum: type.enum };
      break;
    default:
      schema = { $ref: getSchemaPath(type) };
  }

  if (isArray) schema = { type: 'array', items: schema };

  return schema;
}

type ApiDataResponseOptions =
  { isArray: true; withMeta?: boolean } | { isArray?: false; withMeta?: false };
export const ApiDataResponse = <Data extends Type<unknown> | null = null>(
  data?: Data,
  options?: ApiDataResponseOptions,
  additionProp?: Record<string, OpenApiSchemaObject | OpenApiReferenceObject>,
) => {
  const responseClass = DataResponse;
  const properties: Record<string, any> = {};
  properties.data = getSwaggerSchema(data, options?.isArray);

  if (options?.withMeta)
    properties.meta = { $ref: getSchemaPath(DataMetaData) };
  if (additionProp) Object.assign(properties, additionProp);

  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [{ $ref: getSchemaPath(responseClass) }, { properties }],
      },
    }),
  );
};
