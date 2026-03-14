import { Injectable, Inject, PLATFORM_ID, computed, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TOKEN_KEY = 'super_cateen_token';
const USER_ID_KEY = 'super_cateen_user_id';
const PHONE_KEY = 'super_cateen_phone';
const STORE_ID_KEY = 'super_cateen_store_id';
const STORE_NAME_KEY = 'super_cateen_store_name';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(null);
  readonly userId = signal<string | null>(null);
  readonly phone = signal<string | null>(null);
  readonly storeId = signal<string | null>(null);
  readonly storeName = signal<string | null>(null);

  readonly isLoggedInSignal = computed(() => !!this.token() && !!this.userId());

  private readonly memory = new Map<string, string>();

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {
    // Initialize signals from storage once on app bootstrap.
    this.token.set(this.getItem(TOKEN_KEY));
    this.userId.set(this.getItem(USER_ID_KEY));
    this.phone.set(this.getItem(PHONE_KEY));
    this.storeId.set(this.getItem(STORE_ID_KEY));
    this.storeName.set(this.getItem(STORE_NAME_KEY));
  }

  private getItem(key: string): string | null {
    if (isPlatformBrowser(this.platformId)) return localStorage.getItem(key);
    return this.memory.get(key) ?? null;
  }

  private setItem(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
      return;
    }
    this.memory.set(key, value);
  }

  private removeItem(key: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(key);
      return;
    }
    this.memory.delete(key);
  }

  getToken(): string | null {
    return this.token();
  }

  setToken(token: string): void {
    this.setItem(TOKEN_KEY, token);
    this.token.set(token);
  }

  getUserId(): string | null {
    return this.userId();
  }

  setUserId(userId: string): void {
    this.setItem(USER_ID_KEY, userId);
    this.userId.set(userId);
  }

  getPhone(): string | null {
    return this.phone();
  }

  setPhone(phone: string): void {
    this.setItem(PHONE_KEY, phone);
    this.phone.set(phone);
  }

  getStoreId(): string | null {
    return this.storeId();
  }

  setStore(id: string, name?: string): void {
    this.setItem(STORE_ID_KEY, id);
    this.storeId.set(id);
    if (name) {
      this.setItem(STORE_NAME_KEY, name);
      this.storeName.set(name);
    }
  }

  clearStore(): void {
    this.removeItem(STORE_ID_KEY);
    this.removeItem(STORE_NAME_KEY);
    this.storeId.set(null);
    this.storeName.set(null);
  }

  getStoreName(): string | null {
    return this.storeName();
  }

  isLoggedIn(): boolean {
    return this.isLoggedInSignal();
  }

  clear(): void {
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_ID_KEY);
    this.removeItem(PHONE_KEY);
    this.token.set(null);
    this.userId.set(null);
    this.phone.set(null);
    this.clearStore();
  }
}
