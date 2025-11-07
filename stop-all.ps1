# Audio2Score Complete Shutdown Script

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Audio2Score Shutdown" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill processes on a specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $connections = netstat -ano | findstr ":$Port"
    if ($connections) {
        $processIds = $connections | ForEach-Object {
            $parts = $_ -split '\s+' | Where-Object { $_ }
            if ($parts[-1] -match '^\d+$') {
                $parts[-1]
            }
        } | Select-Object -Unique
        
        foreach ($processId in $processIds) {
            # Skip system idle process (PID 0) and system process (PID 4)
            if ($processId -and $processId -ne "0" -and $processId -ne "4") {
                try {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Killing process $($process.ProcessName) (PID: $processId) on port $Port" -ForegroundColor Yellow
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Milliseconds 500
                    } else {
                        # Process not found in Get-Process, try taskkill
                        Write-Host "  Attempting to kill orphaned process (PID: $processId) on port $Port" -ForegroundColor Yellow
                        taskkill /PID $processId /F 2>$null
                        Start-Sleep -Milliseconds 500
                    }
                } catch {
                    # Try alternative method
                    try {
                        taskkill /PID $processId /F 2>$null
                        Start-Sleep -Milliseconds 500
                    } catch {
                        # Process already terminated or inaccessible
                    }
                }
            } elseif ($processId -eq "0" -or $processId -eq "4") {
                Write-Host "  Skipping system process (PID: $processId) on port $Port" -ForegroundColor Gray
            }
        }
    }
}

# 1. Kill processes on specific ports
Write-Host "Stopping services on ports..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 3000  # Backend
Stop-ProcessOnPort -Port 4040  # ngrok Web UI
Stop-ProcessOnPort -Port 8081  # Expo (default)
Stop-ProcessOnPort -Port 8082  # Expo (alternative)
Stop-ProcessOnPort -Port 19000 # Expo DevTools
Stop-ProcessOnPort -Port 19001 # Expo DevTools
Stop-ProcessOnPort -Port 19002 # Expo DevTools

Write-Host ""

# 2. Kill all ngrok processes
Write-Host "Stopping ngrok..." -ForegroundColor Yellow
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcesses) {
    $ngrokProcesses | ForEach-Object {
        Write-Host "  Killing ngrok (PID: $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  No ngrok processes found" -ForegroundColor Gray
}

Write-Host ""

# 3. Kill Python processes (Backend)
Write-Host "Stopping Python processes..." -ForegroundColor Yellow
$pythonProcesses = Get-Process -Name "python*" -ErrorAction SilentlyContinue

if ($pythonProcesses) {
    foreach ($proc in $pythonProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            
            # Check if this Python process is related to our project
            if ($cmdLine -and ($cmdLine -like "*Audio2Score*" -or 
                               $cmdLine -like "*uvicorn*" -or 
                               $cmdLine -like "*fastapi*" -or
                               $cmdLine -like "*main:app*")) {
                Write-Host "  Killing Python (PID: $($proc.Id))" -ForegroundColor Yellow
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            }
        } catch {
            # Can't access process info, skip it
        }
    }
} else {
    Write-Host "  No Python processes found" -ForegroundColor Gray
}

Write-Host ""

# 4. Kill Node.js processes related to this project
Write-Host "Stopping Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    # Get project path for filtering
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptDir
    
    $killed = 0
    foreach ($proc in $nodeProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            
            # Check if this Node process is related to our project
            if ($cmdLine -and ($cmdLine -like "*Audio2Score*" -or 
                               $cmdLine -like "*ts-node*" -or 
                               $cmdLine -like "*nodemon*" -or
                               $cmdLine -like "*expo*" -or
                               $cmdLine -like "*metro*")) {
                Write-Host "  Killing Node.js (PID: $($proc.Id))" -ForegroundColor Yellow
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $killed++
            }
        } catch {
            # Can't access process info, skip it
        }
    }
    
    if ($killed -eq 0) {
        Write-Host "  No project-related Node.js processes found" -ForegroundColor Gray
    } else {
        Write-Host "  Killed $killed Node.js process(es)" -ForegroundColor Green
    }
} else {
    Write-Host "  No Node.js processes found" -ForegroundColor Gray
}

Write-Host ""

# 5. Verify ports are free
Write-Host "Verifying ports are free..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$ports = @(3000, 4040, 8081, 8082)
$allFree = $true

foreach ($port in $ports) {
    $connections = netstat -ano | findstr ":$port"
    if ($connections) {
        # Check if it's occupied by a system process (PID 0 or 4)
        $isSystemProcess = $false
        $connections | ForEach-Object {
            $parts = $_ -split '\s+' | Where-Object { $_ }
            if ($parts[-1] -match '^\d+$') {
                $ProcessID = $parts[-1]
                if ($ProcessID -eq "0" -or $ProcessID -eq "4") {
                    $isSystemProcess = $true
                }
            }
        }
        
        if ($isSystemProcess) {
            Write-Host "  Port $port occupied by system process (can be ignored)" -ForegroundColor Gray
        } else {
            Write-Host "  Port $port is still in use" -ForegroundColor Red
            $allFree = $false
        }
    } else {
        Write-Host "  Port $port is free" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
if ($allFree) {
    Write-Host "  All services stopped!" -ForegroundColor Green
} else {
    Write-Host "  Some ports still in use" -ForegroundColor Yellow
    Write-Host "  You may need to restart your computer" -ForegroundColor Yellow
}
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run: .\start-all.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
