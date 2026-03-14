import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';

export const toastInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const msg =
          (typeof err.error?.message === 'string' && err.error.message) ||
          (typeof err.message === 'string' && err.message) ||
          `Request failed (${err.status})`;
        if (err.status === 401) toast.error('Unauthorized: please login again.');
        else toast.error(String(msg));
      } else {
        toast.error('Request failed.');
      }
      return throwError(() => err);
    }),
  );
};

