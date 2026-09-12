Set objShell = CreateObject("WScript.Shell")
objShell.Run "taskkill /F /IM postgres.exe /T", 0, True
