import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  order: any | null = null;

  addresses: any[] = [];
  private addressById = new Map<string, any>();
  deliveryLocation: any | null = null;
  private productById = new Map<string, any>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    const userId = this.auth.getUserId();
    if (!userId) {
      this.router.navigateByUrl('/login');
      return;
    }

    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.router.navigateByUrl('/orders');
      return;
    }

    this.fetch(orderId, userId);
  }

  addressFor(): any | null {
    const id = String(this.order?.userAddressId || '').trim();
    return id ? this.addressById.get(id) || null : null;
  }

  productFor(productId: any): any | null {
    const id = String(productId || '').trim();
    return id ? this.productById.get(id) || null : null;
  }

  private fetch(orderId: string, userId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.order = null;
    this.addresses = [];
    this.addressById.clear();
    this.deliveryLocation = null;
    this.productById.clear();

    this.api.getOrder(orderId).subscribe({
      next: (order) => {
        this.order = order;
        const storeId = String(order?.storeId || '');

        const addresses$ = this.api.getUserAddressesByUser(userId).pipe(catchError(() => of([])));
        const deliveryLocations$ = storeId
          ? this.api.getDeliveryLocationsByStore(storeId).pipe(
              catchError(() => of([])),
              map((rows) => rows || []),
            )
          : of([]);

        forkJoin({ addresses: addresses$, locations: deliveryLocations$ }).subscribe({
          next: (res) => {
            this.addresses = res.addresses || [];
            this.addressById = new Map(this.addresses.map((a: any) => [String(a?._id), a]));

            const locationId = String(order?.deliveryLocationId || this.addressFor()?.deliveryLocationId || '');
            this.deliveryLocation = locationId ? (res.locations || []).find((l: any) => String(l?._id) === locationId) || null : null;
          },
          error: () => {},
        });

        this.hydrateOrderProducts(order);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Could not load this order.';
        this.isLoading = false;
      },
    });
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
