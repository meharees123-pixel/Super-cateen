import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartStateService } from '../../services/cart-state.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit {
  q = '';
  isLoading = false;
  errorMessage = '';
  results: any[] = [];
  addingProductId = '';

  storeId = '';

  private readonly destroyRef = inject(DestroyRef);
  private readonly keyup$ = new Subject<string>();
  private readonly submit$ = new Subject<string>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly cartState: CartStateService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const storeId = this.auth.getStoreId();
    if (storeId) this.storeId = storeId;

    const q$ = merge(this.keyup$.pipe(debounceTime(250)), this.submit$).pipe(
      map((v) => String(v || '').trim()),
      distinctUntilChanged(),
      tap((query) => {
        this.router.navigate([], {
          queryParams: { q: query || null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });

        if (!query) {
          this.errorMessage = '';
          this.results = [];
        }
      }),
      filter((query) => !!query),
      tap(() => {
        this.isLoading = true;
        this.errorMessage = '';
        this.results = [];
      }),
      switchMap((query) =>
        this.api.searchProducts({ q: query, storeId: this.storeId }).pipe(
          catchError((err) => {
            const msg = err?.error?.message;
            this.errorMessage = msg ? String(msg) : 'Search failed.';
            return of([] as any[]);
          }),
          finalize(() => (this.isLoading = false)),
        ),
      ),
      takeUntilDestroyed(this.destroyRef),
    );

    q$.subscribe((data) => (this.results = data || []));

    const qp = this.route.snapshot.queryParamMap.get('q');
    if (qp) {
      this.q = qp;
      this.submit$.next(this.q);
    }
  }

  onQueryChange(value: string): void {
    this.q = value;
    this.keyup$.next(value);
  }

  search(): void {
    this.submit$.next(this.q);
  }

  idOf(value: any): string {
    return value?._id !== undefined && value?._id !== null ? String(value._id) : String(value || '');
  }

  addToCart(product: any): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    const productId = product?._id;
    if (!userId || !storeId || !productId) return;

    this.addingProductId = String(productId);
    this.api
      .addToCart({ userId, storeId, productId: String(productId), quantity: 1 })
      .pipe(finalize(() => (this.addingProductId = '')))
      .subscribe({
        next: () => this.cartState.refresh(),
        error: () => {},
      });
  }
}
