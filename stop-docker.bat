@echo off
title Exam Matrix - Dung Docker
cd /d "%~dp0"
echo Dang dung he thong Exam Matrix Docker...
set "EXAM_DOCKER=docker.exe"
where.exe docker.exe >nul 2>&1
if errorlevel 1 (
    set "EXAM_DOCKER=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"
    if not exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
        echo Khong tim thay Docker CLI. Hay mo Docker Desktop hoac them docker.exe vao PATH.
        exit /b 1
    )
)
"%EXAM_DOCKER%" compose down
echo Da dung xong!
pause
