@echo off
cd /d "%~dp0"
title Anchor Point - Shutdown
powershell -ExecutionPolicy Bypass -File "scripts\shutdown.ps1"
pause
