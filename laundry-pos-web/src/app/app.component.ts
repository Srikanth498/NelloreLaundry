import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  http = inject(HttpClient);
  
  activeTab = 'pos'; 
  orderHistory: any[] = [];
  services: any[] = [];
  cart: any[] = [];
  
  // Order State
  customerPhone: string = '';
  customerName: string = '';

  // Settings State
  newServiceName: string = '';
  newServicePrice: number | null = null;

  ngOnInit() {
    this.loadServices();
  }

  loadServices() {
    this.http.get<any[]>('http://localhost:5168/api/services').subscribe(data => {
      this.services = data;
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      this.http.get<any[]>('http://localhost:5168/api/orders').subscribe(data => {
        this.orderHistory = data;
      });
    }
  }

  // --- POS CART LOGIC ---
  addToCart(service: any) {
    const existingItem = this.cart.find(item => item.id === service.id);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({ ...service, quantity: 1 }); 
    }
  }

  removeItem(index: number) {
    this.cart.splice(index, 1);
  }

  get cartTotal() {
    return this.cart.reduce((total, item) => total + (item.pricePerKg * item.quantity), 0);
  }

  processOrder() {
    const orderPayload = {
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      totalAmount: this.cartTotal,
      items: this.cart
    };

    this.http.post('http://localhost:5168/api/orders', orderPayload).subscribe({
      next: (response: any) => {
        alert(response.message);
        this.cart = [];
        this.customerName = '';
        this.customerPhone = '';
      },
      error: (err) => alert('Error saving the order!')
    });
  }

  updateStatus(order: any, newEvent: Event) {
    const selectElement = newEvent.target as HTMLSelectElement;
    const newStatus = selectElement.value;

    this.http.put(`http://localhost:5168/api/orders/${order.id}/status`, { status: newStatus }).subscribe({
      next: () => order.status = newStatus,
      error: () => {
        alert('Failed to update status!');
        selectElement.value = order.status; 
      }
    });
  }

  printReceipt(order: any) {
    const printContent = `
      <div style="width: 300px; font-family: monospace; padding: 10px; color: black;">
        <h2 style="text-align: center; margin: 0;">NELLORE LAUNDRY</h2>
        <p style="text-align: center; margin: 5px 0; font-size: 12px;">Nellore, Andhra Pradesh<br>Ph: +91 99999 99999</p>
        <hr style="border-top: 1px dashed black;">
        <p style="font-size: 14px; margin: 5px 0;"><strong>Date:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
        <p style="font-size: 14px; margin: 5px 0;"><strong>Customer:</strong> ${order.customerName}</p>
        <p style="font-size: 14px; margin: 5px 0;"><strong>Phone:</strong> ${order.customerPhone}</p>
        <hr style="border-top: 1px dashed black;">
        <table style="width: 100%; text-align: left; font-size: 14px; margin-bottom: 10px;">
          <tr><th style="padding-bottom: 5px;">Item</th><th style="padding-bottom: 5px;">Qty</th></tr>
          ${order.items.map((i: any) => `<tr><td style="padding-bottom: 5px;">${i.name}</td><td style="padding-bottom: 5px;">${i.quantity}kg</td></tr>`).join('')}
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

  // --- NEW: DYNAMIC CATALOG LOGIC ---
  addService() {
    if (!this.newServiceName || !this.newServicePrice) return;
    this.http.post('http://localhost:5168/api/services', { name: this.newServiceName, pricePerKg: this.newServicePrice }).subscribe(() => {
      this.loadServices();
      this.newServiceName = '';
      this.newServicePrice = null;
    });
  }

  updateService(service: any) {
    this.http.put(`http://localhost:5168/api/services/${service.id}`, service).subscribe(() => {
      alert('Service updated successfully!');
    });
  }

  deleteService(id: number) {
    if(confirm('Are you sure you want to delete this service?')) {
      this.http.delete(`http://localhost:5168/api/services/${id}`).subscribe(() => {
        this.loadServices();
      });
    }
  }
}