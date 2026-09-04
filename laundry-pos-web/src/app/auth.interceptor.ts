import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('jwt_token');
  
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If the backend says the token is dead, wipe it and force the lock screen
      if (error.status === 401) {
        localStorage.removeItem('jwt_token');
        window.location.reload(); 
      }
      return throwError(() => error);
    })
  );
};