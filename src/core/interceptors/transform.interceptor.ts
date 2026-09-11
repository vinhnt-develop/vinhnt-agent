import { ApiResponse } from '@/common/interfaces';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        if (data === null) {
          return {
            status: 'success' as const,
            message: 'success',
            data: null,
          };
        }

        if (data.data !== undefined || data.meta !== undefined) {
          return {
            status: 'success' as const,
            message: data.message ?? 'success',
            data: data.data ?? null,
            meta: data.meta ?? undefined,
          };
        }

        return {
          status: 'success' as const,
          message: data.message ?? 'success',
          data,
        };
      }),
      catchError((err) => throwError(() => err)),
    );
  }
}
