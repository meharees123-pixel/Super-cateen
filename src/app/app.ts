import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { CartStateService } from './services/cart-state.service';
import { LoadingService } from './services/loading.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Super-cateen');
  readonly cartCount = () => this.cartState.count();
  readonly currentYear = new Date().getFullYear();

  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoggedIn = computed(() => this.auth.isLoggedInSignal());
  readonly storeName = computed(() => this.auth.storeName());

  constructor(
    private readonly auth: AuthService,
    private readonly cartState: CartStateService,
    protected readonly loading: LoadingService,
    protected readonly toast: ToastService,
    private readonly router: Router,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Refresh cart count on navigation.
      this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
        this.cartState.refresh();
      });
      this.cartState.refresh();
    }
  }

  logout(): void {
    this.auth.clear();
    this.cartState.reset();
    this.toast.info('Logged out.');
    this.router.navigateByUrl('/login');
  }

  dismissToast(id: string): void {
    this.toast.dismiss(id);
  }
}
