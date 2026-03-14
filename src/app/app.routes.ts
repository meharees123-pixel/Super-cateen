import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { storeSelectedGuard } from './services/store-selected.guard';
import { LoginComponent } from './pages/login/login.component';
import { StoreSelectComponent } from './pages/store-select/store-select.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SearchComponent } from './pages/search/search.component';
import { CartComponent } from './pages/cart/cart.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ProfileComponent } from './pages/profile/profile.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'stores', component: StoreSelectComponent, canActivate: [authGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard, storeSelectedGuard] },
  { path: 'search', component: SearchComponent, canActivate: [authGuard, storeSelectedGuard] },
  { path: 'cart', component: CartComponent, canActivate: [authGuard, storeSelectedGuard] },
  { path: 'orders', component: OrdersComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
