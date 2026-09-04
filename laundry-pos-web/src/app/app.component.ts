import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';
import Chart from 'chart.js/auto';

export interface LaundryService { id: number; name: string; pricePerKg: number; }
export interface CartItem extends LaundryService { quantity: number; }
export interface OrderItem { id: number; name: string; pricePerKg: number; quantity: number; orderId: number; }
export interface Order { id: number; customerName: string; customerPhone: string; totalAmount: number; orderDate: string; status: string; items: OrderItem[]; }

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

  chartInstance: any;
  todayRevenue = 0;
  pendingOrders = 0;
  completedOrders = 0;

  amountTendered: number | null = null;

  ngOnInit() {
    if (localStorage.getItem('jwt_token')) {
      this.isAuthenticated = true;
      this.loadServices();
    }
  }

  get changeDue() {
    return this.amountTendered !== null ? this.amountTendered - this.cartTotal : 0;
  }

  setTender(amount: number) {
    this.amountTendered = amount === 0 ? this.cartTotal : amount;
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
      this.http.get<Order[]>(`${this.apiUrl}/orders`).subscribe(data => {
        this.orderHistory = data;
        this.calculateAnalytics();
      });
    }
  }

  calculateAnalytics() {
    const today = new Date().toDateString();
    this.todayRevenue = this.orderHistory
      .filter(o => new Date(o.orderDate).toDateString() === today)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    this.pendingOrders = this.orderHistory.filter(o => o.status !== 'Completed').length;
    this.completedOrders = this.orderHistory.filter(o => o.status === 'Completed').length;

    // Wait 1 tick for Angular to render the canvas element before drawing the chart
    setTimeout(() => this.renderChart(), 0); 
  }

  renderChart() {
    const ctx = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.chartInstance) this.chartInstance.destroy();

    // Group revenue by date (process in chronological order)
    const revByDate: { [key: string]: number } = {};
    [...this.orderHistory].reverse().forEach(o => {
      const date = new Date(o.orderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      revByDate[date] = (revByDate[date] || 0) + o.totalAmount;
    });

    const labels = Object.keys(revByDate).slice(-7); // Last 7 days
    const data = Object.values(revByDate).slice(-7);

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: data,
          borderColor: '#3b82f6', 
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4, // Creates the smooth curve
          fill: true,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, border: { dash: [4, 4] }, grid: { color: '#f1f5f9' } },
          x: { border: { display: false }, grid: { display: false } }
        }
      }
    });
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
      next: () => { 
        order.status = newStatus; 
        
        // NEW: Force the dashboard cards to recount immediately
        this.calculateAnalytics(); 
        
        this.showToast('Status updated'); 
      },
      error: () => { 
        this.showToast('Update failed', 'error'); 
        (newEvent.target as HTMLSelectElement).value = order.status; 
      }
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
          ${order.items.map((i: OrderItem) => `<tr><td style="padding-bottom: 5px;">${escapeHtml(i.name)}</td><td style="padding-bottom: 5px;">${i.quantity}kg</td></tr>`).join('')}
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