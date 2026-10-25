@echo off
echo =============================================
echo  Shop ^& Inventory - Monorepo Dev Server
echo =============================================
echo.
echo Starting Vite frontend + Node.js API...
echo.
echo  Frontend: http://localhost:5173
echo  API:      http://localhost:3001/api
echo.
echo Create a .env file with:
echo   DATABASE_URL=postgresql://...
echo   JWT_SECRET=your-secret-key
echo.

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

call npm run dev:all
