import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartStateService } from '../../services/cart-state.service';

type CartItemVm = {
  _id: string;
  userId: string;
  storeId: string;
  addressId?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: any;
};

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  isLoading = false;
  isCheckingOut = false;
  errorMessage = '';
  infoMessage = '';

  items: CartItemVm[] = [];
  addresses: any[] = [];
  selectedUserAddressId = '';
  deliveryLocations: any[] = [];
  selectedDeliveryLocationId = '';

  private productCache = new Map<string, any>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly cartState: CartStateService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    if (!userId) {
      this.router.navigateByUrl('/login');
      return;
    }
    if (!storeId) {
      this.router.navigateByUrl('/stores');
      return;
    }
    this.load();
  }

  get total(): number {
    return this.items.reduce((sum, i) => sum + Number(i?.totalPrice || 0), 0);
  }

  load(): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    if (!userId || !storeId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    forkJoin({
      cart: this.api.getCartByUser(userId),
      addresses: this.api.getUserAddressesByUser(userId).pipe(catchError(() => of([]))),
      deliveryLocations: this.api.getDeliveryLocationsByStore(storeId).pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          const cartAll = Array.isArray(res?.cart) ? res.cart : [];
          const storeCart = cartAll.filter((x: any) => String(x?.storeId) === String(storeId));

          this.addresses = res?.addresses || [];
          this.deliveryLocations = res?.deliveryLocations || [];
          this.items = storeCart.map((x: any) => ({
            _id: String(x?._id),
            userId: String(x?.userId),
            storeId: String(x?.storeId),
            addressId: x?.userAddressId ? String(x.userAddressId) : x?.addressId ? String(x.addressId) : undefined,
            productId: String(x?.productId),
            quantity: Number(x?.quantity || 1),
            unitPrice: Number(x?.unitPrice || 0),
            totalPrice: Number(x?.totalPrice || 0),
            product: undefined,
          }));

          const firstAddr = this.items.find((i) => !!i.addressId)?.addressId;
          const addrId = firstAddr ? String(firstAddr) : '';
          const byId = addrId && this.addresses.some((a) => String(a?._id) === addrId) ? addrId : '';
          this.selectedUserAddressId = byId || this.selectedUserAddressId || String(this.addresses[0]?._id || '');

          const firstLoc =
            storeCart.find((x: any) => !!x?.deliveryLocationId)?.deliveryLocationId ||
            storeCart.find((x: any) => !!x?.addressId && !this.addresses.some((a) => String(a?._id) === String(x.addressId)))?.addressId;
          const locId = firstLoc ? String(firstLoc) : '';
          const locOk = locId && this.deliveryLocations.some((l) => String(l?._id) === locId);
          this.selectedDeliveryLocationId =
            (locOk ? locId : '') || this.selectedDeliveryLocationId || String(this.deliveryLocations[0]?._id || '');

          this.hydrateProducts();
          this.cartState.refresh();
        },
        error: () => (this.errorMessage = 'Failed to load cart.'),
      });
  }

  get selectedAddress(): any | null {
    const id = String(this.selectedUserAddressId || '').trim();
    if (!id) return null;
    return this.addresses.find((a) => String(a?._id) === id) || null;
  }

  get selectedDeliveryLocation(): any | null {
    const id = String(this.selectedDeliveryLocationId || '').trim();
    if (!id) return null;
    return this.deliveryLocations.find((l) => String(l?._id) === id) || null;
  }

  private hydrateProducts(): void {
    const missing = this.items
      .map((i) => i.productId)
      .filter((pid) => pid && !this.productCache.has(pid));

    const unique = Array.from(new Set(missing)).slice(0, 50);
    if (!unique.length) {
      this.items = this.items.map((i) => ({ ...i, product: this.productCache.get(i.productId) || i.product }));
      return;
    }

    const obs = unique.map((id) =>
      this.api.getProduct(id).pipe(
        catchError(() => of(null)),
        map((p) => ({ id, p })),
      ),
    );

    forkJoin(obs).subscribe({
      next: (rows) => {
        for (const r of rows) {
          if (r?.p) this.productCache.set(r.id, r.p);
        }
        this.items = this.items.map((i) => ({ ...i, product: this.productCache.get(i.productId) || i.product }));
      },
      error: () => {},
    });
  }

  changeQty(item: CartItemVm, nextQty: number): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    if (!userId || !storeId) return;
    if (!item?._id) return;

    const qty = Math.max(1, Math.floor(Number(nextQty || 1)));
    const addressId = this.selectedUserAddressId || item.addressId;
    const deliveryLocationId = this.selectedDeliveryLocationId;

    this.api
      .updateCartItem(item._id, {
        userId,
        storeId,
        productId: item.productId,
        quantity: qty,
        addressId,
        userAddressId: addressId,
        deliveryLocationId: deliveryLocationId || undefined,
      })
      .subscribe({
        next: () => this.load(),
        error: (err) => {
          const msg = err?.error?.message;
          this.errorMessage = msg ? String(msg) : 'Failed to update item.';
        },
      });
  }

  remove(item: CartItemVm): void {
    if (!item?._id) return;
    this.api.deleteCartItem(item._id).subscribe({
      next: () => this.load(),
      error: () => (this.errorMessage = 'Failed to remove item.'),
    });
  }

  applyAddress(): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    const userAddressId = this.selectedUserAddressId;
    const deliveryLocationId = this.selectedDeliveryLocationId;
    if (!userId || !storeId || !userAddressId || !deliveryLocationId) return;

    this.api.updateCartDeliveryForUserStore({ userId, storeId, userAddressId, deliveryLocationId }).subscribe({
      next: () => {
        this.infoMessage = 'Delivery details applied to cart.';
        this.load();
      },
      error: () => (this.errorMessage = 'Failed to apply delivery details to cart.'),
    });
  }

  checkout(): void {
    const userId = this.auth.getUserId();
    const storeId = this.auth.getStoreId();
    const userAddressId = this.selectedUserAddressId;
    const deliveryLocationId = this.selectedDeliveryLocationId;
    if (!userId || !storeId) return;
    if (!userAddressId || !deliveryLocationId) {
      this.errorMessage = 'Select address and delivery location before checkout.';
      return;
    }

    this.isCheckingOut = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.api
      .updateCartDeliveryForUserStore({ userId, storeId, userAddressId, deliveryLocationId })
      .pipe(
        catchError((err) => {
          const msg = err?.error?.message;
          this.errorMessage = msg ? String(msg) : 'Failed to set address.';
          return of(null);
        }),
      )
      .subscribe({
        next: (res) => {
          if (res === null) {
            this.isCheckingOut = false;
            return;
          }

          this.api
            .createOrderFromCart({ userId, storeId, userAddressId, deliveryLocationId })
            .pipe(finalize(() => (this.isCheckingOut = false)))
            .subscribe({
              next: (order) => {
                this.cartState.refresh();
                const orderId = order?._id || order?.id;
                if (orderId) {
                  this.router.navigateByUrl(`/orders/success/${orderId}`);
                } else {
                  this.router.navigateByUrl('/orders');
                }
              },
              error: (err) => {
                const msg = err?.error?.message;
                this.errorMessage = msg ? String(msg) : 'Checkout failed.';
              },
            });
        },
        error: () => (this.isCheckingOut = false),
      });
  }
}
