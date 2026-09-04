import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  http = inject(HttpClient);
  apiUrl = environment.apiUrl;
  
  isAuthenticated = false;
  pinCode = '';
  activeTab = 'pos'; 
  
  orderHistory: any[] = [];
  services: any[] = [];
  cart: any[] = [];
  customerPhone = '';
  customerName = '';
  newServiceName = '';
  newServicePrice: number | null = null;
  toasts: { message: string, type: 'success' | 'error' }[] = [];

  ngOnInit() {
    if (localStorage.getItem('jwt_token')) {
      this.isAuthenticated = true;
      this.loadServices();
    }
  }

  showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toasts.push({ message, type });
    setTimeout(() => this.toasts.shift(), 3000);
  }

  login() {
    this.http.post(`${this.apiUrl}/auth/login`, { pin: this.pinCode }).subscribe({
      next: (res: any) => {
        localStorage.setItem('jwt_token', res.token);
        this.isAuthenticated = true;
        this.pinCode = '';
        this.loadServices();
        this.showToast('Login successful');
      },
      error: () => {
        this.showToast('Invalid PIN Code', 'error');
        this.pinCode = '';
      }
    });
  }

  logout() {
    localStorage.removeItem('jwt_token');
    this.isAuthenticated = false;
    this.activeTab = 'pos';
    this.showToast('Logged out');
  }

  loadServices() {
    this.http.get<any[]>(`${this.apiUrl}/services`).subscribe({
      next: (data) => this.services = data,
      error: () => this.showToast('Session expired. Please login again.', 'error')
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      this.http.get<any[]>(`${this.apiUrl}/orders`).subscribe(data => this.orderHistory = data);
    }
  }

  addToCart(service: any) {
    const existingItem = this.cart.find(item => item.id === service.id);
    if (existingItem) existingItem.quantity += 1;
    else this.cart.push({ ...service, quantity: 1 }); 
  }

  removeItem(index: number) { this.cart.splice(index, 1); }
  
  get cartTotal() { return this.cart.reduce((total, item) => total + (item.pricePerKg * item.quantity), 0); }

  processOrder() {
    const payload = {
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      items: this.cart.map(i => ({ serviceId: i.id, quantity: i.quantity }))
    };

    this.http.post(`${this.apiUrl}/orders`, payload).subscribe({
      next: () => {
        this.showToast('Order processed successfully!');
        this.cart = []; this.customerName = ''; this.customerPhone = '';
        if (this.activeTab === 'dashboard') this.switchTab('dashboard');
      },
      error: (err) => this.showToast(err.error?.message || 'Error processing order', 'error')
    });
  }

  updateStatus(order: any, newEvent: Event) {
    const newStatus = (newEvent.target as HTMLSelectElement).value;
    this.http.put(`${this.apiUrl}/orders/${order.id}/status`, { status: newStatus }).subscribe({
      next: () => { order.status = newStatus; this.showToast('Status updated'); },
      error: () => { this.showToast('Update failed', 'error'); (newEvent.target as HTMLSelectElement).value = order.status; }
    });
  }

  addService() {
    this.http.post(`${this.apiUrl}/services`, { name: this.newServiceName, pricePerKg: this.newServicePrice }).subscribe(() => {
      this.loadServices();
      this.newServiceName = ''; this.newServicePrice = null;
      this.showToast('Service added');
    });
  }

  updateService(service: any) {
    this.http.put(`${this.apiUrl}/services/${service.id}`, service).subscribe(() => this.showToast('Service updated'));
  }

  deleteService(id: number) {
    if(confirm('Delete this service?')) {
      this.http.delete(`${this.apiUrl}/services/${id}`).subscribe(() => {
        this.loadServices(); this.showToast('Service deleted');
      });
    }
  }

  printReceipt(order: any) { /* Keep existing print logic */ }
}