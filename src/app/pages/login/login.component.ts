import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  mobileNumber = '';
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    this.errorMessage = '';
    const phone = this.mobileNumber.trim();
    if (!phone) {
      this.errorMessage = 'Phone number is required.';
      return;
    }

    this.isSubmitting = true;
    this.api
      .loginInfo(phone)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (user) => {
          const token = user?.firebaseToken;
          const userId = user?._id;
          if (!token || !userId) {
            this.errorMessage = 'Login failed: no token/userId returned for this phone.';
            return;
          }

          this.auth.setPhone(phone);
          this.auth.setToken(String(token));
          this.auth.setUserId(String(userId));
          this.router.navigateByUrl('/stores');
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.errorMessage = msg ? String(msg) : 'Login failed.';
        },
      });
  }
}

