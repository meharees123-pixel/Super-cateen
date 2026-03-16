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
  private cartByProduct = new Map<string, { itemId: string; quantity: number }>();

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
    this.loadCart();

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
        next: (item) => {
          const pid = String(productId);
          const id = item?._id ? String(item._id) : this.cartByProduct.get(pid)?.itemId || '';
          const qty = Number(item?.quantity || 1);
          if (id) this.cartByProduct.set(pid, { itemId: id, quantity: qty });
          else this.loadCart();
          this.cartState.refresh();
        },
        error: () => {},
      });
  }

  qtyFor(product: any): number {
    const pid = this.idOf(product);
    return this.cartByProduct.get(pid)?.quantity ?? 0;
  }

  changeQty(product: any, delta: number): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    const productId = product?._id;
    if (!userId || !storeId || !productId) return;
    const pid = String(productId);

    const entry = this.cartByProduct.get(pid);
    if (!entry) {
      if (delta > 0) this.addToCart(product);
      return;
    }

    const nextQty = entry.quantity + delta;

    if (nextQty < 1) {
      this.addingProductId = pid;
      this.api
        .deleteCartItem(entry.itemId)
        .pipe(finalize(() => (this.addingProductId = '')))
        .subscribe({
          next: () => {
            this.cartByProduct.delete(pid);
            this.cartState.refresh();
          },
          error: () => {},
        });
      return;
    }

    const safeQty = Math.max(1, nextQty);
    this.addingProductId = pid;
    this.api
      .updateCartItem(entry.itemId, {
        userId,
        storeId,
        productId: pid,
        quantity: safeQty,
      })
      .pipe(finalize(() => (this.addingProductId = '')))
      .subscribe({
        next: () => {
          this.cartByProduct.set(pid, { ...entry, quantity: safeQty });
          this.cartState.refresh();
        },
        error: () => {},
      });
  }

  private loadCart(): void {
    const userId = this.auth.getUserId();
    const storeId = this.storeId;
    if (!userId || !storeId) return;

    this.api.getCartByUser(userId).subscribe({
      next: (items) => {
        const rows = Array.isArray(items) ? items : [];
        const filtered = rows.filter((x: any) => String(x?.storeId) === String(storeId));
        this.cartByProduct = new Map(
          filtered.map((x: any) => [String(x?.productId), { itemId: String(x?._id), quantity: Number(x?.quantity || 1) }]),
        );
      },
      error: () => {},
    });
  }
}
