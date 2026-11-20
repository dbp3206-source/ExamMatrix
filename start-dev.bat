@echo off
title Exam Matrix - Che do Nhanh (Vite Dev)
echo ========================================================
echo   KHOI DONG EXAM MATRIX (CHE DO NHANH - VITE DEV)
echo ========================================================
echo.
cd /d "%~dp0\frontend"
if not defined VITE_USE_MOCK_API set "VITE_USE_MOCK_API=false"
if /i "%VITE_USE_MOCK_API%"=="false" (
    echo Che do API that. Can khoi dong backend truoc khi dang nhap.
) else (
    echo Che do du lieu mo phong. Google Sign-In khong kha dung.
)
echo Dang khoi chay may chu Frontend...
start http://localhost:5173
call pnpm dev
if errorlevel 1 exit /b 1
pause
