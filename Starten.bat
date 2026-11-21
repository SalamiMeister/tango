@echo off
rem Doppelklick startet Tango im Browser (Entwicklungsmodus).
cd /d "%~dp0"
if not exist node_modules (
  echo Installiere Abhaengigkeiten ^(nur beim ersten Mal^) ...
  call npm install
)
call npm start
