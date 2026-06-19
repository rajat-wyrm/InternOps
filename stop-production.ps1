# stop-production.ps1
docker-compose down
Write-Host "Services stopped." -ForegroundColor Green