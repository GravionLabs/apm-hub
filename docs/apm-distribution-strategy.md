# APM Distribution Strategy - Executive Summary

## 🎯 Frage
Müssen Dateien wirklich in `.apm/` Verzeichnisse kopiert werden, oder reicht es, `apm.yml` zu generieren und von dort auf templates zu verweisen?

## ✅ Antwort

**NEIN, Symlinks/References funktionieren nicht.** APM arbeitet Copy-basiert.

Allerdings: **Die Lösung ist ein Hybrid-Modell mit Build-Zeit Generierung.**

---

## 🔴 Das Problem Today

```
Single Datei an 3 Stellen:

❌ templates/common/git/skills/common-git-workflow/SKILL.md       (Quelle)
❌ draft/common/.apm/skills/common-git-workflow/SKILL.md           (Kopie 1 — manual sync)
❌ plugins/common/                                                 (Kopie 2 — via generator)

→ Redundanz, Sync-Fehler, Wartungshölle
```

---

## 🟢 Die Lösung: Hybrid Distribution

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  SINGLE SOURCE OF TRUTH                      │
│              templates/common/git/skills/...                 │
│         templates/common/github/agents/...                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   
   FORMAT 1       FORMAT 2        FORMAT 3
   
   Plugin         APM Package    (Future)
   (Hub)          (Install)      
   
   plugins/       dist/apm/      
   common/        common/        
   
   ✓ Referenzen   ✓ Kopiert      
   auf templates  in .apm/       
   
   Für interne    Für externe    
   Integration    Teams          
```

### Build-Zeit Generierung

```bash
npm run generate:all
  ├── npm run build               # TypeScript
  ├── npm run generate:ci         # Copilot Hub Plugins (bestehend)
  ├── npm run generate:apm        # NEW: APM Distributions
  └── npm run generate:diagrams   # Bestehend
```

Der neue `generate:apm` Generator:
1. **Liest** `templates/common/`
2. **Kopiert** alle Dateien → `dist/apm/common/.apm/`
3. **Erstellt** `apm.yml` + `apm.lock.yaml`
4. **CI pusht** zu `dist/` Branch

---

## 📊 Vorher vs. Nachher

### VORHER (Manual Sync)
```
templates/common/SKILL.md ──────(manual copy)──────> draft/common/.apm/SKILL.md
                          ┌─────────────┬─────────────┐
                          │             │             │
                          ▼             ▼             ▼
                      Plugin       APM Pkg      Developer
                     (Hub)       (install)    (confused)
                     
❌ Fehler-anfällig
❌ Zeitaufwändig
❌ Versionen auseinander
```

### NACHHER (Automatisiert)
```
templates/common/SKILL.md ──┐
                            └──> Generator (Build-Zeit)
                                     ├──> plugins/common/plugin.config.yml
                                     ├──> dist/apm/common/.apm/SKILL.md
                                     └──> apm.lock.yaml
                            
✅ Single Source
✅ Automatisch
✅ Konsistent
✅ Versioniert
```

---

## 🚀 Implementation

### Phase 1: Generator (neue TypeScript-Datei)

```typescript
// src/generators/apm-generator.ts

function generateAPMDistributions() {
  // Für jedes Domain in templates/:
  // 1. Finde alle .agent.md, .instructions.md, SKILL.md
  // 2. Kopiere in dist/apm/<name>/.apm/
  // 3. Erstelle apm.yml mit Metadaten
  // 4. Erstelle apm.lock.yaml mit Git refs
}
```

### Phase 2: Integration in CI

```yaml
# .github/workflows/apm-dist.yml
on: [push]
jobs:
  generate-apm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run generate:apm
      - run: git push origin dist:dist
```

### Phase 3: Versioning

```bash
# Bei Release:
git tag v1.2.3
# CI generiert:
# dist/apm/common/.apm/ mit apm.lock.yaml
# → Nutzer: apm install GravionLabs/copilot-hub/dist/apm/common#v1.2.3
```

---

## 💡 Vorteile des Hybrid-Modells

| Aspekt         | Vorher      | Nachher              |
| :------------- | :---------- | :------------------- |
| Quellen        | 3 Kopien    | 1 Source             |
| Sync           | Manual      | Automatisch          |
| Fehler         | Hoch        | Niedrig              |
| Wartung        | Aufwändig   | Generator            |
| Versioning     | Fragil      | apm.lock.yaml        |
| Externe Nutzer | APM-Install | APM-Install (besser) |
| Interne Nutzer | Plugins     | Plugins (gleich)     |

---

## 🎓 Was ist APM?

APM = **Automated Package Manager für AI Agents** (Microsoft)

- Wie npm/pip, aber für Copilot, Claude, Cursor
- Deployed Skills/Agents in `.github/`, `.claude/`, `.cursor/`, `.gemini/`
- Versioniert mit `apm.lock.yaml`
- Unterstützt MCP-Server
- **Arbeitet COPY-basiert** (nicht Symlink/Reference)

---

## 📦 APM Installation auf Linux

### Quick Install
```bash
curl -sSL https://aka.ms/apm-unix | sh
```

### Update
```bash
brew update && brew upgrade apm          # Homebrew
pip install --upgrade apm-cli            # pip
curl -sSL https://aka.ms/apm-unix | sh  # curl
```

### Verwendung
```bash
apm init my-package             # New package
apm install                     # Local install
apm install owner/repo#v1.0.0   # From GitHub
apm pack --format plugin        # Export as plugin
```

**Vollständige Anleitung:** `docs/apm-linux-guide.md`

---

## ✨ Empfehlung: JA — Implementieren

### Gründe

1. **Eliminiert Redundanz** → Single Source of Truth
2. **Automatisiert Sync** → Keine manual Kopien mehr
3. **Consistent Versioning** → apm.lock.yaml
4. **Team-freundlich** → Alle auf dem gleichen Stand
5. **Zukunftssicher** → Unterstützt beide: Plugins + APM

### Timeline

- ⏳ Schreibe APM-Generator (2-3 Std)
- ⏳ Setup CI/CD für dist/ Branch (1-2 Std)
- ⏳ Test mit einer Domäne (1-2 Std)
- ⏳ Alle Domains migrieren (1 Std)
- ⏳ Dokumentation aktualisieren (1 Std)

**Gesamtaufwand:** ~6-8 Stunden für vollständige Implementation

---

## 📝 Nächste Schritte

1. ✅ **Doku gelesen** → https://microsoft.github.io/apm/
2. ⏳ **APM installieren** auf Linux
   ```bash
   curl -sSL https://aka.ms/apm-unix | sh
   ```

3. ⏳ **Generator schreiben** → apm-generator.ts
4. ⏳ **Testen** mit dist/apm/common
5. ⏳ **CI Setup** für dist/ Branch
6. ⏳ **Alle Domains** migrieren
7. ⏳ **Doku** aktualisieren

---

## 📚 Ressourcen

- **APM Doku**: https://microsoft.github.io/apm/
- **Quick Start**: https://microsoft.github.io/apm/getting-started/quick-start/
- **First Package**: https://microsoft.github.io/apm/getting-started/first-package/
- **Linux Guide** (lokal): `docs/apm-linux-guide.md`
- **Analysis Plan** (Session): `plan.md`
