import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  http = inject(HttpClient);
  
  // NEW: Tab Navigation State
  activeTab = 'pos'; 
  orderHistory: any[] = [];

  services: any[] = [];
  cart: any[] = [];
  customerPhone: string = '';
  customerName: string = '';

  constructor() {
    this.http.get<any[]>('http://localhost:5168/api/services').subscribe(data => {
      this.services = data;
    });
  }

  // NEW: Switch tabs and fetch data if opening dashboard
  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      this.http.get<any[]>('http://localhost:5168/api/orders').subscribe(data => {
        this.orderHistory = data;
      });
    }
  }

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
      error: (err) => {
        alert('Error saving the order!');
        console.error(err);
      }
    });
  }

  updateStatus(order: any, newEvent: Event) {
    const selectElement = newEvent.target as HTMLSelectElement;
    const newStatus = selectElement.value;

    // Send as a proper JSON object
    this.http.put(`http://localhost:5168/api/orders/${order.id}/status`, { status: newStatus }).subscribe({
      next: () => {
        order.status = newStatus;
      },
      error: (err) => {
        alert('Failed to update status!');
        console.error(err);
        // Revert the dropdown if the database fails
        selectElement.value = order.status; 
      }
    });
  }

  printReceipt(order: any) {
    // Generates a layout optimized for 80mm thermal printers
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
          <tr>
            <th style="padding-bottom: 5px;">Item</th>
            <th style="padding-bottom: 5px;">Qty</th>
          </tr>
          ${order.items.map((i: any) => `
            <tr>
              <td style="padding-bottom: 5px;">${i.name}</td>
              <td style="padding-bottom: 5px;">${i.quantity}kg</td>
            </tr>
          `).join('')}
        </table>
        <hr style="border-top: 1px dashed black;">
        <h3 style="text-align: right; margin: 10px 0;">TOTAL: ₹${order.totalAmount.toFixed(2)}</h3>
        <p style="text-align: center; font-size: 12px; margin-top: 20px;">Thank you for your business!</p>
      </div>
    `;

    // Opens a hidden window, writes the receipt, and triggers the print dialog
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Receipt</title></head><body style="margin:0;">');
      printWindow.document.write(printContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      // Wait a fraction of a second for the window to render before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }
}