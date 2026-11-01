@echo off
rem Rendu dune video du style ANIME (Remotion) sur le PC Windows, carte graphique NVIDIA.
rem Usage, depuis le dossier Konvwa :  videos\_engine\rendre-anime.cmd NomDeLaComposition nom-du-projet
rem Exemple : videos\_engine\rendre-anime.cmd PontShort pont
rem Le son final doit exister : videos\nom-du-projet\audio\mix.wav
if "%~2"=="" (
  echo Usage : videos\_engine\rendre-anime.cmd NomDeLaComposition nom-du-projet
  exit /b 1
)
set PROJ=%~dp0..\%~2
if not exist "%PROJ%\renders" mkdir "%PROJ%\renders"
cd /d "%~dp0..\_remotion" || exit /b 1
if not exist node_modules call npm install --no-audit --no-fund || exit /b 1
echo Rendu de %~1 (60 images par seconde)...
call npx remotion render src/index.ts %~1 "%PROJ%\renders\image.mp4" --codec h264 --crf 16 --gl=angle || exit /b 1
echo Ajout du son...
ffmpeg -v error -y -i "%PROJ%\renders\image.mp4" -i "%PROJ%\audio\mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a pcm_s16le -shortest "%PROJ%\renders\avec-son.mov" || exit /b 1
echo Finition du son...
python -I "%~dp0style-histoire\finish.py" "%PROJ%\renders\avec-son.mov" "%PROJ%\renders\%~2.mp4" || exit /b 1
echo.
echo Video prete : %PROJ%\renders\%~2.mp4
start "" "%PROJ%\renders"
