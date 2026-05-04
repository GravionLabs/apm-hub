### Success

```
=== CORE Prerequisites ===
  ✓ PowerShell: 7.4.0
  ✓ Git: git version 2.42.0

=== RUNTIME Prerequisites ===
  ✓ Node.js: v20.10.0
  ✓ npm: v10.2.4

=== Summary ===
✓ All required prerequisites are installed!
```

### Failure (no `-AutoInstall`)

```
=== CORE Prerequisites ===
  ✗ PowerShell: 7.4 (need 7+)
  ✓ Git: git version 2.42.0

=== RUNTIME Prerequisites ===
  ✗ Node.js: NOT FOUND
  ✗ npm: NOT FOUND

=== Summary ===
✗ Missing Prerequisites

  • PowerShell : NOT FOUND
    → Windows: winget install Microsoft.PowerShell
    → macOS:   brew install powershell
    → Linux:   sudo apt-get install powershell

  • Node.js : NOT FOUND
    → Windows: winget install OpenJS.NodeJS
    → macOS:   brew install node
    → Linux:   sudo apt-get install nodejs

Run with -AutoInstall flag to attempt automatic installation.
See docs/prerequisites.md for detailed instructions.
```
