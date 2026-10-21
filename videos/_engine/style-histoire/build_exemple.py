# Exemple v2 (« Santa María ») : python3 -I build_exemple.py <dossier vidéo> <dossier de travail> — remplit END/VO/RAW/WORDS/SCRATCH, mixe la musique (coupure au scratch, retour sur le mot qui suit « Bilan »), écrit les balises de sons des transitions (inondation, iris, poussée) et des objets
import json,re,subprocess,glob,os,sys,numpy as np
S=sys.argv[2]  # dossier de travail : sm-timing.json (align_voice.py), sm-tokens.json, fl-bed-long.wav (musique-bed.mp3 bouclée)
D=sys.argv[1]
J=json.load(open(S+'/sm-timing.json')); R=J['raw']; VO=J['voice']
W=json.load(open(S+'/sm-tokens.json'))
END=round(0.2+VO+1.5,1)
T=[round(0.2+r,2) for r in R]
M=[round(T[k]-0.1,2) for k in [11,20,27,40,53,56,61,87]]
p0=round(0.2+J['pauses']['74'][0],2)
K=[(0,1),(p0,1),(p0+0.04,0),(T[75]-0.03,0),(T[75]+0.02,1.1),(T[87]-0.1,1.1),(T[87]+0.1,0.7),(END-1.6,0.7),(END,0)]
SR=44100
a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',S+'/fl-bed-long.wav','-t',str(END),'-ac','2','-ar',str(SR),'-f','s16le','-']),np.int16).astype(np.float32).reshape(-1,2)
t=np.arange(len(a))/SR; g=np.interp(t,[k[0] for k in K],[k[1] for k in K])
subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(SR),'-ac','2','-i','-','-b:a','192k',D+'/assets/music/bed.mp3'],input=np.clip(a*g[:,None],-32768,32767).astype(np.int16).tobytes())
dur={os.path.basename(f):float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f])) for f in glob.glob(D+'/assets/sfx/*')}
X=dict(s2=M[0],s3=M[1],s4=M[2],s5=M[3],s6=M[4],s7=M[5],s8=M[6],s9=round(p0+0.3,2),s10=M[7])
H9=T[75]-0.14-X['s9']
ev=[('whoosh.mp3',0,.3,None),('whoosh-short.mp3',0.05,.25,None),('impact-bass-1.mp3',0.1,.3,None)]
for k,h in (('s2',0),('s6',0),('s9',H9)): ev+=[('whoosh.mp3',X[k]-0.32,.25,None),('whoosh-short.mp3',X[k]+h,.2,None)]
for k in ('s5','s7'): ev+=[('whoosh-short.mp3',X[k]-0.28,.22,None),('click.mp3',X[k]-0.02,.3,None),('click-soft.mp3',X[k]+0.1,.25,None)]
for k in ('s3','s4','s8','s10'): ev+=[('whoosh.mp3',X[k]-0.15,.25,None)]
ev+=[('whoosh-short.mp3',T[3]-0.1,.25,None),('click.mp3',T[3]+0.3,.25,None),('pop.mp3',T[7]-0.1,.25,None)]
ev+=[('pop.mp3',X['s2']+0.05,.22,None),('pop.mp3',T[18]-0.15,.22,None),('pop.mp3',T[19]-0.05,.2,None)]
ev+=[('impact-bass-2.mp3',T[20]+0.1,.4,None),('dechirure.mp3',T[20]+0.05,.3,None),('pop.mp3',T[23]-0.08,.25,None),('pop.mp3',T[24]-0.05,.2,None)]
ev+=[('impact-bass-1.mp3',T[28]-0.2+i*0.12+0.28,.22,None) for i in range(3)]
ev+=[('whoosh-short.mp3',T[31]-0.05,.22,None),('pop.mp3',T[31]+0.15,.28,None),('sparkle.mp3',T[31]+0.3,.18,None),('pop.mp3',T[33]-0.05,.2,None),('pop.mp3',T[35]-0.1,.22,None)]
ev+=[('pop.mp3',T[41]-0.05,.25,None),('pop.mp3',T[50]-0.1,.2,None)]
ev+=[('pop.mp3',X['s6']+0.05+i*0.28,.25,None) for i in range(3)]+[('key-press.mp3',X['s6']+0.1+i*0.28,.15,None) for i in range(3)]
ev+=[('pop.mp3',T[57]+0.1,.2,None),('pop.mp3',X['s8']+0.15,.25,None),('pop.mp3',T[62]-0.05,.22,None)]
ev+=[('key-press.mp3',T[63],.2,None),('key-press.mp3',T[66],.2,None),('key-press.mp3',T[71],.22,None)]
ev+=[('riser.mp3',T[66],.16,T[68]-T[66]+0.15),('pop.mp3',T[68]-0.05,.28,None)]
ev+=[('impact-bass-2.mp3',T[72]+0.13,.45,None),('click.mp3',T[72]+0.15,.3,None)]
ev+=[('scratch.mp3',p0-0.02,.4,None),('impact-bass-2.mp3',T[75],.45,None),('pop.mp3',X['s9']+H9+0.15,.25,None),('chime.mp3',T[82],.18,None),('sparkle.mp3',T[85],.22,None),('pop.mp3',T[85]-0.08,.2,None)]
ev+=[('pop.mp3',T[96]-0.1,.25,None),('pop.mp3',T[98]-0.1,.25,None),('pop.mp3',T[99]-0.12,.25,None),('click.mp3',T[100],.4,None),('sparkle.mp3',T[100]+.1,.2,None)]
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
src=src.replace('__SCRATCH__',str(p0)).replace('__END__',str(END)).replace('__VO__',str(round(VO,2)))
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
