@echo off
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\scripts\build-and-install.ps1" || powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\scripts\build-and-install.ps1"
