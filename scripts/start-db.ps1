# ==============================================================================
# Start Local PostgreSQL Database Server
# ==============================================================================
$pgsqlDir = "$env:LOCALAPPDATA\Programs\pgsql"
$binDir = "$pgsqlDir\bin"
$dataDir = "$pgsqlDir\data"
$logFile = "$pgsqlDir\server.log"

if (-not (Test-Path "$binDir\postgres.exe")) {
    Write-Error "PostgreSQL binaries not found at $binDir"
    exit 1
}

# Check if already running on port 5432
$conn = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "✅ PostgreSQL is already running on port 5432." -ForegroundColor Green
    exit 0
}

# Remove stale postmaster.pid if server died unexpectedly
if (Test-Path "$dataDir\postmaster.pid") {
    Remove-Item "$dataDir\postmaster.pid" -Force
}

Write-Host "🚀 Starting local PostgreSQL database..." -ForegroundColor Cyan
$cmd = "`"$binDir\postgres.exe`" -D `"$dataDir`""
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd } | Out-Null
Start-Sleep -Seconds 2

$conn = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "✅ PostgreSQL local database server started successfully on port 5432!" -ForegroundColor Green
} else {
    Write-Host "⚠️ PostgreSQL server starting up. Log file: $logFile" -ForegroundColor Yellow
}
