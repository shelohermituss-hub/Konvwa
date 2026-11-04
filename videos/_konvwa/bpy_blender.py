# Faux « blender.exe » pour une machine sans Blender installé mais avec le module Python bpy (Blender 5.2 en module,
# ex. le serveur cloud de Claude) : comprend la ligne de commande du moteur
#   blender -b --factory-startup [--gpu-backend X] -P <script.py> -- <arguments du script>
# et exécute le script dans ce Python (où `import bpy` marche). Rendu EEVEE logiciel (Mesa llvmpipe) : lent mais exact.
import runpy
import sys


def main(argv):
    script, rest = None, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--':
            rest = argv[i + 1:]
            break
        if a == '-P' and i + 1 < len(argv):
            script = argv[i + 1]
            i += 2
            continue
        if a == '--gpu-backend':
            i += 2
            continue
        i += 1  # -b, --factory-startup et les autres options de Blender : sans objet ici
    if not script:
        sys.exit('bpy_blender : il manque -P <script.py>')
    sys.argv = ['blender', '--'] + rest
    runpy.run_path(script, run_name='__main__')


if __name__ == '__main__':
    main(sys.argv[1:])
