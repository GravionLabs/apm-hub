---
name: dotnet-aspnet-minimal-api-openapi
description: 'Create an ASP.NET Core Minimal API endpoint module using Carter with full OpenAPI documentation, typed request/response models, and proper error responses.'
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Create ASP.NET Core Minimal API endpoint using Carter with OpenAPI documentation.

## Steps
1. Ask: route path, HTTP methods, request/response shape, authentication requirements
2. Create/update Carter module implementing `ICarterModule`:
   ```csharp
   public class <Feature>Module : ICarterModule
   {
       public void AddRoutes(IEndpointRouteBuilder app)
       {
           var group = app.MapGroup("/api/<feature>").WithTags("<Feature>");
           group.MapGet("/", Handle).WithName("<Name>").WithOpenApi();
       }
   }
   ```
3. Add typed request and response record types
4. Add OpenAPI metadata: `.WithSummary()`, `.WithDescription()`, `.Produces<T>()`, `.ProducesProblem()`
5. Register Carter in `Program.cs`: `builder.Services.AddCarter()` + `app.MapCarter()`
6. Add input validation (FluentValidation or Data Annotations)

## Constraints
- Use Carter for organization — not `app.MapGet` scattered in `Program.cs`
- All endpoints must have OpenAPI metadata and typed response types
- Use `TypedResults` (not `Results.Ok(...)`) for compile-time safety
