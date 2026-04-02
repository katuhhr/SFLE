$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "SFLE"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$managePy = Join-Path $backendDir "manage.py"

if (-not (Test-Path $venvPython)) {
    Write-Host "Не найден python из venv: $venvPython" -ForegroundColor Red
    Write-Host "Создай окружение: py -3 -m venv .\SFLE\.venv" -ForegroundColor Yellow
    exit 1
}

# Запускаем backend в отдельном окне PowerShell
$backendCommand = "cd -LiteralPath '$backendDir'; & '$venvPython' '$managePy' runserver 127.0.0.1:8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

# Небольшая пауза, чтобы backend успел стартовать
Start-Sleep -Seconds 1

# Запускаем frontend в текущем окне
Set-Location -LiteralPath $rootDir
npm.cmd start
