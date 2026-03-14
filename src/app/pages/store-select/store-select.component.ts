import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-store-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-select.component.html',
  styleUrl: './store-select.component.scss',
})
export class StoreSelectComponent implements OnInit {
  stores: any[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadStores();
  }

  loadStores(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.api
      .getStores()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (data) => (this.stores = data || []),
        error: () => (this.errorMessage = 'Failed to load stores.'),
      });
  }

  selectStore(store: any): void {
    if (!store?._id) return;
    this.auth.setStore(String(store._id), store?.name ? String(store.name) : undefined);
    this.router.navigateByUrl('/dashboard');
  }
}
