# APM Installation & Verwendung auf Linux

## 📥 Installation

### Option 1: Quick Install (Empfohlen)

```bash
curl -sSL https://aka.ms/apm-unix | sh
```

Diese Methode:
- Lädt das neueste Release herunter
- Installiert es in `~/.local/bin/apm` (PATH-freundlich)
- Shell-Konfiguration aktualisiert sich automatisch
- Funktioniert auf macOS und Linux

**Nach Installation:**
```bash
# Shell neuladen oder logout/login
exec $SHELL

# Verify
apm --version
```

---

### Option 2: Homebrew (für Linux/macOS)

```bash
# Falls Homebrew noch nicht installiert
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# APM installieren
brew install apm
```

**Verify:**
```bash
apm --version
which apm
```

---

### Option 3: pip (Python Package)

```bash
# Falls Python 3 nicht installiert
sudo apt-get update && sudo apt-get install python3 python3-pip

# APM installieren
pip install apm-cli

# Oder mit pip3 (explizit)
pip3 install apm-cli
```

**Verify:**
```bash
apm --version
```

---

### Option 4: Manuell (Fallback)

```bash
# 1. Release-Seite besuchen
# https://github.com/microsoft/apm/releases

# 2. Neueste Linux-Binary herunterladen (z.B. apm-linux-x64)
cd /tmp
wget https://github.com/microsoft/apm/releases/download/v1.0.0/apm-linux-x64

# 3. Ausführbar machen
chmod +x apm-linux-x64

# 4. In PATH verschieben
sudo mv apm-linux-x64 /usr/local/bin/apm

# 5. Verify
apm --version
```

---

## 🔄 Update

### Via Quick Installer

```bash
curl -sSL https://aka.ms/apm-unix | sh
```

### Via Homebrew

```bash
brew update
brew upgrade apm
```

### Via pip

```bash
pip install --upgrade apm-cli
```

### Überprüfe aktuelle Version

```bash
apm --version
```

---

## 🎮 Häufige Kommandos

### Projekt Initialisieren

```bash
# Neues APM-Paket erstellen
apm init my-package

# Im bestehenden Repo initialisieren
cd my-project
apm init

# Interaktiv mit Prompts
apm init --interactive
```

**Output:**
```
my-package/
├── apm.yml
└── (leeres Verzeichnis — du füllst .apm/ Inhalte hinzu)
```

### APM Package lokal installieren

```bash
# Installiert .apm/ Inhalte ins .github/, .claude/, etc.
apm install

# Output:
# [+] <project root> (local)
# |-- 1 agent integrated -> .github/agents/
# |-- 2 skills integrated -> .github/skills/
```

### Von GitHub installieren

```bash
# Public Package von GitHub
apm install GravionLabs/copilot-hub/dist/apm/common#v1.0.0

# Version (optional)
apm install owner/repo                    # Latest
apm install owner/repo#v1.0.0             # Specific tag
apm install owner/repo#main               # Branch

# Mit Pfad im Repo (falls nested)
apm install owner/repo/path/to/package
```

### MCP Server installieren

```bash
# GitHub MCP Server
apm install --mcp io.github.github/github-mcp-server

# Azure DevOps MCP Server
apm install --mcp azure-devops -- npx -y @azure-devops/mcp YOUR_ORG_NAME
```

### Package als Plugin exportieren

```bash
# Generiert plugin.json + Runtime-Verzeichnisse
apm pack --format plugin

# Output:
# build/my-package-1.0.0/
# ├── plugin.json
# ├── agents/
# ├── skills/
# └── instructions/
```

### Dependencies prüfen

```bash
# Audit für Security/Policy Violations
apm audit

# Detailliertes Output
apm audit --verbose
```

### Hilfe

```bash
apm --help                 # Alle Kommandos
apm <command> --help       # Hilfe zu Command
apm init --help
apm install --help
apm pack --help
```

---

## 🗂️ APM Package-Struktur

### Minimal (Single Skill)

```
my-skill/
├── SKILL.md              # Skill-Inhalt
└── apm.yml               # Manifest (optional)
```

### Standard (Multiple Primitives)

```
my-package/
├── apm.yml               # Manifest
├── .apm/
│   ├── skills/
│   │   ├── skill1/SKILL.md
│   │   └── skill2/SKILL.md
│   ├── agents/
│   │   ├── agent1.agent.md
│   │   └── agent2.agent.md
│   └── instructions/
│       └── context.instructions.md
└── apm_modules/          # .gitignore!
```

### Plugin Format

```
my-plugin/
├── plugin.json           # Manifest
├── agents/
├── skills/
└── instructions/
```

---

## 📋 apm.yml Beispiel

```yaml
name: team-skills
version: 1.0.0
description: Skills and agents for our team's review workflow
author: your-name

dependencies:
  apm:
    - microsoft/apm-sample-package#v1.0.0    # APM packages
    - GravionLabs/copilot-hub/dist/apm/common
  mcp:
    - name: github-mcp
      transport: stdio
      command: npx
      args: ["-y", "@github/github-mcp-server"]

scripts:
  setup: echo "Setting up team-skills"
```

---

## 🔍 Troubleshooting

### "apm: command not found"

```bash
# 1. Prüfe Installation
which apm
# Falls leer: Installation fehlgeschlagen

# 2. Versuche Quick Installer nochmal
curl -sSL https://aka.ms/apm-unix | sh

# 3. Shell neuladen
exec $SHELL

# 4. Prüfe PATH
echo $PATH
```

### "Permission denied"

```bash
# Falls manuell installiert, Rechte prüfen
ls -la /usr/local/bin/apm

# Falls nötig:
chmod +x /usr/local/bin/apm
```

### APM findet Paket nicht

```bash
# Prüfe apm.yml Syntax
cat apm.yml

# Prüfe GitHub Zugriff (falls private Repo)
git clone https://github.com/owner/repo

# Verbose Output
apm install --verbose
```

### MCP Server lädt nicht

```bash
# Prüfe installed MCPs
cat .vscode/mcp.json  # oder .claude/mcp.json

# Prüfe Node.js/npx
node --version
npx --version
```

---

## 🚀 Workflow Beispiel

### Schritt 1: Repo klonen

```bash
git clone https://github.com/GravionLabs/copilot-hub.git
cd copilot-hub
```

### Schritt 2: APM Package installieren

```bash
# Installiere common-package
apm install dist/apm/common

# Output:
# [+] dist/apm/common
# |-- 2 agents integrated
# |-- 2 skills integrated
# |-- 1 instruction integrated
```

### Schritt 3: Dateien committed

```bash
# Verify generated files
ls -la .github/agents/
ls -la .github/skills/

# Commit (für Team-Consistency)
git add .github/
git commit -m "chore: sync APM artifacts"
git push
```

### Schritt 4: Im Editor verwenden

```bash
# Öffne Copilot/Claude/Cursor in diesem Repo
# Agents sind sofort verfügbar:
# - @common-github-pull-request
# - @common-git-workflow
```

---

## 📚 Offizielle Ressourcen

- **APM Dokumentation**: https://microsoft.github.io/apm/
- **GitHub Repository**: https://github.com/microsoft/apm
- **Quick Start**: https://microsoft.github.io/apm/getting-started/quick-start/
- **Create Packages**: https://microsoft.github.io/apm/getting-started/first-package/
- **CLI Reference**: https://microsoft.github.io/apm/reference/cli-commands/

---

## 💡 Best Practices

### 1. Immer apm.lock.yaml commiten
```bash
git add apm.yml apm.lock.yaml
git commit -m "chore: update APM dependencies"
```

### 2. apm_modules/ ausschließen
```bash
echo "apm_modules/" >> .gitignore
```

### 3. Regelmäßig aktualisieren
```bash
apm upgrade
apm audit
```

### 4. Team auf dem gleichen Stand
```bash
# Nach git clone:
apm install
# Diese Kommando nutzt apm.lock.yaml für exakte Versionen
```

---

## Zusammenfassung

| Aufgabe                | Kommando                                                |     |
| :--------------------- | :------------------------------------------------------ | :-- |
| Installieren           | `curl -sSL https://aka.ms/apm-unix \                    | sh` |
| Update                 | `brew upgrade apm` oder `pip install --upgrade apm-cli` |     |
| Version prüfen         | `apm --version`                                         |     |
| Package initialisieren | `apm init my-package`                                   |     |
| Lokal installieren     | `apm install`                                           |     |
| Von GitHub install     | `apm install owner/repo#v1.0.0`                         |     |
| Als Plugin exportieren | `apm pack --format plugin`                              |     |
| Dependencies audit     | `apm audit`                                             |     |
| Hilfe                  | `apm --help` oder `apm <cmd> --help`                    |     |
