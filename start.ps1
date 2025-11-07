# start_services.ps1

# Define path variables
$projectPath = "D:\Programing\Artificial_Intelligence\Audio2Score"
$backendPath = "$projectPath\Audio2Score-backend"
$frontendPath = "$projectPath\Audio2Score"
$condaEnvPath = "D:\Anaconda3\envs\Audio2Score"

# Function to extract ngrok URL
function Get-NgrokUrl {
    Write-Host "Waiting for ngrok URL..." -ForegroundColor Yellow
    $maxAttempts = 10
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            # Use ngrok API to get tunnel information
            $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
            if ($response.tunnels.Count -gt 0) {
                foreach ($tunnel in $response.tunnels) {
                    if ($tunnel.proto -eq "https") {
                        $publicUrl = $tunnel.public_url
                        $domain = $publicUrl.Replace("https://", "")
                        Write-Host "Found ngrok URL: $publicUrl" -ForegroundColor Green
                        return $domain
                    }
                }
            }
        }
        catch {
            # Ngrok API not ready yet
            Write-Host "Attempt $($attempt + 1): Waiting for ngrok..." -ForegroundColor Gray
        }
        
        $attempt++
        Start-Sleep -Seconds 2
    }
    
    Write-Host "Failed to get ngrok URL automatically" -ForegroundColor Red
    return $null
}

# Terminal 1: Start backend server
Write-Host "Starting backend server..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd /d `"$backendPath`" && conda activate `"$condaEnvPath`" && python main.py"

# Wait for backend server to start
Start-Sleep -Seconds 3

# Terminal 2: Start ngrok
Write-Host "Starting ngrok..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$projectPath`"; ngrok http 3000"

# Wait for ngrok to start and get URL automatically
$ngrokUrl = Get-NgrokUrl

if (-not $ngrokUrl) {
    # Fallback to manual input
    Write-Host "Please check the Forwarding URL in ngrok window" -ForegroundColor Cyan
    Write-Host "Format example: https://6bc4abd44494.ngrok-free.app -> http://localhost:3000" -ForegroundColor Cyan
    $ngrokUrl = Read-Host "Please enter ngrok domain name (example: 6bc4abd44494.ngrok-free.app)"
}

$fullNgrokUrl = "https://$ngrokUrl"
Write-Host "Updating ngrok URL with: $fullNgrokUrl" -ForegroundColor Green

# Terminal 3: Update ngrok URL - 修改 Python 腳本執行方式
# 使用 timeout 來避免 input() 錯誤
$updateCommand = @"
cd /d "$backendPath" && conda activate "$condaEnvPath" && echo $fullNgrokUrl | python update_ngrok_url.py && timeout /t 3
"@

Start-Process cmd -ArgumentList "/k", $updateCommand

# Terminal 4: Start frontend
Write-Host "Starting frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$frontendPath`"; npx expo start -c --tunnel"

Write-Host "All services started successfully!" -ForegroundColor Green
Write-Host "Ngrok URL: $fullNgrokUrl" -ForegroundColor Cyan
Write-Host "Please check the status in each terminal window" -ForegroundColor Yellow
Write-Host "Note: You may need to restart the frontend (Terminal 4) for the changes to take effect" -ForegroundColor Yellow