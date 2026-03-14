import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  user: any = null;
  addresses: any[] = [];

  userId = '';
  phone = '';

  street = '';
  city = '';
  state = '';
  country = '';
  editingAddressId = '';

  isSavingAddress = false;
  addressMessage = '';
  isDeletingId = '';

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
    this.phone = this.auth.getPhone() || '';
    this.load();
  }

  load(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.addressMessage = '';

    this.api
      .getUser(this.userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (u) => (this.user = u),
        error: () => (this.errorMessage = 'Failed to load user.'),
      });

    this.api.getUserAddressesByUser(this.userId).subscribe({
      next: (rows) => {
        this.addresses = rows || [];
      },
      error: () => {},
    });
  }

  startEdit(address: any): void {
    this.addressMessage = '';
    this.editingAddressId = String(address?._id || '');
    this.street = String(address?.street || '');
    this.city = String(address?.city || '');
    this.state = String(address?.state || '');
    this.country = String(address?.country || '');
  }

  cancelEdit(): void {
    this.editingAddressId = '';
    this.street = '';
    this.city = '';
    this.state = '';
    this.country = '';
  }

  saveAddress(): void {
    if (!this.userId) return;

    this.addressMessage = '';
    const payload = {
      userId: this.userId,
      street: this.street.trim(),
      city: this.city.trim(),
      state: this.state.trim() || undefined,
      country: this.country.trim(),
      isActive: true,
    };

    if (!payload.street || !payload.city || !payload.country) {
      this.addressMessage = 'Street, city, and country are required.';
      return;
    }

    this.isSavingAddress = true;

    const req$ = this.editingAddressId
      ? this.api.updateUserAddress(this.editingAddressId, payload)
      : this.api.createUserAddress(payload);

    req$.pipe(finalize(() => (this.isSavingAddress = false))).subscribe({
      next: () => {
        const wasEdit = !!this.editingAddressId;
        this.cancelEdit();
        this.addressMessage = wasEdit ? 'Address updated.' : 'Address saved.';
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.addressMessage = msg ? String(msg) : 'Failed to save address.';
      },
    });
  }

  deleteAddress(address: any): void {
    const id = String(address?._id || '').trim();
    if (!id) return;

    this.isDeletingId = id;
    this.addressMessage = '';
    this.api
      .deleteUserAddress(id)
      .pipe(finalize(() => (this.isDeletingId = '')))
      .subscribe({
        next: () => {
          if (this.editingAddressId === id) this.cancelEdit();
          this.addressMessage = 'Address deleted.';
          this.load();
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.addressMessage = msg ? String(msg) : 'Failed to delete address.';
        },
      });
  }
}
