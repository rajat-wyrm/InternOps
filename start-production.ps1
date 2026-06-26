# start-production.ps1
# Build and run the full stack using Docker Compose

Write-Host "=== BUILDING DOCKER IMAGES ===" -ForegroundColor Cyan
docker-compose build

Write-Host "`n=== STARTING SERVICES ===" -ForegroundColor Cyan
docker-compose up -d

Write-Host "`n=== WAITING FOR DATABASE ===" -ForegroundColor Yellow
Start-Sleep 10

Write-Host "`n=== RUNNING MIGRATIONS ===" -ForegroundColor Cyan
docker-compose exec backend npm run migrate

Write-Host "`n=== SEEDING ADMIN USER ===" -ForegroundColor Cyan
docker-compose exec backend npm run seed

Write-Host "`n=== SERVICES READY ===" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000"
Write-Host "Swagger: http://localhost:5000/docs"
Write-Host "PostgreSQL: localhost:5432"

docker-compose ps