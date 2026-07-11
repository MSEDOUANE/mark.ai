@echo off
rem Dev server launcher: system Node is v6, so prepend Node v22 to PATH —
rem Turbopack spawns child `node` processes that must also resolve to v22.
set "PATH=C:\Users\MSI\AppData\Local\nvm\v22.21.1;%PATH%"
"C:\Users\MSI\AppData\Local\nvm\v22.21.1\node.exe" node_modules\next\dist\bin\next dev
