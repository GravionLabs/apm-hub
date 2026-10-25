<#
.SYNOPSIS
  Classify a diff as "mechanical", "docs", "text" or "full" for review-fanout. Fails closed: any doubt -> full.
.PARAMETER Range
  Git range or ref passed to `git diff` (e.g. main..HEAD). Default: HEAD (working tree vs HEAD).
  Must not start with `-`; every ref must be verified by git, else full.
.PARAMETER Force
  `full` skips classification and returns full.
.PARAMETER MaxLines
  Max changed lines (added + deleted) allowed in docs, manifests and renamed-identifier test files. Default 20.
.PARAMETER SmallLines
  Max changed lines (added + deleted, package-filter paths excluded) for size class "small". A full diff of
  size small gets a reduced dimension set. Default 150.
.OUTPUTS
  JSON {"mode","dimensions","reason","size","signals","skippedDimensions"}; always exit code 0 once
  parameters are bound. size is small|large (large whenever it cannot be measured), signals lists
  risky|sensitive|source, skippedDimensions is [{dimension,reason}].
.NOTES
  This script is authoritative; references/mechanical-classifier.md describes it.
#>
param(
  [string]$Range = 'HEAD',
  [ValidateSet('', 'full')][string]$Force = '',
  [int]$MaxLines = 20,
  [int]$SmallLines = 150
)

$ErrorActionPreference = 'Stop'
$all = @('correctness', 'security', 'conventions', 'tests', 'spec')

# Fail closed: unless Set-Measure ran, the diff is large and has no signals.
$size = 'large'
$signals = @()
$skipped = @()
function Exit-WithResult([string]$mode, [string[]]$dims, [string]$reason) {
  [ordered]@{ mode = $mode; dimensions = @($dims); reason = $reason; size = $size; signals = @($signals); skippedDimensions = @($skipped) } | ConvertTo-Json -Compress -Depth 4
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
  instruction = '(^|/)(SKILL|AGENTS|CLAUDE|GEMINI|COPILOT|copilot-instructions)\.md$|\.(agent|prompt|instructions|chatmode)\.md$|(^|/)\.apm/|(^|/)skills/|(^|/)agents/'
  manifest    = '(^|/)(apm\.yml|marketplace\.json|plugin\.json)$'
  docs        = '(^|/)(README|CHANGELOG|CONTRIBUTING)[^/]*\.(md|mdx|txt)$|(^|/)docs/.+\.(md|mdx)$|\.md$'
  test        = '(^|/)(tests?|__tests__)/|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$'
  source      = '\.(c|cc|cpp|cs|cts|css|cjs|fs|go|h|hpp|html?|java|jsx?|kt|lua|mjs|mts|php|pl|ps1|psm1|psd1|py|r|rb|rs|scala|scss|sh|bash|zsh|svelte|swift|tsx?|vb|vue)$'
}
# Added lines that look like commands, installs or remote fetches add the security dimension.
$riskyCore = '\b(curl|wget|eval|iex|iwr|irm|chmod|chown|sudo|ssh|scp|sftp|rsync|nc|ncat|netcat|socat|telnet|npx|pnpx|bunx|uvx|base64|certutil|Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|DownloadString|FromBase64String)\b|\b[a-z][a-z0-9+.-]*://|\bgit@[\w.-]+:|\bgit\s+clone\b|\b(npm|pnpm|yarn|bun)\s+(i|install|add|dlx|exec|x)\b|\b(pip[0-9.]*|pipx|gem|cargo|uv\s+pip|uv\s+tool)\s+install\b|\bgo\s+(install|get)\b|\s-(enc\w*|ec)\b|\b(pwsh|powershell)(\.exe)?\b.*\s-e\b|\b(python[0-9.]*|py)\s+-c\b|\b(node|perl|ruby)\s+-e\b|\b(sh|bash|zsh)\s+(-c\b|<\()|\brm\s+(-\w+\s+)*-\w*[rf]|\|\s*(sh|bash|zsh|pwsh|powershell|python[0-9.]*|node|perl|ruby|iex)\b|<script|\brequire\(|\bchild_process\b|\bprocess\.env\b|\bfs\.(write|unlink|rm)'
# ESM import/export lines only look like code in .mdx pages; test files and skill text carry them legitimately.
$riskyEsm = '^\+\s*(import|export)\s'
$risky = "$riskyCore|$riskyEsm"
# Skill text is read by agents: shell steps that destroy, force-push or carry credentials are security-relevant.
# Credential assignments, private key headers and token prefixes: risky in every text, source and test file (not docs or manifests).
$riskyCred = '(pass(word|wd)?|secret|token|api[-_]?key|credentials?|private[-_]?key|bearer|authorization)\s*[:=]\s*\S|-----BEGIN [A-Z ]*PRIVATE KEY|\b(ghp|gho|ghs|github_pat|sk|AKIA)[_-]?[A-Za-z0-9]{16,}'
$riskyText = $risky + '|\bgit\s+push\b[^\n]*(--force\b|--force-with-lease|\s-[a-z]*f\b)|\bgit\s+(reset\s+--hard|clean\s+-\w*f|branch\s+-D)\b|^\+\s*(\$\s*)?(rm|del|rmdir|Remove-Item)\s+\S|\bRemove-Item\b[^\n]*-Recurse|' + $riskyCred
# Text-only classes (content paths, not rename classes): skill and agent text, and test-only files.
$skillText = '(^|/)(SKILL|AGENTS|CLAUDE)\.md$|\.(agent|prompt)\.md$|(^|/)(references|templates|assets)/.+\.md$'
$testsPath = '(^|/)test/|\.test\.ts$'
$sensitive = 'auth|crypt|password|secret|token|oauth|login|http|network|socket|sql|query|database|jwt|session|cookie|permission|rbac|acl|cert|tls|ssl|cors|csrf|hash|api[-_]?key|\.github/workflows|hook|dockerfile|husky|\.mcp|makefile|\.npmrc|\.vscode|setup\.py|conftest|\.env|migration|(^|/)public/'

# Paths excluded from review packages (references/package-filter.md): lockfiles, snapshots, goldens, generated, minified.
$filtered = '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|uv\.lock|packages\.lock\.json)$|(^|/)(__snapshots__|goldens|dist|coverage)/|\.snap$|(^|/)[^/]*\.golden[^/]*$|\.min\.(js|css)$|\.bundle\.js$|\.map$|^docs/.*-list\.md$'

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

# Splits one multi-file `git diff` into path -> { Lines (hunk lines with prefix), Start (lowest hunk start) }.
# The path is the destination (rename target); quoted paths never get here (rejected earlier).
function Read-Diff([string[]]$d) {
  $res = @{}
  $cur = $null; $inHunk = $false; $rn = $null; $from = $null; $to = $null
  foreach ($l in $d) {
    if ($l.StartsWith('diff --git ')) { $inHunk = $false; $cur = $null; $rn = $null; $from = $null; $to = $null; continue }
    if ($l.StartsWith('@@')) {
      if (-not $inHunk) {
        $cur = if ($rn) { $rn } elseif ($to) { $to } else { $from }
        if (-not $cur) { throw 'diff hunk without a path' }
        if (-not $res.ContainsKey($cur)) { $res[$cur] = [pscustomobject]@{ Lines = [System.Collections.Generic.List[string]]::new(); Start = [int]::MaxValue } }
        $inHunk = $true
      }
      $h = [regex]::Match($l, '^@@ -(\d+)(?:,\d+)? \+(\d+)')
      if ($h.Success) { $res[$cur].Start = [Math]::Min($res[$cur].Start, [Math]::Min([int]$h.Groups[1].Value, [int]$h.Groups[2].Value)) }
      continue
    }
    if ($inHunk) { $res[$cur].Lines.Add($l); continue }
    if ($l.StartsWith('rename to ')) { $rn = $l.Substring(10) }
    elseif ($l.StartsWith('--- a/')) { $from = $l.Substring(6) -replace "`t.*$", '' }
    elseif ($l.StartsWith('+++ b/')) { $to = $l.Substring(6) -replace "`t.*$", '' }
  }
  return $res
}

# First changed top-level frontmatter key outside name/description/license (permission, tools,
# invocation flags, metadata...) in a whole-file diff (-U100000); $null when there is none or no frontmatter.
function Get-FrontmatterChange([System.Collections.Generic.List[string]]$lines) {
  $state = 0; $key = ''
  foreach ($l in $lines) {
    if ($l.StartsWith('\')) { continue }
    $t = $l.Substring(1).TrimEnd("`r")
    if ($state -eq 0) {
      if ($t -ne '---') { return $null }
      if ($l[0] -ne ' ') { return '---' }
      $state = 1; continue
    }
    if ($t -eq '---') { if ($l[0] -ne ' ') { return '---' } else { return $null } }
    if ($t -match '^([A-Za-z0-9_-]+)\s*:') { $key = $Matches[1] } elseif ($t -match '^\S') { $key = '?' }
    if ($l[0] -in @('+', '-') -and $key -notin @('name', 'description', 'license')) { return $key }
  }
  return $null
}

# First full-only reason of a measurable diff; the loop goes on so that size and signals are known.
$deferred = $null
function Defer([string]$reason) { if (-not $script:deferred) { $script:deferred = $reason } }

# Size class and signals of the measured (unfiltered) paths; needs $sizeLines, $hasExecBuild, $hasSource, $measured, $hits.
function Set-Measure {
  $script:size = if ($sizeLines -le $SmallLines -and -not $hasExecBuild) { 'small' } else { 'large' }
  $sg = @()
  if ($hits.Count -gt 0) { $sg += 'risky' }
  if (@($measured | Where-Object { $_ -imatch $sensitive }).Count -gt 0) { $sg += 'sensitive' }
  if ($hasSource) { $sg += 'source' }
  $script:signals = $sg
}

# Full with a measured size: small keeps correctness, tests, spec, plus security on risky/sensitive and conventions on source.
function Exit-FullClassified([string]$reason) {
  Set-Measure
  if ($script:size -ne 'small') { Exit-WithResult 'full' $all $reason }
  $keep = @('correctness', 'tests', 'spec')
  if ($script:signals -contains 'risky' -or $script:signals -contains 'sensitive') { $keep += 'security' }
  if ($script:signals -contains 'source') { $keep += 'conventions' }
  $why = @{
    security    = "size small: $sizeLines <= $SmallLines lines, no risky/sensitive trigger"
    conventions = "size small: $sizeLines <= $SmallLines lines, no source file"
  }
  $script:skipped = @($all | Where-Object { $_ -notin $keep } | ForEach-Object { [ordered]@{ dimension = $_; reason = $why[$_] } })
  Exit-WithResult 'full' @($all | Where-Object { $_ -in $keep }) $reason
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
  $sizeLines = 0
  $hasExecBuild = $false
  $hasSource = $false
  $hits = @{}
  $measured = @()
  $paths = @()
  $kindOf = [ordered]@{}
  $scanFiles = @()
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
    # An exec path (e.g. .github/actions/x/dist/index.js) is never dropped by the package filter.
    $isFiltered = ($path -imatch $filtered) -and ($cls1 -notcontains 'exec')
    if (-not $isFiltered) {
      $sizeLines += $changed
      $measured += $files
      if (@($cls1 | Where-Object { $_ -in @('exec', 'build') }).Count -gt 0) { $hasExecBuild = $true }
      if (@($files | Where-Object { $c0 = Get-LocationClass $_; $c0 -eq 'source' -or ($c0 -eq 'instruction' -and $_ -imatch $classes.source) }).Count -gt 0) { $hasSource = $true }
    }
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
    $c = $cls1[0]
    if ($renamed -and $c -in @('test', 'instruction')) { Exit-WithFull "$c file renamed to another file name ($flow)" }
    if ($c -in @('docs', 'manifest')) {
      $kind = $c
      $lines += $changed
    } elseif ($c -eq 'test') {
      if ($code -ne 'A' -and $code -ne 'D' -and (Test-RenameOnly $files)) {
        $kind = 'mechtest'
        $lines += $changed
      } elseif (@($files | Where-Object { $_ -inotmatch $testsPath }).Count -eq 0) {
        $kind = 'tests'
      } else {
        Defer "test file change is not a pure rename of local identifiers: $path"
        if ($isFiltered) { continue }
        $kind = 'tests'
      }
    } elseif ($c -eq 'instruction' -and @($files | Where-Object { $_ -inotmatch $skillText }).Count -eq 0) {
      $kind = 'text'
    } else {
      Defer "content change in $c file: $path"
      if ($isFiltered) { continue }
      $kind = 'other'
    }
    $kindOf[$path] = $kind
    $scanFiles += $files
  }
  if ($lines -gt $MaxLines) { Defer "$lines changed lines exceed threshold $MaxLines" }

  # ONE diff over all content files: added lines are scanned per file kind.
  $diffs = @{}
  if ($scanFiles.Count -gt 0) {
    $d = @(git -c core.quotepath=off --literal-pathspecs diff --ignore-submodules=none -M -U0 --no-color $Range -- @($scanFiles | Select-Object -Unique) 2>$null)
    if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git diff failed' }
    $diffs = Read-Diff $d
    foreach ($p in $kindOf.Keys) {
      if (-not $diffs.ContainsKey($p)) { continue }
      $re = switch ($kindOf[$p]) { 'text' { $riskyText } 'other' { $riskyText } 'tests' { "$riskyCore|$riskyCred" } 'mechtest' { "$risky|$riskyCred" } default { $risky } }
      if (@($diffs[$p].Lines | Where-Object { $_.StartsWith('+') -and $_ -imatch $re }).Count -gt 0) { $hits[$p] = $true }
    }
  }
  if ($deferred) { Exit-FullClassified $deferred }
  $kinds = @($kindOf.Values | Select-Object -Unique)
  $sens = @($paths | Where-Object { $_ -imatch $sensitive })
  $textual = @($kinds | Where-Object { $_ -in @('text', 'tests') }).Count -gt 0

  if ($textual) {
    # Security triggers stay authoritative: a hit anywhere makes the whole diff full.
    if ($kinds -contains 'manifest') { Exit-FullClassified 'manifest change next to skill text or test changes' }
    if ($hits.Count -gt 0) { Exit-FullClassified "security trigger in added lines: $(@($hits.Keys)[0])" }
    if ($sens.Count -gt 0) { Exit-FullClassified "security-sensitive path: $($sens[0])" }
    # Frontmatter (permission, tools, invocation flags): only name, description and license may change.
    # A whole-file diff is needed only when a hunk starts near the top of a skill text file.
    $fm = @($kindOf.Keys | Where-Object { $kindOf[$_] -eq 'text' -and $_ -imatch '\.md$' -and $diffs.ContainsKey($_) -and $diffs[$_].Start -le 60 })
    if ($fm.Count -gt 0) {
      $whole = @(git -c core.quotepath=off --literal-pathspecs diff --ignore-submodules=none -M -U100000 --no-color $Range -- @($scanFiles | Select-Object -Unique) 2>$null)
      if ($LASTEXITCODE -ne 0) { Exit-WithFull 'git diff failed' }
      $wholeDiff = Read-Diff $whole
      foreach ($p in $fm) {
        $bad = if ($wholeDiff.ContainsKey($p)) { Get-FrontmatterChange $wholeDiff[$p].Lines } else { $null }
        if ($bad) { Exit-FullClassified "frontmatter key '$bad' changed in $p" }
      }
    }
    $dims = @('spec')
    if ($kinds -contains 'text') { $dims += @('correctness', 'conventions') }
    if ($kinds -contains 'docs') { $dims += 'conventions' }
    if (@($kinds | Where-Object { $_ -in @('tests', 'mechtest') }).Count -gt 0) { $dims += @('correctness', 'tests') }
    $dims = @($all | Where-Object { $_ -in $dims })
    Set-Measure
    Exit-WithResult 'text' $dims "only skill text, documentation and test changes (no security trigger, scripts or manifests): $(@($kindOf.Keys).Count) files"
  }

  Set-Measure
  $dims = @('correctness', 'spec')
  $secure = ($hits.Count -gt 0) -or ($sens.Count -gt 0) -or ($kinds -contains 'manifest')
  if (-not $secure -and $kinds.Count -eq 1 -and $kinds[0] -eq 'docs') {
    Exit-WithResult 'docs' @('conventions', 'spec') "only documentation changed ($lines changed lines, limit $MaxLines)"
  }
  if ($secure) { $dims = @('correctness', 'security', 'spec') }
  Exit-WithResult 'mechanical' $dims "only same-class renames and $lines changed lines (limit $MaxLines) in docs/manifests/tests (test files: local identifier renames only)"
} catch {
  Exit-WithFull "script error: $($_.Exception.Message)"
}
