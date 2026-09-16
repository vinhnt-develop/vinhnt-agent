import { ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ApiSuccessResponse, MetaData } from '../interfaces/response.interface';
import { applyDecorators, Type } from '@nestjs/common';
import { Expose } from 'class-transformer';

// 'node_modules/@nestjs/swagger/dist/interfaces/open-api-spec.interface';
type OpenApiSchemaObject = Record<string, any>;
type OpenApiReferenceObject = { $ref: string };

export class DataMetaData implements MetaData {
  @ApiProperty({ name: 'totalItems', type: Number, description: 'Total number of items' })
  @Expose({ name: 'totalItems' })
  totalItems!: number;

  @ApiProperty({ name: 'itemCount', type: Number, description: 'Number of items returned in the current page' })
  @Expose({ name: 'itemCount' })
  itemCount!: number;

  @ApiProperty({ name: 'itemsPerPage', type: Number, description: 'Number of items per page' })
  @Expose({ name: 'itemsPerPage' })
  itemsPerPage!: number;

  @ApiProperty({ name: 'totalPages', type: Number, description: 'Total number of pages' })
  @Expose({ name: 'totalPages' })
  totalPages!: number;

  @ApiProperty({ name: 'currentPage', type: Number, description: 'Current page' })
  @Expose({ name: 'currentPage' })
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
  @ApiProperty({ name: 'status', type: String, description: 'Status of the response', default: 'success' })
  @Expose({ name: 'status' })
  status: 'success' | 'ok' = 'success';

  @ApiProperty({
    name: 'message',
    type: String,
    description: 'Response message',
    required: false,
    default: 'Success!',
  })
  @Expose({ name: 'message' })
  message?: string = 'Success!';

  @ApiProperty({ name: 'data', description: 'Response data' })
  @Expose({ name: 'data' })
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
