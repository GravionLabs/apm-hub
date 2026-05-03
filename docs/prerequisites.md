# Prerequisites for apm-hub Skills

This document outlines all software prerequisites required to use skills from the apm-hub repository.

---

## Overview

Skills in apm-hub are organized by their prerequisites:
- **CORE**: Required for all skills
- **RUNTIME**: Required for domain-specific skill ecosystems (Node.js, TypeScript, Python)
- **OPTIONAL**: Required only for specific skills

You can verify your environment with the [`check-prerequisites`](./check-prerequisites) skill.

---

## CORE Prerequisites

These are **required for all apm-hub skills**.

### PowerShell 7+

PowerShell is the primary shell for all apm-hub scripts and skills. Native PowerShell support is required.

| Requirement | Version |
|---|---|
| **Minimum** | PowerShell 7.0+ |
| **Recommended** | PowerShell 7.4+ |

#### Verify Installation

```powershell
pwsh --version
```

#### Installation

**Windows:**
```powershell
winget install Microsoft.PowerShell
```
Or download from [microsoft.com/powershell](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows)

**macOS:**
```bash
brew install powershell
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y powershell
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y powershell
```

---

### Git

Git is required for all version control and GitHub-related skills.

| Requirement | Version |
|---|---|
| **Minimum** | Git 2.30+ |
| **Recommended** | Git 2.40+ |

#### Verify Installation

```powershell
git --version
```

#### Installation

**Windows:**
```powershell
winget install Git.Git
```
Or download from [git-scm.com](https://git-scm.com/download/win)

**macOS:**
```bash
brew install git
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y git
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y git
```

---

## RUNTIME Prerequisites

These are required for domain-specific skill ecosystems.

### Node.js + npm (for TypeScript/Angular/JavaScript Skills)

Required if you use skills from the `typescript`, `angular`, or similar domains.

| Requirement | Version |
|---|---|
| **Minimum** | Node.js 18 LTS |
| **Recommended** | Node.js 20 LTS |

#### Verify Installation

```powershell
node --version
npm --version
```

#### Installation

**Windows:**
```powershell
winget install OpenJS.NodeJS
```
Or download from [nodejs.org](https://nodejs.org/)

**macOS:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y nodejs npm
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y nodejs
```

---

## OPTIONAL Prerequisites

These tools are needed only for specific skills. Install as required.

### GitHub CLI (`gh`)

Used by `github-*` skills for GitHub API access and pull request creation.

| Requirement | Version |
|---|---|
| **Minimum** | gh 2.0+ |

#### Verify Installation

```powershell
gh --version
```

#### Installation

**Windows:**
```powershell
winget install GitHub.cli
```

**macOS:**
```bash
brew install gh
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install -y gh

# Fedora/RHEL
sudo dnf install -y gh
```

#### Setup

After installation, authenticate with GitHub:
```powershell
gh auth login
```

---

### `curl`

Used for HTTP requests in various skills.

| Requirement | Version |
|---|---|
| **Minimum** | curl 7.0+ |

#### Verify Installation

```powershell
curl --version
```

#### Installation

Usually pre-installed on macOS and Linux. On Windows:
```powershell
winget install cURL.cURL
```

---

### `jq`

Used for JSON parsing. (PowerShell has native JSON support; this is optional for cross-platform compatibility.)

| Requirement | Version |
|---|---|
| **Minimum** | jq 1.6+ |

#### Verify Installation

```powershell
jq --version
```

#### Installation

**Windows:**
```powershell
winget install jqlang.jq
```

**macOS:**
```bash
brew install jq
```

**Linux:**
```bash
sudo apt-get install -y jq  # Ubuntu/Debian
sudo dnf install -y jq      # Fedora/RHEL
```

---

### `yq`

Used for YAML parsing. (No native PowerShell equivalent; required for YAML manipulation.)

| Requirement | Version |
|---|---|
| **Minimum** | yq 4.0+ |

#### Verify Installation

```powershell
yq --version
```

#### Installation

**Windows:**
```powershell
winget install mikefarah.yq
```

**macOS:**
```bash
brew install yq
```

**Linux:**
```bash
sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
sudo chmod +x /usr/local/bin/yq
```

---

### `ast-grep`

Used for code pattern matching and search across large codebases.

| Requirement | Version |
|---|---|
| **Minimum** | ast-grep 0.15+ |

#### Verify Installation

```powershell
ast-grep --version
```

#### Installation

**Windows:**
```powershell
winget install ast-grep.ast-grep
```

**macOS:**
```bash
brew install ast-grep
```

**Linux:**
```bash
# Ubuntu/Debian via cargo
cargo install ast-grep
# Or download binary from https://github.com/ast-grep/ast-grep/releases
```

---

### Python 3 (Optional)

Some legacy scripts may require Python. Not needed for most modern skills.

| Requirement | Version |
|---|---|
| **Minimum** | Python 3.8+ |
| **Recommended** | Python 3.10+ |

#### Verify Installation

```powershell
python --version
```

#### Installation

**Windows:**
```powershell
winget install Python.Python.3.12
```

**macOS:**
```bash
brew install python@3.12
```

**Linux:** Included in most distributions.

---

## Language Servers (LSP) — Optional

Language Servers enable GitHub Copilot CLI to provide precise code intelligence across your projects. They power go-to-definition, find-references, rename, and other accurate code navigation features.

**These are optional but highly recommended** for enhanced skill performance.

### Supported Language Servers

| Language | Server | Command | Purpose |
|---|---|---|---|
| **TypeScript / JavaScript** | [typescript-language-server](https://github.com/typescript-language-server/typescript-language-server) | `typescript-language-server` | Accurate type checking & go-to-definition |
| **Python** | [pylsp](https://github.com/python-lsp/python-lsp-server) or [Pyright](https://github.com/microsoft/pyright) | `pylsp` or `pyright` | Python code analysis & refactoring |
| **Go** | [gopls](https://github.com/golang/tools/tree/master/gopls) | `gopls` | Official Go language server |
| **C#** | [omnisharp](https://github.com/OmniSharp/omnisharp-roslyn) | `omnisharp -lsp` | .NET language server |

### Installation

**TypeScript / JavaScript:**
```powershell
npm install -g typescript-language-server typescript
```

**Python:**
```powershell
pip install python-lsp-server
# or for Pyright:
pip install pyright
```

**Go:**
```bash
go install github.com/golang/tools/gopls@latest
```

**C#:**
```bash
# See: https://github.com/OmniSharp/omnisharp-roslyn/releases
# Download the latest omnisharp-roslyn distribution for your platform
```

### Configuration

LSP servers are automatically loaded from `.github/lsp.json` in this repository. After installation, Copilot CLI will use them automatically when you use skills in TypeScript, Python, Go, or C# projects.

**No additional configuration is needed** — Copilot CLI handles server startup and lifecycle management.

### Verify Installation

```powershell
typescript-language-server --version
pylsp --version
gopls version
omnisharp --help
```

---

## Checking Prerequisites

Use the [`check-prerequisites`](../check-prerequisites) skill to automatically verify your environment:

```powershell
# Check CORE prerequisites (PowerShell, Git)
pwsh scripts/Check-Prerequisites.ps1

# Check all prerequisites including OPTIONAL tools
pwsh scripts/Check-Prerequisites.ps1 -Full
```

---

## Troubleshooting

### PowerShell Not Found

If you see "pwsh: command not found", PowerShell is not installed. See [PowerShell Installation](#powershell-7) above.

### Git Not Found

If you see "git: command not found", Git is not installed. See [Git Installation](#git) above.

### Tool Installation Fails on Windows

Try using **Chocolatey** as an alternative package manager:
```powershell
choco install powershell git nodejs python jq yq
```

### Tool Installation Fails on Linux

Ensure your package manager is updated:
```bash
sudo apt-get update && sudo apt-get upgrade  # Ubuntu/Debian
sudo dnf update                               # Fedora/RHEL
```

### PATH Issues

After installation, add tools to your PATH if they're not automatically available:

**Windows:** Restart PowerShell or add manually to environment variables.

**macOS/Linux:** 
```bash
export PATH="/usr/local/bin:$PATH"
```

---

## Quick Start

1. **Install CORE prerequisites**:
   ```powershell
   pwsh scripts/Check-Prerequisites.ps1
   ```

2. **Install RUNTIME prerequisites** (if using TypeScript/Node skills):
   ```powershell
   winget install OpenJS.NodeJS  # Windows
   brew install node             # macOS
   ```

3. **Install OPTIONAL tools as needed**:
   ```powershell
   winget install GitHub.cli  # For GitHub skills
   ```

---

## See Also

- [Skills Documentation](./concepts/skills.md)
- [Skill Writing Guide](../skills/skill-write/SKILL.md)
- [Check Prerequisites Skill](../skills/check-prerequisites/SKILL.md)
