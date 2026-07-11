# Anchor Point Launch Script
# This script automates the startup sequence for the Inventory System.
# It safely cleans up orphaned processes from a previous session before starting.

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Get-Location
}
Set-Location $ProjectRoot

# ─────────────────────────────────────────────────────────────────
# PHASE 0: Ensure Docker Desktop is running
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host "  ANCHOR POINT - SYSTEM LAUNCH SEQUENCE" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host ""

Write-Host "[PHASE 0] Checking Docker Desktop..." -ForegroundColor Cyan

$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Write-Host "  Docker Desktop is not running. Starting Docker..." -ForegroundColor Yellow
    $dockerPaths = @(
        "C:\Users\HP\AppData\Roaming\Microsoft\Windows\Start Menu\Docker Desktop.lnk",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Docker Desktop.lnk",
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk",
        "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk"
    )

    $foundPath = $null
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            $foundPath = $path
            break
        }
    }

    if ($foundPath) {
        Write-Host "  Found Docker Desktop at: $foundPath" -ForegroundColor DarkGray
        
        $targetPath = $foundPath
        if ($foundPath -like "*.lnk") {
            try {
                $sh = New-Object -ComObject WScript.Shell
                $resolved = $sh.CreateShortcut($foundPath).TargetPath
                if ($resolved -and (Test-Path $resolved)) {
                    Write-Host "  Resolved shortcut target: $resolved" -ForegroundColor DarkGray
                    $targetPath = $resolved
                }
            }
            catch {
                # Fallback to starting shortcut itself if resolving fails
            }
        }

        Start-Process $targetPath
        Write-Host "  Waiting for Docker engine to initialize..." -ForegroundColor Yellow

        # Wait for Docker daemon to become responsive (up to 120 seconds)
        $dockerReady = $false
        $maxWait = 120
        $elapsed = 0
        while (-not $dockerReady -and $elapsed -lt $maxWait) {
            Start-Sleep -Seconds 3
            $elapsed += 3
            try {
                $null = docker info 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $dockerReady = $true
                }
            }
            catch {
                # Docker not ready yet
            }
            Write-Host ("  Waiting... ({0}s / {1}s)" -f $elapsed, $maxWait) -ForegroundColor DarkGray
        }

        if ($dockerReady) {
            Write-Host "  Docker engine is ready." -ForegroundColor Green
        }
        else {
            Write-Host "  WARNING: Docker did not become ready within $maxWait seconds." -ForegroundColor Red
            Write-Host "  Please start Docker Desktop manually and re-run this script." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    else {
        Write-Host "  Docker Desktop executable or shortcut not found at standard or client paths." -ForegroundColor Red
        Write-Host "  Please start Docker manually and re-run this script." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
else {
    # Docker Desktop process exists, but verify the daemon is responsive
    Write-Host "  Docker Desktop process detected. Verifying daemon..." -ForegroundColor DarkGray
    $dockerReady = $false
    $maxWait = 30
    $elapsed = 0
    while (-not $dockerReady -and $elapsed -lt $maxWait) {
        try {
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
            }
        }
        catch { }
        if (-not $dockerReady) {
            Start-Sleep -Seconds 3
            $elapsed += 3
            Write-Host ("  Docker daemon not ready yet... ({0}s)" -f $elapsed) -ForegroundColor DarkGray
        }
    }

    if ($dockerReady) {
        Write-Host "  Docker is running and responsive." -ForegroundColor Green
    }
    else {
        Write-Host "  WARNING: Docker Desktop is running but daemon is unresponsive." -ForegroundColor Red
        Write-Host "  Try restarting Docker Desktop manually." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ─────────────────────────────────────────────────────────────────
# PHASE 1: Clean up orphaned processes from previous sessions
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[PHASE 1] Cleaning up orphaned processes..." -ForegroundColor Cyan

# 1a. Kill any process listening on port 3000 (stale Next.js dev server)
$stalePort3000 = @()
$netstatLines = netstat -ano 2>$null | Select-String "LISTENING" | Select-String ":3000 "
foreach ($line in $netstatLines) {
    $parts = ($line -split '\s+')
    $targetPid = $parts[-1]
    if ($targetPid -and $targetPid -ne "0" -and $stalePort3000 -notcontains $targetPid) {
        $stalePort3000 += $targetPid
    }
}

if ($stalePort3000.Count -gt 0) {
    foreach ($targetPid in $stalePort3000) {
        try {
            $proc = Get-Process -Id ([int]$targetPid) -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host ("  Terminating stale process on port 3000: {0} (PID {1})" -f $proc.ProcessName, $targetPid) -ForegroundColor Yellow
                Stop-Process -Id ([int]$targetPid) -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # Process may have already exited
        }
    }
    Start-Sleep -Seconds 1
    Write-Host "  Port 3000 cleared." -ForegroundColor Green
}
else {
    Write-Host "  Port 3000 is free." -ForegroundColor Green
}

# 1b. Kill any stale deno processes (Supabase functions serve)
$staleDeno = Get-Process -Name "deno" -ErrorAction SilentlyContinue
if ($staleDeno) {
    foreach ($proc in $staleDeno) {
        Write-Host ("  Terminating stale deno process: PID {0}" -f $proc.Id) -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
    Write-Host "  Stale deno processes cleared." -ForegroundColor Green
}
else {
    Write-Host "  No stale deno processes found." -ForegroundColor Green
}

# 1c. Kill orphaned node processes from previous Next.js sessions
#     Be selective: only kill node processes whose command line references this project
try {
    $escapedRoot = [regex]::Escape($ProjectRoot)
    $staleNodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match $escapedRoot -or $_.CommandLine -match "next dev"
    }

    if ($staleNodeProcesses) {
        foreach ($proc in $staleNodeProcesses) {
            Write-Host ("  Terminating stale node process: PID {0}" -f $proc.ProcessId) -ForegroundColor Yellow
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
        Write-Host "  Stale node processes cleared." -ForegroundColor Green
    }
    else {
        Write-Host "  No stale node processes found." -ForegroundColor Green
    }
}
catch {
    Write-Host "  Skipped node cleanup (WMI unavailable)." -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────────────────────────
# PHASE 2: Start Supabase (if not already running)
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[PHASE 2] Checking Supabase local stack..." -ForegroundColor Cyan

$supabaseRunning = $false
try {
    $statusOutput = npx supabase status 2>&1
    if ($LASTEXITCODE -eq 0 -and ($statusOutput -match "API URL")) {
        $supabaseRunning = $true
    }
}
catch { }

if ($supabaseRunning) {
    Write-Host "  Supabase is already running. Skipping start." -ForegroundColor Green
}
else {
    Write-Host "  Starting Supabase local stack..." -ForegroundColor Yellow
    npx supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Supabase failed to start." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "  Supabase started successfully." -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────
# PHASE 3: Start development servers in new terminal windows
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[PHASE 3] Starting development servers..." -ForegroundColor Cyan

# Create helper scripts in temp to avoid complex quoting issues
$devScript = Join-Path $env:TEMP "anchorpoint_dev.ps1"
$funcScript = Join-Path $env:TEMP "anchorpoint_func.ps1"

# Write the dev server launcher
@"
`$Host.UI.RawUI.WindowTitle = 'AnchorPoint - Next.js Dev'
Set-Location '$ProjectRoot'
npm run dev
"@ | Set-Content -Path $devScript -Encoding UTF8

# Write the functions launcher
@"
`$Host.UI.RawUI.WindowTitle = 'AnchorPoint - Functions'
Set-Location '$ProjectRoot'
npm run function
"@ | Set-Content -Path $funcScript -Encoding UTF8

Write-Host "  Starting Next.js development server (npm run dev)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $devScript

Write-Host "  Starting Supabase Edge Functions (npm run function)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $funcScript

# ─────────────────────────────────────────────────────────────────
# PHASE 4: Wait for localhost:3000 to become available
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[PHASE 4] Waiting for server readiness..." -ForegroundColor Cyan

$maxWaitServer = 120
$elapsedServer = 0
while ($elapsedServer -lt $maxWaitServer) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -ErrorAction SilentlyContinue -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            Write-Host ("  Server is ready! (took {0}s)" -f $elapsedServer) -ForegroundColor Green
            break
        }
    }
    catch {
        # Port not ready yet
    }
    Start-Sleep -Seconds 2
    $elapsedServer += 2
    if ($elapsedServer % 10 -eq 0) {
        Write-Host ("  Still waiting... ({0}s / {1}s)" -f $elapsedServer, $maxWaitServer) -ForegroundColor DarkGray
    }
}

if ($elapsedServer -ge $maxWaitServer) {
    Write-Host "  WARNING: Server did not become ready within $maxWaitServer seconds." -ForegroundColor Red
    Write-Host "  Check the Next.js terminal window for errors." -ForegroundColor Red
    Read-Host "Press Enter to continue anyway, or Ctrl+C to abort"
}

# ─────────────────────────────────────────────────────────────────
# PHASE 5: Launch browser in Site-Specific Browser (SSB) mode
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[PHASE 5] Launching browser..." -ForegroundColor Cyan

$edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$chromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"

if (Test-Path $edgePath) {
    Write-Host "  Launching Site-Specific Browser (Edge)..." -ForegroundColor Green
    Start-Process $edgePath -ArgumentList "--app=http://localhost:3000"
}
elseif (Test-Path $chromePath) {
    Write-Host "  Launching Site-Specific Browser (Chrome)..." -ForegroundColor Green
    Start-Process $chromePath -ArgumentList "--app=http://localhost:3000"
}
else {
    Write-Host "  Launching in default browser..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
}

# Clean up temp scripts
Remove-Item -Path $devScript -Force -ErrorAction SilentlyContinue
Remove-Item -Path $funcScript -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host "  ANCHOR POINT - ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  To shut down, close the 'AnchorPoint - Next.js Dev'" -ForegroundColor DarkGray
Write-Host "  and 'AnchorPoint - Functions' terminal windows." -ForegroundColor DarkGray
Write-Host ""
