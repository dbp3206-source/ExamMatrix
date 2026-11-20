@echo off
setlocal
title Exam Matrix - Che do Docker Day Du
echo ========================================================
echo   KHOI DONG EXAM MATRIX (DOCKER: POSTGRES + BACKEND + FRONTEND)
echo ========================================================
echo.
echo Luu y: Hay chac chan ban da mo ung dung Docker Desktop tren may!
echo.
cd /d "%~dp0"
if not exist ".env" (
    echo Khong tim thay file .env.
    echo Hay copy .env.example thanh .env va dat DB_PASSWORD, JWT_SECRET truoc khi chay.
    exit /b 1
)
set "EXAM_DOCKER=docker.exe"
where.exe docker.exe >nul 2>&1
if errorlevel 1 (
    set "EXAM_DOCKER=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"
    if not exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
        echo Khong tim thay Docker CLI. Hay cai Docker Desktop hoac them docker.exe vao PATH.
        exit /b 1
    )
)
echo Dang cap nhat va khoi dong cac container Docker...
"%EXAM_DOCKER%" compose up -d --build --wait frontend
if errorlevel 1 (
    echo Docker Compose khoi dong that bai. Kiem tra Docker Desktop va thong bao loi phia tren.
    exit /b 1
)
echo.
echo ========================================================
echo He thong da san sang!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8080
echo Database Postgres: localhost:5433
where.exe curl.exe >nul 2>&1
if not errorlevel 1 (
    for /f %%S in ('curl.exe --silent --max-time 8 --output NUL --write-out "%%{http_code}" --request POST http://localhost:3000/auth/google/student/challenge') do (
        if "%%S"=="200" (
            echo Google Sign-In: backend da khoi tao duoc xac thuc; can thu dang nhap tren trinh duyet.
        ) else if "%%S"=="503" (
            echo Google Sign-In: thieu GOOGLE_CLIENT_ID trong .env. Dang nhap bang mat khau van kha dung.
        ) else (
            echo Google Sign-In: endpoint khoi tao tra HTTP %%S. Hay kiem tra backend va proxy Docker.
        )
    )
)
echo (Neu trinh duyet con luu giao dien cu, hay nhan Ctrl + F5 de lam moi)
echo ========================================================
echo.
echo Dang mo trinh duyet...
start http://localhost:3000
pause
