import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Keep this aligned with your Nest API.
  readonly baseUrl = 'http://localhost:3000';
   // private baseUrl = 'http://34.56.150.67:3000';

  constructor(private readonly http: HttpClient) {}

  loginInfo(mobileNumber: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/firebase-login-info`, { mobileNumber });
  }

  getStores(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/stores`);
  }

  getDashboardCategories(storeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories/dashboard-categories/${storeId}`);
  }

  getDashboardProducts(storeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories/dashboard-products/${storeId}`);
  }

  getDashboardCategoriesDebug(storeId: string): Observable<any> {
    const params = new HttpParams().set('debug', '1');
    return this.http.get<any>(`${this.baseUrl}/categories/dashboard-categories/${storeId}`, { params });
  }

  getDashboardProductsDebug(storeId: string): Observable<any> {
    const params = new HttpParams().set('debug', '1');
    return this.http.get<any>(`${this.baseUrl}/categories/dashboard-products/${storeId}`, { params });
  }

  getCategoriesByStore(storeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories/store/${storeId}`);
  }

  getSubcategoriesByCategoryId(categoryId: string): Observable<any[]> {
    const encoded = encodeURIComponent(categoryId || '');
    return this.http.get<any[]>(`${this.baseUrl}/subcategories/category/${encoded}`);
  }

  getDeliveryLocationsByStore(storeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/delivery-locations/store/${storeId}`);
  }

  getDeliveryLocation(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/delivery-locations/${id}`);
  }

  searchProducts(params: { q: string; storeId?: string; limit?: number; skip?: number }): Observable<any[]> {
    const { q, storeId, limit = 25, skip = 0 } = params;
    let httpParams = new HttpParams().set('q', q).set('limit', String(limit)).set('skip', String(skip));
    if (storeId) httpParams = httpParams.set('storeId', storeId);
    return this.http.get<any[]>(`${this.baseUrl}/products/search`, { params: httpParams });
  }

  getProduct(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/products/${id}`);
  }

  // Cart
  getCartByUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/cart/user/${userId}`);
  }

  getCartCount(userId: string, storeId: string): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/cart/count/user/${userId}/store/${storeId}`);
  }

  addToCart(payload: {
    userId: string;
    storeId: string;
    productId: string;
    quantity: number;
    addressId?: string;
    userAddressId?: string;
    deliveryLocationId?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/cart`, payload);
  }

  updateCartItem(id: string, payload: {
    userId: string;
    storeId: string;
    productId: string;
    quantity: number;
    addressId?: string;
    userAddressId?: string;
    deliveryLocationId?: string;
  }): Observable<any> {
    return this.http.put(`${this.baseUrl}/cart/${id}`, payload);
  }

  deleteCartItem(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/cart/${id}`);
  }

  updateCartAddressForUserStore(userId: string, storeId: string, addressId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/cart/user/${userId}/store/${storeId}/address`, { addressId });
  }

  updateCartDeliveryForUserStore(params: {
    userId: string;
    storeId: string;
    userAddressId: string;
    deliveryLocationId: string;
  }): Observable<any> {
    return this.http.put(`${this.baseUrl}/cart/user/${params.userId}/store/${params.storeId}/address`, {
      userAddressId: params.userAddressId,
      deliveryLocationId: params.deliveryLocationId,
    });
  }

  // Profile / addresses
  getUser(userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${userId}`);
  }

  getUserAddressesByUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/user-addresses/user/${userId}`);
  }

  createUserAddress(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user-addresses`, payload);
  }

  updateUserAddress(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/user-addresses/${id}`, payload);
  }

  deleteUserAddress(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/user-addresses/${id}`);
  }

  // Orders
  createOrderFromCart(payload: { userId: string; userAddressId: string; deliveryLocationId: string; storeId: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders`, payload);
  }

  getOrdersByUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders/user/${userId}`);
  }

  getOrder(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders/${id}`);
  }
}
