# Collections

Collections are a powerful tool in this repository to bundle related **Agents**, **Instructions**, and **Prompts** and simplify their synchronization.

## What is a Collection?

A collection is a YAML-based definition that groups a set of templates typically needed together for a specific technology stack or use case (e.g., "C# .NET Development").

### Benefits of Collections

- 📦 **Bundling**: Instead of listing many individual files in your synchronization configuration, you simply specify a collection.
- 🔗 **Relationships**: Collections ensure that related components (e.g., an instruction for C# coding standards and a prompt for C# code reviews) are delivered together.
- 📖 **Documentation**: Each collection automatically generates a Markdown overview listing all included items with their descriptions.

## How it Works

Collections consist of two parts:

1. **Definition (`.collection.yml`)**: A file in the `templates/collections/` folder containing metadata (ID, name, description, tags) and a list of included items (`path` and `kind`).
2. **Documentation (`.md`)**: An automatically generated Markdown file optimized for display in the documentation.

### Example Definition

```yaml
id: csharp-dotnet-development
name: C# .NET Development
description: Essential prompts and instructions for C# development.
items:
  - path: instructions/csharp.instructions.md
    kind: instruction
  - path: prompts/csharp-code-review.prompt.md
    kind: prompt
  - path: agents/csharp-expert.agent.md
    kind: agent
```

## Synchronization with Collections

The main advantage of collections lies in their integration with the [Shared Configuration Sync](../sync/shared-config-sync.md). If you specify a collection in your `sync-config.json`, **all files defined in the collection** are automatically downloaded.

For more information on setup, see the section [Synchronization with Collections](../sync/shared-config-sync.md#synchronization-with-collections).
