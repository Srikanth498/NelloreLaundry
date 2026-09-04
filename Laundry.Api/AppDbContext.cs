using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // These represent your actual database tables
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
}

// Table 1: The main receipt
public class Order
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public decimal TotalAmount { get; set; }
    public DateTime OrderDate { get; set; } = DateTime.Now;
    
    // Tracks where the clothes are in the laundry process
    public string Status { get; set; } = "Received";
    
    // Links to the specific clothes in this order
    public List<OrderItem> Items { get; set; } = new();
}

// Table 2: The specific clothes in the order
public class OrderItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal PricePerKg { get; set; }
    public decimal Quantity { get; set; }
    
    // The foreign key linking back to the main receipt
    public int OrderId { get; set; }
}