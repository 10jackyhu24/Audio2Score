# start_services.ps1

# Define path variables
$projectPath = "C:\Users\JellySu\Desktop\VScode_temp_folder\Audio2Score"
$backendPath = "$projectPath\Audio2Score-backend"
$frontendPath = "$projectPath\Audio2Score"
$condaEnvPath = "C:\Users\JellySu\anaconda3\envs\audio2score"

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
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$projectPath`"; ngrok http 3000 --region=jp"

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

# Terminal 3: Update ngrok URL in frontend files
# Using timeout to avoid input() errors
$updateCommand = @"
cd /d "$backendPath" && conda activate "$condaEnvPath" && echo $fullNgrokUrl | python update_ngrok_url.py && timeout /t 3
"@

Start-Process cmd -ArgumentList "/k", $updateCommand

# Terminal 4: Start frontend (without --tunnel since we use ngrok for backend API)
Write-Host "Starting frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$frontendPath`"; npx expo start -c --tunnel"

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Green
Write-Host "✅ All services started successfully!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend (Expo):" -ForegroundColor Cyan
Write-Host "   - Scan QR Code with Expo Go App" -ForegroundColor White
Write-Host "   - Or press 'a' to launch Android emulator (optional)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Backend API (via ngrok):" -ForegroundColor Cyan
Write-Host "   - Ngrok URL: $fullNgrokUrl" -ForegroundColor Yellow
Write-Host "   - Local URL: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "💡 Important Notes:" -ForegroundColor Magenta
Write-Host "   1. Frontend runs via Expo Go (mobile) or emulator" -ForegroundColor White
Write-Host "   2. Frontend connects to backend API via ngrok URL" -ForegroundColor White
Write-Host "   3. Make sure RecordScreen.tsx NGROK_URL is updated to:" -ForegroundColor White
Write-Host "      const NGROK_URL = '$fullNgrokUrl';" -ForegroundColor Yellow
Write-Host ""