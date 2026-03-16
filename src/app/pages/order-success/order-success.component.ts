import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-success.component.html',
  styleUrl: './order-success.component.scss',
})
export class OrderSuccessComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  order: any | null = null;

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

    this.fetch(orderId);
  }

  viewOrder(): void {
    if (!this.order?._id) return;
    this.router.navigateByUrl(`/orders/${this.order._id}`);
  }

  private fetch(orderId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.order = null;

    this.api.getOrder(orderId).subscribe({
      next: (o) => {
        this.order = o;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'We could not load your order details.';
        this.isLoading = false;
      },
    });
  }
}
