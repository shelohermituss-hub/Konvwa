# Exemple (ép. 2) : python3 -I build_exemple.py <dossier vidéo> <dossier de travail> — remplit END/VO/RAW/WORDS, mixe la musique (enveloppe K) et écrit les balises de sons
import json,re,subprocess,glob,os,sys,numpy as np
S=sys.argv[2]  # dossier de travail : tr-timing.json, tr-tokens.json, fl-bed-long.wav
D=sys.argv[1]
J=json.load(open(S+'/tr-timing.json')); R=J['raw']; VO=J['voice']
W=json.load(open(S+'/tr-tokens.json'))
END=round(0.2+VO+1.5,1)
T=[round(0.2+r,2) for r in R]
M=[round(T[k]-0.1,2) for k in [10,16,29,35,53,64,73,82,92,104,109]]
p0=round(0.2+J['pauses']['73'][0],2)
K=[(0,1),(p0,1),(p0+0.04,0),(T[82]-0.03,0),(T[82]+0.02,1.1),(T[104]-0.1,1.1),(T[104]+0.1,0.7),(END-1.6,0.7),(END,0)]
SR=44100
a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',S+'/fl-bed-long.wav','-t',str(END),'-ac','2','-ar',str(SR),'-f','s16le','-']),np.int16).astype(np.float32).reshape(-1,2)
t=np.arange(len(a))/SR; g=np.interp(t,[k[0] for k in K],[k[1] for k in K])
subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(SR),'-ac','2','-i','-','-b:a','192k',D+'/assets/music/bed.mp3'],input=np.clip(a*g[:,None],-32768,32767).astype(np.int16).tobytes())
dur={os.path.basename(f):float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f])) for f in glob.glob(D+'/assets/sfx/*')}
ev=[('whoosh.mp3',0,.3,None),('whoosh-short.mp3',0.06,.25,None),('impact-bass-1.mp3',T[9],.35,None)]
ev+=[('whoosh.mp3',m-0.18,.2,None) for m in M]
ev+=[('pop.mp3',T[k]-.05,.25,None) for k in (10,11,12)]
ev+=[('pop.mp3',M[1]+.05,.2,None),('pop.mp3',T[26]-.05,.25,None),('pop.mp3',M[2]+.4,.2,None)]
ev+=[('pop.mp3',M[3]+.2,.22,None),('dechirure.mp3',T[39]+.05,.45,None),('pop.mp3',T[61]-.05,.22,None),('pop.mp3',M[5]+.2,.22,None)]
ev+=[('key-press.mp3',T[67],.2,None),('key-press.mp3',T[68]+.2,.2,None),('key-press.mp3',T[71],.2,None)]
ev+=[('scratch.mp3',p0-0.02,.4,None),('impact-bass-2.mp3',T[77]+.13,.45,None),('click.mp3',T[77]+.15,.3,None)]
ev+=[('impact-bass-2.mp3',T[82],.4,None),('pop.mp3',T[90]-.05,.25,None)]
ev+=[('pop.mp3',T[93]-.05,.22,None),('pop.mp3',T[95]-.05,.22,None),('sparkle.mp3',T[103]-.1,.22,None)]
ev+=[('whoosh-short.mp3',T[106]-.1,.25,None),('whoosh-short.mp3',T[108]-.1,.25,None),('pop.mp3',T[108]+.2,.25,None)]
ev+=[('pop.mp3',T[116]-.1,.28,None),('click.mp3',T[117],.4,None),('sparkle.mp3',T[117]+.1,.2,None)]
ev.sort(key=lambda e:e[1])
free={k:0.0 for k in range(20,40)}; tags=[]
for i,(f,s,v,cap) in enumerate(ev):
    s=max(0,round(s,2)); d=round(min(dur[f],cap or 99,END-s),2)
    tr=next(k for k in sorted(free) if free[k]<=s); free[tr]=s+d+0.01
    tags.append(f'      <audio id="sx{i}" src="assets/sfx/{f}" data-start="{s}" data-duration="{d}" data-track-index="{tr}" data-volume="{v}"></audio>')
src=open(D+'/index.html').read()
src=re.sub(r'\n      <audio id="sx\d+"[^\n]*</audio>','',src)
mark='<!-- Sons : calés sur les mots de la voix (mêmes temps que T dans le script) -->'
src=src.replace(mark,mark+'\n'+'\n'.join(tags))
src=src.replace('__END__',str(END)).replace('__VO__',str(round(VO,2)))
src=re.sub(r'const END = [0-9.]+','const END = '+str(END),src)
src=re.sub(r'data-composition-id="main" data-start="0" data-duration="[0-9.]+"',f'data-composition-id="main" data-start="0" data-duration="{END}"',src)
src=re.sub(r'(<audio id="vo"[^>]*data-duration=")[0-9.]+',lambda m:m.group(1)+str(round(VO,2)),src)
src=re.sub(r'(<audio id="music"[^>]*data-duration=")[0-9.]+',lambda m:m.group(1)+str(END),src)
raw='const RAW = ['+', '.join(str(v) for v in R)+']'
src=src.replace('const RAW = __RAW__',raw); src=re.sub(r'const RAW = \[[^\]]*\]',lambda m:raw,src)
wd='const WORDS = '+json.dumps(W,ensure_ascii=False)
src=src.replace('const WORDS = __WORDS__',wd); src=re.sub(r'const WORDS = \[[^\n]*\]',lambda m:wd,src)
open(D+'/index.html','w').write(src)
print('END',END,'VO',VO,'sfx',len(tags),'p0',p0,'T82',T[82])
