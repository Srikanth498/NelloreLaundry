using Microsoft.EntityFrameworkCore;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowPOS", policy => 
    {
        policy.WithOrigins("http://localhost:4200").AllowAnyMethod().AllowAnyHeader();
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=sqlserver;Database=LaundryDb;User Id=sa;Password=NelloreLaundry@123;TrustServerCertificate=True;";

// Tell C# to use SQL Server, and automatically retry if the database is asleep
builder.Services.AddDbContext<AppDbContext>(options => 
    options.UseSqlServer(connectionString, sqlOptions => 
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5, // Try 5 times
            maxRetryDelay: TimeSpan.FromSeconds(5), // Wait 5 seconds between tries
            errorNumbersToAdd: null);
    }));
var app = builder.Build();

// Auto-create database and seed default services if empty
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    
    if (!db.Services.Any())
    {
        db.Services.AddRange(
            new LaundryService { Name = "Wash & Fold", PricePerKg = 50 },
            new LaundryService { Name = "Wash & Iron", PricePerKg = 80 },
            new LaundryService { Name = "Dry Cleaning", PricePerKg = 150 }
        );
        db.SaveChanges();
    }
}

app.UseCors("AllowPOS");
app.UseHttpsRedirection();

// --- DYNAMIC CATALOG ENDPOINTS ---
app.MapGet("/api/services", async (AppDbContext db) => await db.Services.ToListAsync());

app.MapPost("/api/services", async (LaundryService newService, AppDbContext db) =>
{
    db.Services.Add(newService);
    await db.SaveChangesAsync();
    return Results.Ok(newService);
});

app.MapPut("/api/services/{id}", async (int id, LaundryService updatedService, AppDbContext db) =>
{
    var service = await db.Services.FindAsync(id);
    if (service == null) return Results.NotFound();
    
    service.Name = updatedService.Name;
    service.PricePerKg = updatedService.PricePerKg;
    await db.SaveChangesAsync();
    return Results.Ok(service);
});

app.MapDelete("/api/services/{id}", async (int id, AppDbContext db) =>
{
    var service = await db.Services.FindAsync(id);
    if (service == null) return Results.NotFound();
    
    db.Services.Remove(service);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// --- ORDER ENDPOINTS ---
app.MapGet("/api/orders", async (AppDbContext db) =>
    await db.Orders.Include(o => o.Items).OrderByDescending(o => o.OrderDate).ToListAsync());

app.MapPost("/api/orders", async (OrderRequest incomingOrder, AppDbContext db) =>
{
    var newOrder = new Order 
    {
        CustomerName = incomingOrder.CustomerName,
        CustomerPhone = incomingOrder.CustomerPhone,
        TotalAmount = incomingOrder.TotalAmount,
        Items = incomingOrder.Items.Select(i => new OrderItem 
        {
            Name = i.Name, PricePerKg = i.PricePerKg, Quantity = i.Quantity
        }).ToList()
    };
    db.Orders.Add(newOrder);
    await db.SaveChangesAsync();
    return new { message = "Order successfully saved to SQL Server!" };
});

app.MapPut("/api/orders/{id}/status", async (int id, StatusUpdate req, AppDbContext db) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();
    order.Status = req.Status;
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.Run();

// --- DATA SHAPES ---
public record StatusUpdate(string Status);
public record OrderItemDto(int Id, string Name, decimal PricePerKg, decimal Quantity);
public record OrderRequest(string CustomerName, string CustomerPhone, decimal TotalAmount, OrderItemDto[] Items);