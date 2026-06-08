---
name: dotnet-docs
description: 'Add XML documentation comments to C# public and internal types and members following summary/param/returns/remarks conventions.'
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Add XML documentation comments to C# types and members.

## Rules

### All APIs
- `<summary>`: one sentence, present-tense third-person verb (e.g., "Gets the user by identifier.")
- `<remarks>`: additional context, usage notes, or implementation details
- Do not document the obvious — add value, not noise

### Methods
```csharp
/// <summary>Retrieves the user with the specified identifier.</summary>
/// <param name="id">The unique identifier of the user.</param>
/// <param name="cancellationToken">Token to cancel the operation.</param>
/// <returns>The user, or <see langword="null"/> if not found.</returns>
/// <exception cref="ArgumentNullException"><paramref name="id"/> is <see langword="null"/>.</exception>
```

### Properties
```csharp
/// <summary>Gets or sets the display name of the user.</summary>
```

### Classes/Interfaces
```csharp
/// <summary>Provides operations for managing user accounts.</summary>
```

## Steps
1. Identify all public (and internal if requested) types/members missing documentation
2. Add XML comments — prioritize public surface area first
3. Ensure every `<param>` and `<exception>` tag matches actual signature
4. Do not remove existing comments unless incorrect
