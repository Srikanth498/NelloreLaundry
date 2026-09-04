using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    
    // NEW: The dynamic catalog table
    public DbSet<LaundryService> Services { get; set; }
}

public class LaundryService
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    
    [Precision(18, 2)]
    public decimal PricePerKg { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    
    [Precision(18, 2)]
    public decimal TotalAmount { get; set; }
    
    public DateTime OrderDate { get; set; } = DateTime.Now;
    public string Status { get; set; } = "Received";
    public List<OrderItem> Items { get; set; } = new();
}

public class OrderItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    
    [Precision(18, 2)]
    public decimal PricePerKg { get; set; }
    
    [Precision(18, 2)]
    public decimal Quantity { get; set; }
    
    public int OrderId { get; set; }
}