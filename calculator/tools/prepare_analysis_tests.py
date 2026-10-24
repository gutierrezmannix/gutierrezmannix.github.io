"""Fetch trusted webR binary packages for repeatable local integration checks."""
import urllib.request,gzip,json,re,tarfile,hashlib,argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
p=argparse.ArgumentParser();p.add_argument('directory');args=p.parse_args();root=Path(args.directory).resolve();root.mkdir(parents=True,exist_ok=True);base='https://repo.r-wasm.org/bin/emscripten/contrib/4.5/'
cache=root/'PACKAGES.gz'
if not cache.exists():cache.write_bytes(urllib.request.urlopen(base+cache.name,timeout=60).read())
pkgs={}
for part in gzip.decompress(cache.read_bytes()).decode().split('\n\n'):
 d={};key=None
 for line in part.splitlines():
  if line.startswith((' ','\t')) and key:d[key]+=' '+line.strip()
  elif ':' in line:key,value=line.split(':',1);d[key]=value.strip()
 if 'Package' in d:pkgs[d['Package']]=d
basepkgs=set('R base compiler datasets grDevices graphics grid methods parallel splines stats stats4 tcltk tools translations utils webr'.split());needed=set()
def visit(name):
 if name in needed|basepkgs:return
 if name not in pkgs:raise RuntimeError('Unavailable binary dependency: '+name)
 needed.add(name)
 for field in ['Depends','Imports','LinkingTo']:
  for dep in pkgs[name].get(field,'').split(','):
   dep=re.sub(r'\s*\(.*?\)','',dep).strip()
   if dep:visit(dep)
cat=json.loads((Path(__file__).resolve().parents[1]/'src/analysis-catalog.json').read_text())
for name in {'jsonlite','car','lmtest'}|{v for row in cat for v in row['packages']}:visit(name)
print('PACKAGES',len(needed),flush=True)
def fetch(name):
 d=pkgs[name];path=root/(name+'_'+d['Version']+'.tgz');dest=root/'library'/name
 if dest.exists() and (dest/'DESCRIPTION').exists():return name
 if not path.exists():path.write_bytes(urllib.request.urlopen(base+path.name,timeout=120).read())
 if hashlib.md5(path.read_bytes()).hexdigest()!=d['MD5sum']:raise RuntimeError('Package hash mismatch: '+name)
 with tarfile.open(path) as archive:archive.extractall(root/'library',filter='data')
 return name
with ThreadPoolExecutor(max_workers=5) as ex:
 for result in as_completed([ex.submit(fetch,name) for name in sorted(needed)]):print('READY',result.result(),flush=True)
(root/'package-lock.json').write_text(json.dumps({n:pkgs[n] for n in sorted(needed)},indent=2))
