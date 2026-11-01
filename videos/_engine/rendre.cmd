@echo off
rem Rendu dune video sur un PC Windows avec carte graphique.
rem Usage, depuis le dossier Konvwa :  videos\_engine\rendre.cmd serrure
if "%~1"=="" (
  echo Usage : videos\_engine\rendre.cmd nom-du-projet   ^(ex. : serrure^)
  exit /b 1
)
cd /d "%~dp0..\%~1" || exit /b 1
if not exist renders mkdir renders
echo Rendu de %~1 en 60 images par seconde...
call npx --yes hyperframes@0.8.168 render --fps 60 --quality looks --output renders\raw60.mp4 || exit /b 1
echo Finition du son...
python -I ..\_engine\style-histoire\finish.py renders\raw60.mp4 renders\%~1.mp4 || exit /b 1
echo.
echo Video prete : %cd%\renders\%~1.mp4
start "" "%cd%\renders"
