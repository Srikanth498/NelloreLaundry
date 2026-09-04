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

// 1. Tell C# to use SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=sqlserver;Database=LaundryDb;User Id=sa;Password=NelloreLaundry@123;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options => 
    options.UseSqlServer(connectionString));

var app = builder.Build();

// 2. Automatically create the SQL Server database and tables on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();       
}

app.UseCors("AllowPOS");
app.UseHttpsRedirection();

app.MapGet("/api/services", () =>
{
    return new object[]
    {
        new { Id = 1, Name = "Wash & Fold", PricePerKg = 50 },
        new { Id = 2, Name = "Wash & Iron", PricePerKg = 80 },
        new { Id = 3, Name = "Dry Cleaning", PricePerKg = 150 }
    };
});

// 3. Catch the order and save it to SQL Server
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

app.Run();

// --- DATA SHAPES ---
public record OrderItemDto(int Id, string Name, decimal PricePerKg, decimal Quantity);
public record OrderRequest(string CustomerName, string CustomerPhone, decimal TotalAmount, OrderItemDto[] Items);