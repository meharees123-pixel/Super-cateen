import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CartStateService {
  readonly count = signal<number>(0);

  private readonly platformId = inject(PLATFORM_ID);

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  reset(): void {
    this.count.set(0);
  }

  refresh(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    if (!userId || !storeId) {
      this.count.set(0);
      return;
    }

    this.api.getCartCount(userId, storeId).subscribe({
      next: (res) => this.count.set(Number(res?.count || 0)),
      error: () => this.count.set(0),
    });
  }
}

