import { instanceToPlain, plainToInstance } from 'class-transformer';
import { ApiResponse, MetaData } from '@/common/interfaces';

export const formatResponse = {
  single<T>(
    dto: (new (...args: any[]) => T) | null,
    data: any = null,
    message = 'Success!',
  ): ApiResponse<T> {
    if (!dto || !data) {
      return {
        status: 'success',
        message,
        data: data ?? null,
      };
    }
    const transformedData = plainToInstance(dto, data, {
      excludeExtraneousValues: true,
    });
    return {
      status: 'success',
      message,
      data: instanceToPlain(transformedData) as T,
    };
  },

  array<T>(
    dto: new (...args: any[]) => T,
    data: any[],
    message = 'Success!',
  ): ApiResponse<T[]> {
    const transformedData = plainToInstance(dto, data, {
      excludeExtraneousValues: true,
    });
    return {
      status: 'success',
      message,
      data: instanceToPlain(transformedData) as T[],
    };
  },

  paginate<T>(
    dto: new (...args: any[]) => T,
    data: any[],
    message = 'Success!',
    page: number,
    size: number,
    total?: number,
  ): ApiResponse<T[]> {
    const transformedData = plainToInstance(dto, data, {
      excludeExtraneousValues: true,
    });
    const totalItems = total ?? data.length;

    const meta: MetaData = {
      totalItems,
      itemCount: Math.min(size, totalItems),
      itemsPerPage: size,
      totalPages: Math.ceil(totalItems / size),
      currentPage: page,
    };

    return {
      status: 'success',
      data: instanceToPlain(transformedData) as T[],
      message,
      meta,
    };
  },
};
