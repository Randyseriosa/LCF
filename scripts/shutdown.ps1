# Anchor Point Shutdown Script
# Gracefully stops all development servers without touching Docker.

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host "  ANCHOR POINT - SHUTDOWN SEQUENCE" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host ""

# 1. Kill Next.js dev server (node on port 3000)
Write-Host "[1/3] Stopping Next.js dev server..." -ForegroundColor Cyan

$port3000Pids = @()
$netstatLines = netstat -ano 2>$null | Select-String "LISTENING" | Select-String ":3000 "
foreach ($line in $netstatLines) {
    $parts = ($line -split '\s+')
    $targetPid = $parts[-1]
    if ($targetPid -and $targetPid -ne "0" -and $port3000Pids -notcontains $targetPid) {
        $port3000Pids += $targetPid
    }
}

if ($port3000Pids.Count -gt 0) {
    foreach ($targetPid in $port3000Pids) {
        try {
            $proc = Get-Process -Id ([int]$targetPid) -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host ("  Stopping {0} (PID {1})" -f $proc.ProcessName, $targetPid) -ForegroundColor Yellow
                Stop-Process -Id ([int]$targetPid) -Force -ErrorAction SilentlyContinue
            }
        }
        catch { }
    }
    Write-Host "  Next.js server stopped." -ForegroundColor Green
}
else {
    Write-Host "  No Next.js server found on port 3000." -ForegroundColor DarkGray
}

# Also kill any node processes tied to this project
try {
    $escapedRoot = [regex]::Escape($ProjectRoot)
    $projectNodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match $escapedRoot -or $_.CommandLine -match "next dev"
    }
    if ($projectNodeProcs) {
        foreach ($proc in $projectNodeProcs) {
            Write-Host ("  Stopping node.exe (PID {0})" -f $proc.ProcessId) -ForegroundColor Yellow
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
catch { }

# 2. Kill deno / Supabase functions serve
Write-Host "[2/3] Stopping Supabase Edge Functions..." -ForegroundColor Cyan

$denoProcs = Get-Process -Name "deno" -ErrorAction SilentlyContinue
if ($denoProcs) {
    foreach ($proc in $denoProcs) {
        Write-Host ("  Stopping deno (PID {0})" -f $proc.Id) -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  Functions server stopped." -ForegroundColor Green
}
else {
    Write-Host "  No deno processes found." -ForegroundColor DarkGray
}

# 3. Close the named terminal windows (if they exist)
Write-Host "[3/3] Closing launcher terminal windows..." -ForegroundColor Cyan

$launcherWindows = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "AnchorPoint"
}
if ($launcherWindows) {
    foreach ($proc in $launcherWindows) {
        Write-Host ("  Closing '{0}' (PID {1})" -f $proc.MainWindowTitle, $proc.Id) -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  Terminal windows closed." -ForegroundColor Green
}
else {
    Write-Host "  No launcher terminal windows found." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host "  ANCHOR POINT - ALL SERVICES STOPPED" -ForegroundColor Green
Write-Host "  Docker Desktop was left running (by design)." -ForegroundColor DarkGray
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host ""
