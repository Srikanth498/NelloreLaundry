using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 1. SETUP AUTHENTICATION (JWT)
var jwtSecret = builder.Configuration["Security:JwtSecret"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
    options.AddPolicy("AllowPOS", policy => 
        policy.WithOrigins("http://localhost:4200").AllowAnyMethod().AllowAnyHeader()));

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => 
    options.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure(5, TimeSpan.FromSeconds(5), null)));

var app = builder.Build();

// 2. EF CORE MIGRATIONS (Replaces EnsureCreated)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate(); // Applies actual migrations instead of blind table creation
    
    if (!db.Services.Any())
    {
        db.Services.AddRange(
            new LaundryService { Name = "Wash & Fold", PricePerKg = 60 },
            new LaundryService { Name = "Wash & Iron", PricePerKg = 80 },
            new LaundryService { Name = "Dry Cleaning", PricePerKg = 110 }
        );
        db.SaveChanges();
    }
}

app.UseCors("AllowPOS");
app.UseAuthentication();
app.UseAuthorization();

// 3. SECURE AUTH ENDPOINT
app.MapPost("/api/auth/login", (LoginRequest req, IConfiguration config) =>
{
    if (req.Pin != config["Security:AdminPin"]) return Results.Unauthorized();
    
    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, "Admin") }),
        Expires = DateTime.UtcNow.AddHours(12),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)), SecurityAlgorithms.HmacSha256Signature)
    };
    
    var tokenHandler = new JwtSecurityTokenHandler();
    var token = tokenHandler.CreateToken(tokenDescriptor);
    return Results.Ok(new { token = tokenHandler.WriteToken(token) });
});

// 4. SECURED BUSINESS ENDPOINTS (Notice .RequireAuthorization())
app.MapGet("/api/services", async (AppDbContext db) => await db.Services.ToListAsync()).RequireAuthorization();
app.MapPost("/api/services", async (LaundryService newService, AppDbContext db) => { db.Services.Add(newService); await db.SaveChangesAsync(); return Results.Ok(newService); }).RequireAuthorization();
app.MapPut("/api/services/{id}", async (int id, LaundryService updatedService, AppDbContext db) => { var s = await db.Services.FindAsync(id); if (s == null) return Results.NotFound(); s.Name = updatedService.Name; s.PricePerKg = updatedService.PricePerKg; await db.SaveChangesAsync(); return Results.Ok(s); }).RequireAuthorization();
app.MapDelete("/api/services/{id}", async (int id, AppDbContext db) => { var s = await db.Services.FindAsync(id); if (s == null) return Results.NotFound(); db.Services.Remove(s); await db.SaveChangesAsync(); return Results.Ok(); }).RequireAuthorization();

app.MapGet("/api/orders", async (AppDbContext db) => await db.Orders.Include(o => o.Items).OrderByDescending(o => o.OrderDate).ToListAsync()).RequireAuthorization();
app.MapPut("/api/orders/{id}/status", async (int id, StatusUpdate req, AppDbContext db) => { var order = await db.Orders.FindAsync(id); if (order == null) return Results.NotFound(); order.Status = req.Status; await db.SaveChangesAsync(); return Results.Ok(); }).RequireAuthorization();

// ZERO-TRUST ORDER CREATION
app.MapPost("/api/orders", async (OrderRequest incomingOrder, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(incomingOrder.CustomerName) || string.IsNullOrWhiteSpace(incomingOrder.CustomerPhone)) return Results.BadRequest(new { message = "Customer details required." });
    var serviceIds = incomingOrder.Items.Select(i => i.ServiceId).ToList();
    var officialServices = await db.Services.Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

    var newOrder = new Order { CustomerName = incomingOrder.CustomerName, CustomerPhone = incomingOrder.CustomerPhone, TotalAmount = 0 };
    foreach (var itemReq in incomingOrder.Items)
    {
        if (!officialServices.TryGetValue(itemReq.ServiceId, out var svc)) return Results.BadRequest(new { message = "Invalid Service ID" });
        newOrder.Items.Add(new OrderItem { Name = svc.Name, PricePerKg = svc.PricePerKg, Quantity = itemReq.Quantity });
        newOrder.TotalAmount += (svc.PricePerKg * itemReq.Quantity);
    }
    db.Orders.Add(newOrder); await db.SaveChangesAsync();
    return Results.Ok(new { message = "Order successfully saved." });
}).RequireAuthorization();

app.Run();

public record StatusUpdate(string Status);
public record LoginRequest(string Pin);
public record OrderItemRequest(int ServiceId, decimal Quantity);
public record OrderRequest(string CustomerName, string CustomerPhone, OrderItemRequest[] Items);