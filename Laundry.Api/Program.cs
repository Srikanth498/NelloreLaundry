using Microsoft.EntityFrameworkCore;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowPOS", policy => 
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=sqlserver;Database=LaundryDb;User Id=sa;Password=NelloreLaundry@123;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options => 
    options.UseSqlServer(connectionString));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();       
}

app.UseCors("AllowPOS");
app.UseHttpsRedirection();

// --- POS MENU ---
app.MapGet("/api/services", () =>
{
    return new object[]
    {
        new { Id = 1, Name = "Wash & Fold", PricePerKg = 50 },
        new { Id = 2, Name = "Wash & Iron", PricePerKg = 80 },
        new { Id = 3, Name = "Dry Cleaning", PricePerKg = 150 }
    };
});

// --- NEW: FETCH ORDER HISTORY ---
app.MapGet("/api/orders", async (AppDbContext db) =>
{
    // Retrieves all orders, includes their specific laundry items, and sorts by newest first
    return await db.Orders.Include(o => o.Items).OrderByDescending(o => o.OrderDate).ToListAsync();
});

// --- SUBMIT NEW ORDER ---
app.MapPost("/api/orders", async (OrderRequest incomingOrder, AppDbContext db) =>
{
    var newOrder = new Order 
    {
        CustomerName = incomingOrder.CustomerName,
        CustomerPhone = incomingOrder.CustomerPhone,
        TotalAmount = incomingOrder.TotalAmount,
        Items = incomingOrder.Items.Select(i => new OrderItem 
        {
            Name = i.Name,
            PricePerKg = i.PricePerKg,
            Quantity = i.Quantity
        }).ToList()
    };
    
    db.Orders.Add(newOrder);
    await db.SaveChangesAsync();
    
    Console.WriteLine($"\n✅ SAVED TO SQL SERVER: {newOrder.CustomerName} - Rs. {newOrder.TotalAmount}");
    return new { message = "Order successfully saved to SQL Server!" };
});

// --- UPDATE ORDER STATUS ---
app.MapPut("/api/orders/{id}/status", async (int id, StatusUpdate req, AppDbContext db) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();
    
    order.Status = req.Status;
    await db.SaveChangesAsync();
    
    return Results.Ok(new { message = $"Order {id} status updated to {req.Status}" });
});

app.Run();

// --- DATA SHAPES ---
public record OrderItemDto(int Id, string Name, decimal PricePerKg, decimal Quantity);
public record OrderRequest(string CustomerName, string CustomerPhone, decimal TotalAmount, OrderItemDto[] Items);
public record StatusUpdate(string Status);