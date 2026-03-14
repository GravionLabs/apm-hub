---
agent: 'agent'
tools: ['changes', 'search/codebase', 'edit/editFiles', 'problems']
description: 'Create ASP.NET Minimal API endpoints using Carter with proper OpenAPI documentation'
---

# ASP.NET Minimal API with OpenAPI and Carter

Your goal is to help me create well-structured ASP.NET Minimal API endpoints using Carter with correct types and comprehensive OpenAPI/Swagger documentation.

## API Organization

- Use Carter for endpoint organization by implementing `ICarterModule`
- Register Carter in `Program.cs` using `builder.Services.AddCarter()` and `app.MapCarter()`
- Group related endpoints within a single module class
- Leverage Carter's support for `MapGroup()` within modules for better structure
- Use endpoint filters for cross-cutting concerns within Carter modules
- Structure larger APIs with separate `ICarterModule` implementations in a `Modules` folder
- Consider using a feature-based folder structure where each feature has its own Carter module

## Request and Response Types

- Define explicit request and response DTOs/models
- Create clear model classes with proper validation attributes
- Use record types for immutable request/response objects
- Use meaningful property names that align with API design standards
- Apply `[Required]` and other validation attributes to enforce constraints
- Use the ProblemDetailsService and StatusCodePages to get standard error responses

## Type Handling

- Use strongly-typed route parameters with explicit type binding
- Use `Results<T1, T2>` to represent multiple response types
- Return `TypedResults` instead of `Results` for strongly-typed responses
- Leverage C# 10+ features like nullable annotations and init-only properties

## OpenAPI Documentation

- Use the built-in OpenAPI document support added in .NET 9
- Define operation summary and description
- Add operationIds using the `WithName` extension method
- Add descriptions to properties and parameters with `[Description()]`
- Set proper content types for requests and responses
- Use document transformers to add elements like servers, tags, and security schemes
- Use schema transformers to apply customizations to OpenAPI schemas
