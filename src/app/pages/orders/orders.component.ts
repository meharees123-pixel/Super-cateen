import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  orders: any[] = [];
  userId = '';
  expandedOrderId = '';
  page = 1;
  pageSize = 10;

  addresses: any[] = [];
  private addressById = new Map<string, any>();
  private locationById = new Map<string, any>();
  private productById = new Map<string, any>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const userId = this.auth.getUserId();
    if (!userId) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.userId = userId;
    this.load();
  }

  load(): void {
    if (!this.userId) return;
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      orders: this.api.getOrdersByUser(this.userId),
      addresses: this.api.getUserAddressesByUser(this.userId).pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          const rows = Array.isArray(res?.orders) ? res.orders : [];
          this.orders = rows.sort((a: any, b: any) => {
            const aDate = new Date(a?.createdAt || 0).getTime();
            const bDate = new Date(b?.createdAt || 0).getTime();
            return bDate - aDate;
          });
          this.page = 1;
          this.addresses = res?.addresses || [];
          this.addressById = new Map(this.addresses.map((a: any) => [String(a?._id), a]));

          const storeIds = Array.from(new Set((this.orders || []).map((o) => String(o?.storeId || '')).filter(Boolean)));
          if (!storeIds.length) return;

          const obs = storeIds.map((sid) =>
            this.api.getDeliveryLocationsByStore(sid).pipe(
              catchError(() => of([])),
              map((rows) => ({ sid, rows: rows || [] })),
            ),
          );

          forkJoin(obs).subscribe({
            next: (rows) => {
              const locations = rows.flatMap((r) => r.rows || []);
              this.locationById = new Map(locations.map((l: any) => [String(l?._id), l]));
            },
            error: () => {},
          });
        },
        error: () => (this.errorMessage = 'Failed to load orders.'),
      });
  }

  toggle(order: any): void {
    const id = String(order?._id || '');
    if (!id) return;
    this.expandedOrderId = this.expandedOrderId === id ? '' : id;
    if (this.expandedOrderId) this.hydrateOrderProducts(order);
  }

  goToDetails(order: any, event: Event): void {
    event.stopPropagation();
    const id = String(order?._id || '').trim();
    if (!id) return;
    this.router.navigateByUrl(`/orders/${id}`);
  }

  pagedOrders(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.orders.slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.page < this.totalPages()) {
      this.page += 1;
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
    }
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.orders.length / this.pageSize));
  }

  addressFor(order: any): any | null {
    const id = String(order?.userAddressId || '').trim();
    return id ? this.addressById.get(id) || null : null;
  }

  deliveryLocationFor(order: any): any | null {
    const directId = order?.deliveryLocationId ? String(order.deliveryLocationId) : '';
    const addr = this.addressFor(order);
    const fallbackId = addr?.deliveryLocationId ? String(addr.deliveryLocationId) : '';
    const id = directId || fallbackId;
    return id ? this.locationById.get(id) || null : null;
  }

  productFor(productId: any): any | null {
    const id = String(productId || '').trim();
    return id ? this.productById.get(id) || null : null;
  }

  private hydrateOrderProducts(order: any): void {
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    const missing: string[] = items
      .map((i: any) => String(i?.productId ?? '').trim())
      .filter((pid) => !!pid && !this.productById.has(pid));

    const unique: string[] = [...new Set(missing)].slice(0, 50);
    if (!unique.length) return;

    const obs = unique.map((id: string) =>
      this.api.getProduct(id).pipe(
        catchError(() => of(null)),
        map((p) => ({ id, p } as const)),
      ),
    );

    forkJoin(obs).subscribe({
      next: (rows) => {
        for (const r of rows) {
          if (r?.p) this.productById.set(r.id, r.p);
        }
      },
      error: () => {},
    });
  }
}
