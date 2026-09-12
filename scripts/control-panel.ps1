Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = (Get-Location).Path }

function Check-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $connect = $tcp.BeginConnect("127.0.0.1", $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(500)
        if ($wait -and $tcp.Connected) {
            $tcp.EndConnect($connect)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

function Get-LocalIp() {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
        if ($ip) { return $ip }
    } catch {}
    return "127.0.0.1"
}

function Start-Database() {
    if (Check-Port 5432) { return }
    $dataDir = Join-Path $baseDir "data"
    $pidFile = Join-Path $dataDir "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item -Force $pidFile -ErrorAction SilentlyContinue }

    $pgCtl = Join-Path $baseDir "pgsql\bin\pg_ctl.exe"
    $logFile = Join-Path $dataDir "server.log"
    if (Test-Path $pgCtl) {
        Start-Process -FilePath $pgCtl -ArgumentList "-D `"$dataDir`" -l `"$logFile`" start" -WorkingDirectory $baseDir -WindowStyle Hidden -Wait
    } else {
        Start-Process -FilePath "node.exe" -ArgumentList "scripts\start-db.js" -WorkingDirectory $baseDir -WindowStyle Hidden -Wait
    }
}

function Start-Server() {
    if (Check-Port 3000) { return }
    $formattedDir = $baseDir -replace "\\", "/"
    $psCmd = "Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/next/dist/bin/next', 'dev', '-p', '3000', '-H', '0.0.0.0' -WorkingDirectory '$formattedDir' -WindowStyle Hidden"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -WindowStyle Hidden -Command `"$psCmd`"" -WorkingDirectory $baseDir -WindowStyle Hidden
}

function Stop-All() {
    $dataDir = Join-Path $baseDir "data"
    $pgCtl = Join-Path $baseDir "pgsql\bin\pg_ctl.exe"
    if (Test-Path $pgCtl) {
        Start-Process -FilePath $pgCtl -ArgumentList "-D `"$dataDir`" -m fast stop" -WorkingDirectory $baseDir -WindowStyle Hidden -Wait
    }
    Stop-Process -Name "postgres" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    $pidFile = Join-Path $dataDir "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item -Force $pidFile -ErrorAction SilentlyContinue }
}

function Open-Web() {
    Start-Process "http://localhost:3000"
}

# --- Form Construction ---
$form = New-Object System.Windows.Forms.Form
$form.Text = "FORK & FIRE - POS System Controller"
$form.Size = New-Object System.Drawing.Size(520, 520)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(16, 17, 22)
$form.ForeColor = [System.Drawing.Color]::FromArgb(243, 244, 246)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

# Header
$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Location = New-Object System.Drawing.Point(0, 0)
$headerPanel.Size = New-Object System.Drawing.Size(520, 75)
$headerPanel.BackColor = [System.Drawing.Color]::FromArgb(22, 23, 30)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "FORK & FIRE"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(249, 115, 22)
$lblTitle.Location = New-Object System.Drawing.Point(20, 14)
$lblTitle.AutoSize = $true
$headerPanel.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "Restaurant POS System Controller • Offline Local Terminal"
$lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
$lblSub.Location = New-Object System.Drawing.Point(22, 45)
$lblSub.AutoSize = $true
$headerPanel.Controls.Add($lblSub)
$form.Controls.Add($headerPanel)

# Status Panel
$panelStatus = New-Object System.Windows.Forms.Panel
$panelStatus.Location = New-Object System.Drawing.Point(20, 90)
$panelStatus.Size = New-Object System.Drawing.Size(465, 125)
$panelStatus.BackColor = [System.Drawing.Color]::FromArgb(24, 25, 34)

$lblStatusHdr = New-Object System.Windows.Forms.Label
$lblStatusHdr.Text = "SYSTEM STATUS"
$lblStatusHdr.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$lblStatusHdr.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
$lblStatusHdr.Location = New-Object System.Drawing.Point(15, 10)
$lblStatusHdr.AutoSize = $true
$panelStatus.Controls.Add($lblStatusHdr)

$lblSrv = New-Object System.Windows.Forms.Label
$lblSrv.Text = "● POS Web Server: Checking..."
$lblSrv.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblSrv.ForeColor = [System.Drawing.Color]::FromArgb(245, 158, 11)
$lblSrv.Location = New-Object System.Drawing.Point(15, 32)
$lblSrv.AutoSize = $true
$panelStatus.Controls.Add($lblSrv)

$lblDb = New-Object System.Windows.Forms.Label
$lblDb.Text = "● PostgreSQL Database: Checking..."
$lblDb.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblDb.ForeColor = [System.Drawing.Color]::FromArgb(245, 158, 11)
$lblDb.Location = New-Object System.Drawing.Point(15, 54)
$lblDb.AutoSize = $true
$panelStatus.Controls.Add($lblDb)

$linkLocal = New-Object System.Windows.Forms.LinkLabel
$linkLocal.Text = "Local POS URL: http://localhost:3000"
$linkLocal.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$linkLocal.LinkColor = [System.Drawing.Color]::FromArgb(96, 165, 250)
$linkLocal.Location = New-Object System.Drawing.Point(15, 78)
$linkLocal.AutoSize = $true
$linkLocal.Add_LinkClicked({ Open-Web })
$panelStatus.Controls.Add($linkLocal)

$lblNet = New-Object System.Windows.Forms.Label
$lblNet.Text = "Network IP (Tablets/Phones): http://$((Get-LocalIp)):3000"
$lblNet.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$lblNet.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
$lblNet.Location = New-Object System.Drawing.Point(15, 98)
$lblNet.AutoSize = $true
$panelStatus.Controls.Add($lblNet)
$form.Controls.Add($panelStatus)

# Status Message
$lblMsg = New-Object System.Windows.Forms.Label
$lblMsg.Text = "Ready. Click START to begin."
$lblMsg.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Italic)
$lblMsg.ForeColor = [System.Drawing.Color]::FromArgb(156, 163, 175)
$lblMsg.Location = New-Object System.Drawing.Point(20, 222)
$lblMsg.Size = New-Object System.Drawing.Size(465, 20)
$lblMsg.TextAlign = "MiddleCenter"
$form.Controls.Add($lblMsg)

# START Button
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "▶  START & OPEN POS WEB"
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnStart.Location = New-Object System.Drawing.Point(20, 248)
$btnStart.Size = New-Object System.Drawing.Size(465, 48)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(249, 115, 22)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnStart)

# RESTART & STOP
$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Text = "↻  RESTART"
$btnRestart.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnRestart.Location = New-Object System.Drawing.Point(20, 306)
$btnRestart.Size = New-Object System.Drawing.Size(225, 44)
$btnRestart.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$btnRestart.ForeColor = [System.Drawing.Color]::White
$btnRestart.FlatStyle = "Flat"
$btnRestart.FlatAppearance.BorderSize = 0
$btnRestart.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnRestart)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "⏹  STOP SERVERS"
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStop.Location = New-Object System.Drawing.Point(260, 306)
$btnStop.Size = New-Object System.Drawing.Size(225, 44)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
$btnStop.ForeColor = [System.Drawing.Color]::White
$btnStop.FlatStyle = "Flat"
$btnStop.FlatAppearance.BorderSize = 0
$btnStop.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnStop)

# QUIT
$btnQuit = New-Object System.Windows.Forms.Button
$btnQuit.Text = "✕  QUIT & CLOSE CONTROLLER"
$btnQuit.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$btnQuit.Location = New-Object System.Drawing.Point(20, 360)
$btnQuit.Size = New-Object System.Drawing.Size(465, 38)
$btnQuit.BackColor = [System.Drawing.Color]::FromArgb(55, 65, 81)
$btnQuit.ForeColor = [System.Drawing.Color]::White
$btnQuit.FlatStyle = "Flat"
$btnQuit.FlatAppearance.BorderSize = 0
$btnQuit.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnQuit)

# Footer
$lblFooter = New-Object System.Windows.Forms.Label
$lblFooter.Text = "Fork & Fire POS System • Fast Food & Pizza Menu • v1.0"
$lblFooter.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$lblFooter.ForeColor = [System.Drawing.Color]::FromArgb(107, 114, 128)
$lblFooter.Location = New-Object System.Drawing.Point(20, 425)
$lblFooter.Size = New-Object System.Drawing.Size(465, 20)
$lblFooter.TextAlign = "MiddleCenter"
$form.Controls.Add($lblFooter)

# State & Refresh
function Update-Status-Display() {
    $db = Check-Port 5432
    $srv = Check-Port 3000

    if ($db) {
        $lblDb.Text = "● PostgreSQL Database: CONNECTED (Port 5432)"
        $lblDb.ForeColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
    } else {
        $lblDb.Text = "○ PostgreSQL Database: OFFLINE"
        $lblDb.ForeColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
    }

    if ($srv) {
        $lblSrv.Text = "● POS Web Server: RUNNING (Port 3000)"
        $lblSrv.ForeColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
        $btnStart.Text = "🌐  OPEN POS IN BROWSER"
        $btnStart.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
    } else {
        $lblSrv.Text = "○ POS Web Server: STOPPED"
        $lblSrv.ForeColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
        $btnStart.Text = "▶  START & OPEN POS WEB"
        $btnStart.BackColor = [System.Drawing.Color]::FromArgb(249, 115, 22)
    }
}

$btnStart.Add_Click({
    $srv = Check-Port 3000
    if ($srv) {
        Open-Web
        return
    }
    $lblMsg.Text = "Starting Fork & Fire services, please wait..."
    $form.Refresh()
    Start-Database
    Start-Server
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 800
        if (Check-Port 3000) { break }
    }
    Update-Status-Display
    $lblMsg.Text = "Services started successfully!"
    Open-Web
})

$btnRestart.Add_Click({
    $lblMsg.Text = "Restarting services..."
    $form.Refresh()
    Stop-All
    Start-Sleep -Seconds 1
    Start-Database
    Start-Server
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 800
        if (Check-Port 3000) { break }
    }
    Update-Status-Display
    $lblMsg.Text = "System restarted! Ready."
})

$btnStop.Add_Click({
    $lblMsg.Text = "Stopping all services..."
    $form.Refresh()
    Stop-All
    Start-Sleep -Milliseconds 800
    Update-Status-Display
    $lblMsg.Text = "All services stopped."
})

$btnQuit.Add_Click({
    $choice = [System.Windows.Forms.MessageBox]::Show(
        "Do you want to stop background servers before quitting?",
        "Quit Controller",
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($choice -eq [System.Windows.Forms.DialogResult]::Cancel) { return }
    if ($choice -eq [System.Windows.Forms.DialogResult]::Yes) {
        Stop-All
    }
    $form.Close()
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({ Update-Status-Display })
$timer.Start()

Update-Status-Display
[void]$form.ShowDialog()
