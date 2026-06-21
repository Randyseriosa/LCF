# Anchor Point Launch Script
# This script automates the startup sequence for the Inventory System.

$ProjectRoot = "d:\Project\Inventorysys\lcfpf-inv-sys"
Set-Location $ProjectRoot

# 0. Ensure Docker is running
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Write-Host "Docker Desktop is not running. Starting Docker..." -ForegroundColor Yellow
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
        Write-Host "Waiting for Docker to initialize..." -ForegroundColor Cyan
        Start-Sleep -Seconds 10 # Give it some time to boot
    }
    else {
        Write-Host "Docker Desktop executable not found at standard path. Please start Docker manually." -ForegroundColor Red
    }
}
else {
    Write-Host "Docker is already running." -ForegroundColor Green
}

# 1. Start development servers in separate windows
Write-Host "Starting Next.js development server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command", "npm run dev"

Write-Host "Starting Supabase functions..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command", "npm run function"

# 2. Wait for localhost:3000 to be available
Write-Host "Waiting for OLCF6 to initialize..." -ForegroundColor Cyan
while ($true) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -ErrorAction SilentlyContinue -UseBasicParsing
        if ($response.StatusCode -eq 200) { 
            Write-Host "Server is ready!" -ForegroundColor Green
            break 
        }
    }
    catch {
        # Port not ready yet
    }
    Start-Sleep -Seconds 2
}

# 3. Open in Site-Specific Browser (SSB) mode
# Priority: Edge (standard on Windows), then Chrome
$edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$chromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"

if (Test-Path $edgePath) {
    Write-Host "Launching Site-Specific Browser (Edge)..." -ForegroundColor Green
    Start-Process $edgePath -ArgumentList "--app=http://localhost:3000"
}
elseif (Test-Path $chromePath) {
    Write-Host "Launching Site-Specific Browser (Chrome)..." -ForegroundColor Green
    Start-Process $chromePath -ArgumentList "--app=http://localhost:3000"
}
else {
    Write-Host "Launching in default browser (no SSB detected)..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
}
