@echo off
REM ============================================================
REM InternOps Load Test Runner
REM Runs all load test scenarios using k6 and Artillery
REM ============================================================
echo ====================================================
echo   InternOps Load Test Suite
echo   %date% %time%
echo ====================================================
echo.

set TEST_DIR=%~dp0

REM Check for k6
where k6 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] k6 not found. Install from https://k6.io/docs/get-started/installation/
    echo     Or use: choco install k6
    echo     Or use: winget install k6
    echo.
    set K6_AVAILABLE=0
) else (
    echo [+] k6 found
    set K6_AVAILABLE=1
)

REM Check for Artillery
where artillery >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Artillery not found. Install: npm install -g artillery
    echo.
    set ARTILLERY_AVAILABLE=0
) else (
    echo [+] Artillery found
    set ARTILLERY_AVAILABLE=1
)

REM Check for Node.js report generator
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js not found. Report generation disabled.
    set NODE_AVAILABLE=0
) else (
    echo [+] Node.js found
    set NODE_AVAILABLE=1
)

echo.
echo ====================================================
echo   Available Test Suites
echo ====================================================
echo   1. Baseline Test (10 users, 10 min)
echo   2. Normal Load Test (100 users, 30 min)
echo   3. Peak Load Test (2000 users, 30 min)
echo   4. Stress Test (gradual to 5000+)
echo   5. Spike Test (50 to 500 sudden)
echo   6. Endurance Test (100 users, 2-4 hrs)
echo   7. Full Test Suite (all of the above)
echo   8. Quick Smoke Test (2 min)
echo.
set /p CHOICE="Select test suite (1-8): "

if "%CHOICE%"=="1" goto baseline
if "%CHOICE%"=="2" goto normal
if "%CHOICE%"=="3" goto peak
if "%CHOICE%"=="4" goto stress
if "%CHOICE%"=="5" goto spike
if "%CHOICE%"=="6" goto endurance
if "%CHOICE%"=="7" goto full
if "%CHOICE%"=="8" goto smoke
echo Invalid choice. Exiting.
exit /b 1

:baseline
    echo.
    echo ====================================================
    echo   Running Baseline Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        echo [*] Running k6 baseline...
        cd /d "%TEST_DIR%k6"
        k6 run --vus 10 --duration 5m --summary-export "%TEST_DIR%reports\baseline-summary.json" stress-test.js --stage "2m:10" --stage "5m:10" --stage "2m:0"
        echo [+] k6 baseline complete
    )
    if "%ARTILLERY_AVAILABLE%"=="1" (
        echo [*] Running Artillery baseline...
        cd /d "%TEST_DIR%artillery"
        artillery run --output "%TEST_DIR%reports\baseline-artillery.json" baseline.yml
        echo [+] Artillery baseline complete
    )
    goto report

:normal
    echo.
    echo ====================================================
    echo   Running Normal Load Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --summary-export "%TEST_DIR%reports\normal-summary.json" mixed-workload.js
        echo [+] k6 normal load complete
    )
    if "%ARTILLERY_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%artillery"
        artillery run --output "%TEST_DIR%reports\normal-artillery.json" normal-load.yml
        echo [+] Artillery normal load complete
    )
    goto report

:peak
    echo.
    echo ====================================================
    echo   Running Peak Load Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --summary-export "%TEST_DIR%reports\peak-summary.json" stress-test.js
        echo [+] k6 peak load complete
    )
    if "%ARTILLERY_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%artillery"
        artillery run --output "%TEST_DIR%reports\peak-artillery.json" peak-load.yml
        echo [+] Artillery peak load complete
    )
    goto report

:stress
    echo.
    echo ====================================================
    echo   Running Stress Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --summary-export "%TEST_DIR%reports\stress-summary.json" stress-test.js
        echo [+] k6 stress test complete
    )
    if "%ARTILLERY_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%artillery"
        artillery run --output "%TEST_DIR%reports\stress-artillery.json" peak-load.yml
        echo [+] Artillery stress test complete
    )
    goto report

:spike
    echo.
    echo ====================================================
    echo   Running Spike Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --summary-export "%TEST_DIR%reports\spike-summary.json" spike-test.js
        echo [+] k6 spike test complete
    )
    echo [*] Running Artillery spike...
    if "%ARTILLERY_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%artillery"
        artillery run --output "%TEST_DIR%reports\spike-artillery.json" peak-load.yml
        echo [+] Artillery spike complete
    )
    goto report

:endurance
    echo.
    echo ====================================================
    echo   Running Endurance Test
    echo ====================================================
    echo [*] This test runs for 2+ hours...
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --summary-export "%TEST_DIR%reports\endurance-summary.json" endurance-test.js
        echo [+] k6 endurance test complete
    )
    goto report

:full
    echo.
    echo ====================================================
    echo   Running Full Test Suite
    echo ====================================================
    call :baseline
    call :normal
    call :peak
    call :stress
    call :spike
    echo.
    echo [*] Full test suite complete!
    goto report

:smoke
    echo.
    echo ====================================================
    echo   Running Quick Smoke Test
    echo ====================================================
    if "%K6_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%k6"
        k6 run --vus 5 --duration 30s --summary-export "%TEST_DIR%reports\smoke-summary.json" spike-test.js
        echo [+] k6 smoke test complete
    )
    goto report

:report
    echo.
    echo ====================================================
    echo   Generating Reports
    echo ====================================================
    if "%NODE_AVAILABLE%"=="1" (
        cd /d "%TEST_DIR%reports"
        node generate-report.js
        echo [+] HTML report generated
    ) else (
        echo [!] Node.js not available. Skipping report generation.
    )
    echo.
    echo ====================================================
    echo   Load testing complete!
    echo   Reports saved to: %TEST_DIR%reports\
    echo ====================================================
    pause
    exit /b 0
