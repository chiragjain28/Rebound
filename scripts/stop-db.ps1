# ==============================================================================
# Stop Local PostgreSQL Database Server
# ==============================================================================
$pgsqlDir = "$env:LOCALAPPDATA\Programs\pgsql"
$binDir = "$pgsqlDir\bin"
$dataDir = "$pgsqlDir\data"

if (Test-Path "$binDir\pg_ctl.exe") {
    Write-Host "🛑 Stopping local PostgreSQL database..." -ForegroundColor Yellow
    & "$binDir\pg_ctl.exe" -D "$dataDir" stop
    Write-Host "✅ PostgreSQL local database server stopped." -ForegroundColor Green
} else {
    Write-Warning "pg_ctl.exe not found at $binDir"
}
