"""Construye las dos versiones de Máquina de escribir.

  python3 build.py                 -> docs/ (app web para GitHub Pages)
                                      dist/maquina-de-escribir.html (versión para claude.ai)
"""
import glob, hashlib, os, shutil, subprocess, sys

root = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(root, 'src/style.css'), encoding='utf-8').read()
js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(root, 'src/js/*.js'))))

# comprobación de sintaxis
os.makedirs(os.path.join(root, 'test'), exist_ok=True)
tmp = os.path.join(root, 'test/_bundle.js')
open(tmp, 'w', encoding='utf-8').write('(function(){"use strict";\n' + js + '\n});')
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
if r.returncode:
    print(r.stderr); sys.exit(1)

version = hashlib.sha1((css + js).encode('utf-8')).hexdigest()[:10]

# 1) versión para claude.ai (un solo archivo)
body = open(os.path.join(root, 'src/body.html'), encoding='utf-8').read()
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
art = body.replace('/*CSS*/', css).replace('/*JS*/', js)
open(os.path.join(root, 'dist/maquina-de-escribir.html'), 'w', encoding='utf-8').write(art)

# 2) app web
web = os.path.join(root, 'web')
docs = os.path.join(root, 'docs')
if os.path.isdir(docs):
    shutil.rmtree(docs)
os.makedirs(docs)
shell = open(os.path.join(web, 'shell.html'), encoding='utf-8').read()
open(os.path.join(docs, 'index.html'), 'w', encoding='utf-8').write(shell.replace('/*CSS*/', css).replace('/*JS*/', js).replace('/*VERSION*/', version))
sw = open(os.path.join(web, 'sw.js'), encoding='utf-8').read().replace('/*VERSION*/', version)
open(os.path.join(docs, 'sw.js'), 'w', encoding='utf-8').write(sw)
for f in ['manifest.webmanifest', 'spell-worker.js']:
    shutil.copy(os.path.join(web, f), docs)
shutil.copytree(os.path.join(web, 'icons'), os.path.join(docs, 'icons'))
shutil.copytree(os.path.join(web, 'dict'), os.path.join(docs, 'dict'))
open(os.path.join(docs, '.nojekyll'), 'w').write('')
print('ok', version, 'web', os.path.getsize(os.path.join(docs, 'index.html')), 'bytes; claude.ai', len(art), 'bytes')
