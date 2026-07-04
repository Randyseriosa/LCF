@echo off
cd /d "%~dp0"
title Anchor Point Launcher
powershell -ExecutionPolicy Bypass -File "scripts\launch.ps1"
exit
