import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartStateService } from '../../services/cart-state.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  isLoading = false;
  errorMessage = '';

  storeId = '';
  categories: any[] = [];
  sections: any[] = [];

  activeCategoryId = '';
  activeSubcategoryId = '';
  q = '';
  subcategoryList: any[] = [];
  subcategoriesLoading = false;

  addingProductId = '';
  private cartByProduct = new Map<string, { itemId: string; quantity: number }>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly cartState: CartStateService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const storeId = this.auth.getStoreId();
    if (!storeId) {
      this.router.navigateByUrl('/stores');
      return;
    }
    this.storeId = storeId;
    const qpCategory = this.route.snapshot.queryParamMap.get('categoryId');
    if (qpCategory) this.activeCategoryId = String(qpCategory);
    this.loadCart();
    this.load();
  }

  get activeProducts(): any[] {
    const sections = this.sectionsForActiveCategory;
    if (this.activeSubcategoryId) {
      return sections
        .flatMap((s: any) => (Array.isArray(s?.products) ? s.products : []))
        .filter((p: any) => this.productBelongsToSubcategory(p, this.activeSubcategoryId));
    }
    return sections.flatMap((s: any) => (Array.isArray(s?.products) ? s.products : []));
  }

  get filteredProducts(): any[] {
    const query = this.q.trim().toLowerCase();
    if (!query) return this.activeProducts;
    return this.activeProducts.filter((p: any) => {
      const name = String(p?.name || '').toLowerCase();
      const desc = String(p?.description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }

  selectCategory(id: string): void {
    this.activeCategoryId = String(id || '');
    this.activeSubcategoryId = '';
    this.loadSubcategoriesForActiveCategory();
  }

  clearSearch(): void {
    this.q = '';
  }

  selectSubcategory(id: string): void {
    this.activeSubcategoryId = String(id || '');
  }

  load(): void {
    if (!this.storeId) return;
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      categories: this.api.getDashboardCategories(this.storeId),
      sections: this.api.getDashboardProducts(this.storeId),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          this.categories = res?.categories || [];
          this.sections = res?.sections || [];

          if (!this.activeCategoryId && this.categories.length) {
            this.activeCategoryId = this.idOf(this.categories[0]);
          }
          this.loadSubcategoriesForActiveCategory();
        },
        error: (err: any) => {
          const msg = err?.error?.message;
          this.errorMessage = msg ? String(msg) : 'Failed to load products.';
        },
      });
  }

  private loadSubcategoriesForActiveCategory(): void {
    if (!this.activeCategoryId) {
      this.subcategoryList = [];
      this.activeSubcategoryId = '';
      return;
    }

    const category = this.categories.find((cat) => this.idOf(cat) === this.activeCategoryId);
    const name = this.extractCategoryName(category);
    if (!this.idOf(category)) {
      this.subcategoryList = [];
      this.activeSubcategoryId = '';
      return;
    }

    this.subcategoriesLoading = true;
    this.api
      .getSubcategoriesByCategoryId(this.idOf(category))
      .pipe(finalize(() => (this.subcategoriesLoading = false)))
      .subscribe({
        next: (subs) => {
          this.subcategoryList = subs || [];
          this.syncActiveSubcategory();
        },
        error: () => {
          this.subcategoryList = [];
          this.activeSubcategoryId = '';
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

  belongsToActiveCategory(section: any): boolean {
    if (!this.activeCategoryId) return true;
    return this.sectionCategoryId(section) === String(this.activeCategoryId).trim();
  }

  private sectionCategoryId(section: any): string {
    const raw = section?.categoryId ?? section?.category?._id ?? section?.categoryId?._id ?? section?.category ?? '';
    return String(raw || '').trim();
  }

  private get sectionsForActiveCategory(): any[] {
    const all = Array.isArray(this.sections) ? this.sections : [];
    if (!this.activeCategoryId) return all;
    const filtered = all.filter((s) => this.belongsToActiveCategory(s));
    return filtered.length ? filtered : all;
  }

  get activeCategoryName(): string {
    if (!this.activeCategoryId) return 'All categories';
    const category = this.categories.find((cat) => this.idOf(cat) === this.activeCategoryId);
    return this.extractCategoryName(category) || 'Category';
  }

  private syncActiveSubcategory(): void {
    if (!this.subcategoryList.length) {
      this.activeSubcategoryId = '';
      return;
    }

    if (!this.activeSubcategoryId || !this.subcategoryList.some((s) => this.idOf(s) === this.activeSubcategoryId)) {
      this.activeSubcategoryId = this.idOf(this.subcategoryList[0]);
    }
  }

  private extractCategoryName(category: any): string {
    return String(category?.name || category?.title || category?.categoryName || '').trim();
  }

  private productBelongsToSubcategory(product: any, subcategoryId: string): boolean {
    const target = String(subcategoryId || '').trim().toLowerCase();
    if (!target) return true;
    return this.extractSubcategoryIdentifiers(product).includes(target);
  }

  private extractSubcategoryIdentifiers(product: any): string[] {
    const fields = [
      product?.subCategoryId,
      product?.subCategory?._id,
      product?.subCategory?.name,
      product?.subcategoryId,
      product?.subcategory?._id,
      product?.subcategory?.name,
      product?.subCategoryName,
      product?.subcategoryName,
    ];
    return fields
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter((value) => value.length > 0);
  }


  trackById = (_: number, value: any): string => this.idOf(value);
  trackBySubcategory = (_: number, value: any): string => this.idOf(value);

  idOf(value: any): string {
    return value?._id !== undefined && value?._id !== null ? String(value._id) : String(value || '');
  }

  qtyFor(product: any): number {
    const pid = this.idOf(product);
    return this.cartByProduct.get(pid)?.quantity ?? 0;
  }

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
