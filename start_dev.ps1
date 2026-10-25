Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Shop & Inventory - Monorepo Dev Server" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api" -ForegroundColor Yellow
Write-Host ""
Write-Host "Make sure .env contains:" -ForegroundColor Gray
Write-Host "  DATABASE_URL=postgresql://..." -ForegroundColor Gray
Write-Host "  JWT_SECRET=your-secret-key" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Yellow
  npm install
}

npm run dev:all
