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
  services: any[] = [];
  cart: any[] = [];
  
  customerPhone: string = '';
  customerName: string = '';

  constructor() {
    this.http.get<any[]>('http://localhost:5168/api/services').subscribe(data => {
      this.services = data;
    });
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

  // --- NEW: SEND ORDER TO BACKEND ---
  processOrder() {
    const orderPayload = {
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      totalAmount: this.cartTotal,
      items: this.cart
    };

    // Fire the POST request to C#
    this.http.post('http://localhost:5168/api/orders', orderPayload).subscribe({
      next: (response: any) => {
        alert(response.message); // Show success popup
        // Clear the cart for the next customer
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
}