@echo off
set SCRIPT_DIR=%~dp0
set PACKAGE_DIR=%SCRIPT_DIR%..\src
set PYTHONPATH=%PACKAGE_DIR%;%PYTHONPATH%
python -m apm_install %*
