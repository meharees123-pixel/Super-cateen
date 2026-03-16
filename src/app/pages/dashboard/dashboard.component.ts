import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartStateService } from '../../services/cart-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  storeId = '';
  categories: any[] = [];
  sections: any[] = [];

  debug: any | null = null;
  storeCategories: any[] = [];
  showDebug = false;

  addingProductId = '';
  q = '';
  activeCategoryId = '';
  searchLoading = false;
  searchError = '';
  searchResults: any[] = [];
  private searchSeq = 0;
  private cartByProduct = new Map<string, { itemId: string; quantity: number }>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly cartState: CartStateService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const storeId = this.auth.getStoreId();
    if (!storeId) {
      this.router.navigateByUrl('/stores');
      return;
    }
    this.storeId = storeId;
    this.loadCart();
    this.load();
  }

  get filteredCategories(): any[] {
    const query = this.q.trim().toLowerCase();
    if (!query) return this.categories;
    return (this.categories || []).filter((c) => String(c?.name || '').toLowerCase().includes(query));
  }

  get filteredSections(): any[] {
    const query = this.q.trim().toLowerCase();

    const categoryFiltered = this.activeCategoryId
      ? (this.sections || []).filter((s) => this.idOf(s) === this.activeCategoryId)
      : this.sections;

    if (!query) return categoryFiltered;

    return (categoryFiltered || [])
      .map((section) => {
        const sectionName = String(section?.name || '').toLowerCase();
        const products = Array.isArray(section?.products) ? section.products : [];

        if (sectionName.includes(query)) return section;

        const filteredProducts = products.filter((p: any) => {
          const name = String(p?.name || '').toLowerCase();
          const desc = String(p?.description || '').toLowerCase();
          return name.includes(query) || desc.includes(query);
        });

        return { ...section, products: filteredProducts };
      })
      .filter((section) => (Array.isArray(section?.products) ? section.products.length : 0) > 0);
  }

  selectCategory(id: string): void {
    this.activeCategoryId = String(id || '');
  }

  clearSearch(): void {
    this.q = '';
    this.searchError = '';
    this.searchResults = [];
    this.searchLoading = false;
    this.searchSeq += 1;
  }

  onQueryChange(value: string): void {
    const query = String(value || '').trim();
    if (!query) {
      this.clearSearch();
      return;
    }

    if (query.length < 2) {
      this.searchError = '';
      this.searchResults = [];
      this.searchLoading = false;
      this.searchSeq += 1;
      return;
    }

    const seq = (this.searchSeq += 1);
    this.searchLoading = true;
    this.searchError = '';

    this.api.searchProducts({ q: query, storeId: this.storeId, limit: 24, skip: 0 }).subscribe({
      next: (data: any) => {
        if (seq !== this.searchSeq) return;
        this.searchResults = data || [];
        this.searchLoading = false;
      },
      error: (err: any) => {
        if (seq !== this.searchSeq) return;
        this.searchResults = [];
        const msg = err?.error?.message;
        this.searchError = msg ? String(msg) : 'Search failed.';
        this.searchLoading = false;
      },
    });
  }

  openGlobalSearch(): void {
    const query = this.q.trim();
    if (!query) return;
    this.router.navigate(['/search'], { queryParams: { q: query } });
  }

  load(): void {
    if (!this.storeId) return;
    this.loadCart();
    this.isLoading = true;
    this.errorMessage = '';
    this.debug = null;
    this.storeCategories = [];

    forkJoin({
      categories: this.api.getDashboardCategories(this.storeId),
      sections: this.api.getDashboardProducts(this.storeId),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          this.categories = res?.categories || [];
          this.sections = res?.sections || [];

          if (!this.sections.length) {
            this.loadDebug();
          }
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.errorMessage = msg ? String(msg) : 'Failed to load dashboard.';
        },
      });
  }

  private loadCart(): void {
    const userId = this.auth.getUserId();
    const storeId = this.storeId;
    if (!userId || !storeId) return;

    this.api.getCartByUser(userId).subscribe({
      next: (items: any) => {
        const rows = Array.isArray(items) ? items : [];
        const filtered = rows.filter((x: any) => String(x?.storeId) === String(storeId));
        this.cartByProduct = new Map(
          filtered.map((x: any) => [String(x?.productId), { itemId: String(x?._id), quantity: Number(x?.quantity || 1) }]),
        );
      },
      error: () => {},
    });
  }

  loadDebug(): void {
    if (!this.storeId) return;
    forkJoin({
      dashboardCategories: this.api.getDashboardCategoriesDebug(this.storeId),
      dashboardProducts: this.api.getDashboardProductsDebug(this.storeId),
      storeCategories: this.api.getCategoriesByStore(this.storeId),
    }).subscribe({
      next: (res) => {
        this.debug = res;
        this.storeCategories = res?.storeCategories || [];
      },
      error: () => {},
    });
  }

  idOf(value: any): string {
    return value?._id !== undefined && value?._id !== null ? String(value._id) : String(value || '');
  }

  trackById = (_: number, value: any): string => this.idOf(value);

  addToCart(product: any): void {
    const userId = this.auth.getUserId();
    const productId = product?._id;
    if (!userId || !this.storeId || !productId) return;

    this.addingProductId = String(productId);
    this.api
      .addToCart({ userId, storeId: this.storeId, productId: String(productId), quantity: 1 })
      .pipe(finalize(() => (this.addingProductId = '')))
      .subscribe({
        next: (item: any) => {
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
    const productId = product?._id;
    if (!userId || !this.storeId || !productId) return;
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
        storeId: this.storeId,
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
}
