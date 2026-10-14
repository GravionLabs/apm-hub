<#
.SYNOPSIS
  Classify a diff as "mechanical" or "full" for review-fanout. Fails closed: any doubt -> full.
.PARAMETER Range
  Git range or ref passed to `git diff` (e.g. main..HEAD). Default: HEAD (working tree vs HEAD).
  Must not start with `-`; every ref must be verified by git, else full.
.PARAMETER Force
  `full` skips classification and returns full.
.PARAMETER MaxLines
  Max changed lines (added + deleted) allowed in docs, manifests and test files. Default 20.
.OUTPUTS
  JSON {"mode","dimensions","reason"}; always exit code 0 once parameters are bound.
.NOTES
  This script is authoritative; references/mechanical-classifier.md describes it.
#>
param(
  [string]$Range = 'HEAD',
  [ValidateSet('', 'full')][string]$Force = '',
  [int]$MaxLines = 20
)

$ErrorActionPreference = 'Stop'
$all = @('correctness', 'security', 'conventions', 'tests', 'spec')

function Exit-WithResult([string]$mode, [string[]]$dims, [string]$reason) {
  [ordered]@{ mode = $mode; dimensions = @($dims); reason = $reason } | ConvertTo-Json -Compress
  exit 0
}
function Exit-WithFull([string]$reason) { Exit-WithResult 'full' $all $reason }

# Location classes, first match wins. exec and build are always full (also as pure rename);
# instruction, source and other files may only be moved with identical content and file name; docs,
# manifest and test may be edited (line threshold, test-file rule); test files keep their file name.
$classes = [ordered]@{
  # Executed by tools, hooks or CI without an explicit call.
  exec        = '(^|/)\.(github|husky|claude|opencode|cursor|vscode|devcontainer|circleci|gitlab|githooks)/|(^|/)hooks?/|(^|/)(\.mcp\.json|\.npmrc|\.yarnrc(\.yml)?|\.pre-commit-config\.yaml|\.pre-commit-hooks\.yaml|\.envrc|\.env(\.[^/]*)?|\.gitattributes|\.gitmodules|\.gitignore|\.gitlab-ci\.yml|\.travis\.yml|azure-pipelines\.yml|Jenkinsfile|GNUmakefile|[Mm]akefile|Dockerfile[^/]*|Containerfile|docker-compose[^/]*|compose\.ya?ml|Procfile|[Jj]ustfile|Taskfile\.ya?ml|sitecustomize\.py|usercustomize\.py)$|\.pth$'
  # Build, dependency and test configuration, entry points.
  build       = '(^|/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lockb?|deno\.jsonc?|[jt]sconfig[^/]*\.json|babel\.config[^/]*|pyproject\.toml|setup\.py|setup\.cfg|conftest\.py|requirements[^/]*\.(txt|in)|constraints[^/]*\.txt|Pipfile(\.lock)?|poetry\.lock|uv\.lock|tox\.ini|noxfile\.py|pytest\.ini|manage\.py|__init__\.py|__main__\.py|Cargo\.(toml|lock)|build\.rs|lib\.rs|mod\.rs|go\.(mod|sum|work)|Gemfile(\.lock)?|Rakefile|[^/]+\.gemspec|pom\.xml|(build|settings)\.gradle(\.kts)?|gradle\.properties|gradlew(\.bat)?|CMakeLists\.txt|[^/]+\.(csproj|fsproj|vbproj|sln|slnx|props|targets)|global\.json|[Nn]u[Gg]et\.config|Program\.cs|Startup\.cs)$|(^|/)\.[^/]*rc(\.[^/]*)?$|(^|/)[^/]+\.config\.[cm]?[jt]s$|(^|/)[^/]*setup[^/]*\.[cm]?[jt]sx?$|(^|/)(index|main)\.([cm]?[jt]sx?|py|go|rs|rb|php|ps1|sh)$|(^|/)bin/'
  # Agent/skill instruction files and skill content steer agents: code-like, never docs.
  instruction = '(^|/)(SKILL|AGENTS|CLAUDE|GEMINI|COPILOT|copilot-instructions)\.md$|\.(agent|prompt|instructions|chatmode)\.md$|(^|/)\.apm/|(^|/)skills/'
  manifest    = '(^|/)(apm\.yml|marketplace\.json|plugin\.json)$'
  docs        = '(^|/)(README|CHANGELOG)[^/]*\.(md|mdx|txt)$|(^|/)docs/.+\.(md|mdx)$'
  test        = '(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$'
  source      = '\.(c|cc|cpp|cs|cts|css|cjs|fs|go|h|hpp|html?|java|jsx?|kt|lua|mjs|mts|php|pl|ps1|psm1|psd1|py|r|rb|rs|scala|scss|sh|bash|zsh|svelte|swift|tsx?|vb|vue)$'
}
# Added lines that look like commands, installs or remote fetches add the security dimension.
$risky = '\b(curl|wget|eval|iex|iwr|irm|chmod|chown|sudo|ssh|scp|sftp|rsync|nc|ncat|netcat|socat|telnet|npx|pnpx|bunx|uvx|base64|certutil|Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|DownloadString|FromBase64String)\b|\b[a-z][a-z0-9+.-]*://|\bgit@[\w.-]+:|\bgit\s+clone\b|\b(npm|pnpm|yarn|bun)\s+(i|install|add|dlx|exec|x)\b|\b(pip[0-9.]*|pipx|gem|cargo|uv\s+pip|uv\s+tool)\s+install\b|\bgo\s+(install|get)\b|\s-(enc\w*|ec)\b|\b(pwsh|powershell)(\.exe)?\b.*\s-e\b|\b(python[0-9.]*|py)\s+-c\b|\b(node|perl|ruby)\s+-e\b|\b(sh|bash|zsh)\s+(-c\b|<\()|\brm\s+(-\w+\s+)*-\w*[rf]|\|\s*(sh|bash|zsh|pwsh|powershell|python[0-9.]*|node|perl|ruby|iex)\b|<script|^\+\s*(import|export)\s|\brequire\(|\bchild_process\b|\bprocess\.env\b|\bfs\.(write|unlink|rm)'
$sensitive = 'auth|crypt|password|secret|token|oauth|login|http|network|socket|sql|query|database|jwt|session|cookie|permission|rbac|acl|cert|tls|ssl|cors|csrf|hash|api[-_]?key|\.github/workflows|hook|dockerfile|husky|\.mcp|makefile|\.npmrc|\.vscode|setup\.py|conftest|\.env|migration|(^|/)public/'

function Get-LocationClass([string]$p) {
  foreach ($c in $classes.Keys) { if ($p -imatch $classes[$c]) { return $c } }
  return 'other'
}

function Test-Ref([string]$ref) {
  if ($ref -eq '') { return $true }
  if ($ref.StartsWith('-') -or $ref -match '\s') { return $false }
  git rev-parse --verify --quiet --end-of-options "$ref^{commit}" 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

# Index of the nearest non-whitespace token before ($dir -1) or after ($dir 1) $t; -1 if none.
function Get-Neighbor([string[]]$toks, [int]$t, [int]$dir) {
  for ($j = $t + $dir; $j -ge 0 -and $j -lt $toks.Count; $j += $dir) { if ($toks[$j] -notmatch '^\s$') { return $j } }
  return -1
}

# True when $name is declared as a local binding in one of $lines: const/let/var/function/class/def/
# type, default/namespace/aliased import, array destructuring, parameter, catch, for-in, with/except-as.
# Named imports and object destructuring are not local renames (they change what is read): false.
function Test-Declared([string]$name, [string[]]$lines) {
  $k = [regex]::Escape($name)
  $decl = "\b(const|let|var|function\*?|class|def|interface|type|enum)\s+$k\b|\bimport\s+$k\s*(,|\bfrom\b)|\bimport\b[^;]*\bas\s+$k\b|\b(with|except)\b.*\bas\s+$k\s*:|\b(const|let|var)\s*\[[^\]=]*\b$k\b[^\]=]*\]\s*=|\bfunction\b[^(]*\([^)]*\b$k\b|\bdef\s+\w+\s*\([^)]*\b$k\b|\blambda\b[^:]*\b$k\b[^:]*:|(^|[^\w.])\(\s*([\w\s,]*,\s*)?$k\s*(,[\w\s,]*)?\)\s*=>|(^|[^\w.])$k\s*=>|\bcatch\s*\(\s*$k\s*\)|\bfor\s+([\w\s,]*,\s*)?$k\s*(,[\w\s,]*)?\s+in\b"
  return (@($lines | Where-Object { $_ -cmatch $decl }).Count -gt 0)
}

# Test files count as mechanical only when every changed line pair differs solely by one consistent,
# injective rename of locally declared identifiers. Never members (after . or ?.), object keys,
# shorthand properties, keyword arguments, builtins or matcher names. Anything unprovable: $false.
function Test-RenameOnly([string[]]$pathspec) {
  $d = @(git -c core.quotepath=off --literal-pathspecs diff --ignore-submodules=none -M -U100000 --no-color $Range -- @pathspec 2>$null)
  if ($LASTEXITCODE -ne 0) { return $false }
  $rem = @(); $add = @(); $ctx = @(); $inHunk = $false
  foreach ($l in $d) {
    if ($l.StartsWith('@@')) { $inHunk = $true; continue }
    if (-not $inHunk) { continue }
    if ($l.StartsWith('-')) { $rem += $l.Substring(1) }
    elseif ($l.StartsWith('+')) { $add += $l.Substring(1) }
    elseif ($l.StartsWith('\')) { continue }
    elseif ($l.StartsWith(' ')) { $ctx += $l.Substring(1) }
    else { return $false }
  }
  if ($rem.Count -eq 0 -or $rem.Count -ne $add.Count) { return $false }
  $keep = 'true|false|null|undefined|None|True|False|not|and|or|if|else|elif|nil|return|throw|raise|break|continue|yield|await|async|typeof|instanceof|in|of|is|as|with|except|for|while|try|catch|finally|new|delete|del|void|import|export|from|const|let|var|def|class|function|lambda|pass|assert|type|interface|enum|static|get|set|extends|implements|global|nonlocal|expect|it|test|describe|skip|only|todo|xit|xdescribe|fit|fdescribe|beforeEach|afterEach|beforeAll|afterAll'
  $builtin = 'NaN|Infinity|undefined|Math|JSON|Object|Array|String|Number|Boolean|Symbol|BigInt|Date|RegExp|Error|TypeError|RangeError|Promise|Map|Set|WeakMap|WeakSet|Proxy|Reflect|Intl|Function|process|globalThis|global|window|document|console|require|module|exports|__dirname|__filename|this|self|cls|super|arguments|eval|fetch|Buffer|setTimeout|setInterval|jest|vi|chai|print|len|range|int|str|float|bool|list|dict|tuple|open|exec|compile|getattr|setattr|isinstance|object|os|sys|__import__|__builtins__|__name__|pytest|unittest|mock'
  $matcher = 'to[A-Z]\w*|resolves|rejects|equal|equals|eql|deepEqual|strictEqual|ok|throws|be|been|have|called\w*|assert\w*'
  $tok = '"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|`(?:\\.|[^`\\])*`|//.*|#.*|/\*.*|\*/|\w+|\W'
  $map = @{}
  for ($k = 0; $k -lt $rem.Count; $k++) {
    foreach ($line in @($rem[$k], $add[$k])) {
      if ($line -match '/\*|\*/|"""|''''''|^\s*\*') { return $false }
    }
    $a = @([regex]::Matches($rem[$k], $tok) | ForEach-Object { $_.Value })
    $b = @([regex]::Matches($add[$k], $tok) | ForEach-Object { $_.Value })
    if ($a.Count -ne $b.Count -or $rem[$k] -ceq $add[$k]) { return $false }
    foreach ($t in @($a) + @($b)) { if ($t -in @('"', "'", '`')) { return $false } }
    for ($t = 0; $t -lt $a.Count; $t++) {
      if ($a[$t] -ceq $b[$t]) { continue }
      foreach ($x in @($a[$t], $b[$t])) {
        if ($x -cnotmatch '^[A-Za-z_]\w*$' -or $x -cmatch "^($keep|$builtin|$matcher)$") { return $false }
      }
      $p = Get-Neighbor $a $t -1; $n = Get-Neighbor $a $t 1
      $prev = if ($p -ge 0) { $a[$p] } else { '' }
      $next = if ($n -ge 0) { $a[$n] } else { '' }
      $after = if ($n -ge 0 -and $n + 1 -lt $a.Count) { $a[$n + 1] } else { '' }
      # Member, method or matcher access (obj.x, obj?.x).
      if ($prev -eq '.') { return $false }
      # Object key, destructuring key or typed parameter after a comma.
      if ($next -eq ':' -and $prev -in @('{', ',', '')) { return $false }
      # Keyword argument or default parameter: f(a, x=1).
      if ($next -eq '=' -and $after -notin @('=', '>') -and $prev -in @('(', ',')) { return $false }
      # Shorthand property ({ a, x }) or a bare line in a multi-line literal: allowed only inside ( or [.
      if ($prev -in @('{', ',', '') -and $next -in @('}', ',', '')) {
        $before = @($a[0..([Math]::Max(0, $t - 1))])
        if ($t -eq 0) { $before = @() }
        $paren = @($before | Where-Object { $_ -in @('(', '[') }).Count - @($before | Where-Object { $_ -in @(')', ']') }).Count
        $brace = @($before | Where-Object { $_ -eq '{' }).Count - @($before | Where-Object { $_ -eq '}' }).Count
        if ($paren -le 0 -or $brace -gt 0) { return $false }
      }
      if ($map.ContainsKey($a[$t]) -and $map[$a[$t]] -cne $b[$t]) { return $false }
      $map[$a[$t]] = $b[$t]
    }
  }
  $values = @($map.Values)
  if (@($values | Select-Object -Unique).Count -ne $values.Count) { return $false }
  foreach ($key in $map.Keys) {
    $old = [regex]::Escape($key); $new = [regex]::Escape($map[$key])
    # Only locally declared names may be renamed (no call targets or imports from elsewhere).
    if (-not (Test-Declared $key $rem)) { return $false }
    # Old name gone everywhere; new name nowhere in removed or unchanged lines (no merges, tautologies).
    if ($map.ContainsKey($map[$key]) -or ($add -cmatch "\b$old\b") -or ($rem -cmatch "\b$new\b")) { return $false }
    if ($ctx -cmatch "\b$old\b" -or $ctx -cmatch "\b$new\b") { return $false }
  }
  return ($map.Count -gt 0)
}

try {
  if ($Force -eq 'full') { Exit-WithFull 'forced full by caller' }

  git rev-parse --is-inside-work-tree 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git rev-parse failed: not inside a git work tree' }

  if ($Range.StartsWith('-')) { Exit-WithFull 'invalid range: starts with -' }
  $m = [regex]::Match($Range, '^(.*?)(\.\.\.?)(.*)$')
  $sides = if ($m.Success) { @($m.Groups[1].Value, $m.Groups[3].Value) } else { @($Range) }
  if (-not $m.Success -and $Range -eq '') { Exit-WithFull 'invalid range: empty' }
  foreach ($side in $sides) {
    if (-not (Test-Ref $side)) { Exit-WithFull "invalid range: $side" }
  }

  if (-not $m.Success) {
    # Working-tree mode: git diff cannot see untracked files.
    $untracked = @(git --literal-pathspecs ls-files --others --exclude-standard 2>$null)
    if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git ls-files failed' }
    if ($untracked.Count -gt 0) { Exit-WithFull "untracked files present: $($untracked[0])" }
  }

  $out = @(git -c core.quotepath=off --literal-pathspecs diff --ignore-submodules=none -M --raw --numstat $Range -- 2>$null)
  if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git diff failed' }
  $raw = @($out | Where-Object { $_.StartsWith(':') })
  $num = @($out | Where-Object { -not $_.StartsWith(':') })

  if ($raw.Count -eq 0) { Exit-WithFull 'empty diff' }
  if ($raw.Count -ne $num.Count) { Exit-WithFull 'unparseable diff' }

  $lines = 0
  $risk = $false
  $paths = @()
  for ($i = 0; $i -lt $raw.Count; $i++) {
    $parts = $raw[$i] -split "`t"
    $meta = @(($parts[0].TrimStart(':')) -split ' ')
    $n = $num[$i] -split "`t"
    if ($parts.Count -lt 2 -or $meta.Count -lt 5 -or $n.Count -lt 3) { Exit-WithFull 'unparseable diff' }
    $oldMode = $meta[0]; $newMode = $meta[1]; $code = $meta[4]
    $files = @($parts[1..($parts.Count - 1)])
    $path = $files[-1]
    $paths += $files
    if ($n[0] -eq '-' -or $n[1] -eq '-') { Exit-WithFull "binary file: $path" }
    $changed = [int]$n[0] + [int]$n[1]
    if (@($oldMode, $newMode) -contains '120000' -or @($oldMode, $newMode) -contains '160000') {
      Exit-WithFull "symlink or submodule: $path"
    }
    if ($oldMode -ne '000000' -and $newMode -ne '000000' -and $oldMode -ne $newMode) {
      Exit-WithFull "mode change on $path"
    }
    if ($oldMode -eq '000000' -and $newMode -ne '100644') { Exit-WithFull "added file with mode ${newMode}: $path" }
    if ($code -notmatch '^(M|A|D|R\d+)$') { Exit-WithFull "unsupported change type $code on $path" }
    # Git C-quotes paths with tab, newline, quote or backslash; the anchored class regexes would miss them.
    if (@($files | Where-Object { $_.StartsWith('"') }).Count -gt 0) { Exit-WithFull "quoted path (tab, newline, quote or backslash): $path" }
    $cls = @($files | ForEach-Object { Get-LocationClass $_ })
    $cls1 = @($cls | Select-Object -Unique)
    $flow = "$($cls -join ' -> '): $($files -join ' -> ')"
    # Only docs and manifests may change their file name; elsewhere a rename is a directory move,
    # so it cannot turn into a tool-loaded name missing from the lists (composer.json, gulpfile.js).
    $names = @($files | ForEach-Object { $_ -replace '^.*/', '' } | Select-Object -Unique)
    $renamed = $names.Count -ne 1 -and $cls1.Count -eq 1 -and $cls1[0] -notin @('docs', 'manifest')
    if ($code -eq 'R100') {
      if ($cls1.Count -ne 1) { Exit-WithFull "rename changes location class ($flow)" }
      if ($cls1[0] -in @('exec', 'build')) { Exit-WithFull "rename of an always-full path ($flow)" }
      if ($renamed) { Exit-WithFull "$($cls1[0]) file renamed to another file name ($flow)" }
      continue
    }
    if ($cls1.Count -ne 1) { Exit-WithFull "rename with edits changes location class ($flow)" }
    if ($renamed -and $cls1[0] -eq 'test') { Exit-WithFull "test file renamed to another file name ($flow)" }
    if ($cls1[0] -notin @('docs', 'manifest', 'test')) { Exit-WithFull "content change in $($cls1[0]) file: $path" }
    if ($cls1[0] -eq 'test') {
      if ($code -eq 'A' -or $code -eq 'D' -or -not (Test-RenameOnly $files)) {
        Exit-WithFull "test file change is not a pure rename of local identifiers: $path"
      }
    }
    $lines += $changed
    $added = @(git -c core.quotepath=off --literal-pathspecs diff --ignore-submodules=none -M -U0 --no-color $Range -- @files 2>$null)
    if ($LASTEXITCODE -ne 0) { Exit-WithFull "git diff failed for $path" }
    if (@($added | Where-Object { $_.StartsWith('+') -and -not $_.StartsWith('+++') -and $_ -imatch $risky }).Count -gt 0) {
      $risk = $true
    }
  }
  if ($lines -gt $MaxLines) { Exit-WithFull "$lines changed lines exceed threshold $MaxLines" }

  $dims = @('correctness', 'spec')
  if ($risk -or ($paths | Where-Object { $_ -imatch $sensitive -or $_ -imatch $classes['manifest'] })) { $dims = @('correctness', 'security', 'spec') }
  Exit-WithResult 'mechanical' $dims "only same-class renames and $lines changed lines (limit $MaxLines) in docs/manifests/tests (test files: local identifier renames only)"
} catch {
  Exit-WithFull "script error: $($_.Exception.Message)"
}
