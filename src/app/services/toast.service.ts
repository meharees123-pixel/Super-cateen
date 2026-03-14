import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';
export type Toast = { id: string; type: ToastType; message: string };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);

  toasts(): Toast[] {
    return this._toasts();
  }

  info(message: string): void {
    this.push({ type: 'info', message });
  }

  success(message: string): void {
    this.push({ type: 'success', message });
  }

  error(message: string): void {
    this.push({ type: 'error', message });
  }

  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(input: { type: ToastType; message: string }): void {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, type: input.type, message: input.message };
    this._toasts.update((list) => [toast, ...list].slice(0, 5));
    setTimeout(() => this.dismiss(id), 3500);
  }
}

