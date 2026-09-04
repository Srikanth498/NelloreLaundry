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

var app = builder.Build();

app.UseCors("AllowPOS");
app.UseHttpsRedirection();

// --- SEND MENU TO POS ---
app.MapGet("/api/services", () =>
{
    return new object[]
    {
        new { Id = 1, Name = "Wash & Fold", PricePerKg = 50 },
        new { Id = 2, Name = "Wash & Iron", PricePerKg = 80 },
        new { Id = 3, Name = "Dry Cleaning", PricePerKg = 150 }
    };
});

// --- NEW: RECEIVE ORDER FROM POS ---
app.MapPost("/api/orders", (OrderRequest incomingOrder) =>
{
    // For now, we will print the order to your backend terminal
    Console.WriteLine($"\n✅ NEW ORDER RECEIVED!");
    Console.WriteLine($"Customer: {incomingOrder.CustomerName} ({incomingOrder.CustomerPhone})");
    Console.WriteLine($"Total Amount: Rs. {incomingOrder.TotalAmount}");
    
    // Tell the Angular frontend it was successful
    return new { message = "Order successfully received by the server!" };
});

app.Run();

// --- DATA SHAPES ---
public record OrderItem(int Id, string Name, decimal PricePerKg, decimal Quantity);
public record OrderRequest(string CustomerName, string CustomerPhone, decimal TotalAmount, OrderItem[] Items);