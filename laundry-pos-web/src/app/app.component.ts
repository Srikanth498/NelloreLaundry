import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';

export interface LaundryService { id: number; name: string; pricePerKg: number; }
export interface CartItem extends LaundryService { quantity: number; }
export interface Order { id: number; customerName: string; customerPhone: string; totalAmount: number; orderDate: string; status: string; items: any[]; }

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
  
  orderHistory: Order[] = [];
  services: LaundryService[] = [];
  cart: CartItem[] = [];
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
    // Replaced <any[]> with <LaundryService[]>
    this.http.get<LaundryService[]>(`${this.apiUrl}/services`).subscribe({
      next: (data) => this.services = data,
      error: () => this.showToast('Session expired. Please login again.', 'error')
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      // Replaced <any[]> with <Order[]>
      this.http.get<Order[]>(`${this.apiUrl}/orders`).subscribe(data => this.orderHistory = data);
    }
  }

  addToCart(service: LaundryService) {
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

  updateStatus(order: Order, newEvent: Event) {
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

  updateService(service: LaundryService) {
    this.http.put(`${this.apiUrl}/services/${service.id}`, service).subscribe(() => this.showToast('Service updated'));
  }

  deleteService(id: number) {
    if(confirm('Delete this service?')) {
      this.http.delete(`${this.apiUrl}/services/${id}`).subscribe(() => {
        this.loadServices(); this.showToast('Service deleted');
      });
    }
  }

  printReceipt(order: Order) {
    // Basic sanitization to prevent HTML injection (XSS)
    const escapeHtml = (unsafe: string) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    
    const safeName = escapeHtml(order.customerName);
    const safePhone = escapeHtml(order.customerPhone);

    const printContent = `
      <div style="width: 300px; font-family: monospace; padding: 10px; color: black;">
        <h2 style="text-align: center; margin: 0;">NELLORE LAUNDRY</h2>
        <p style="text-align: center; margin: 5px 0; font-size: 12px;">Nellore, Andhra Pradesh<br>Ph: +91 99999 99999</p>
        <hr style="border-top: 1px dashed black;">
        <p style="font-size: 14px; margin: 5px 0;"><strong>Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
        <p style="font-size: 14px; margin: 5px 0;"><strong>Customer:</strong> ${safeName}</p>
        <p style="font-size: 14px; margin: 5px 0;"><strong>Phone:</strong> ${safePhone}</p>
        <hr style="border-top: 1px dashed black;">
        <table style="width: 100%; text-align: left; font-size: 14px; margin-bottom: 10px;">
          <tr><th style="padding-bottom: 5px;">Item</th><th style="padding-bottom: 5px;">Qty</th></tr>
          ${order.items.map((i: any) => `<tr><td style="padding-bottom: 5px;">${escapeHtml(i.name)}</td><td style="padding-bottom: 5px;">${i.quantity}kg</td></tr>`).join('')}
        </table>
        <hr style="border-top: 1px dashed black;">
        <h3 style="text-align: right; margin: 10px 0;">TOTAL: ₹${order.totalAmount.toFixed(2)}</h3>
      </div>
    `;

    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write('<html><body style="margin:0;">' + printContent + '</body></html>');
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
  }
}