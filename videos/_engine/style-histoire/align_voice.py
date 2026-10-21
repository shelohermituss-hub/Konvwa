# usage: align_voice.py raw.wav words.json tokens.json out.wav timing.json tempo '{"k":keep_seconds_before_token_k}' '{"k":insert_seconds_before_token_k}'
import json,re,difflib,subprocess,sys,numpy as np
raw,wj,tj,outw,outj,tempo,keepj,insj=sys.argv[1:9]
TEMPO=float(tempo); KEEP={int(k):v for k,v in json.loads(keepj).items()}; INS={int(k):v for k,v in json.loads(insj).items()}
toks=json.load(open(tj)); ws=json.load(open(wj))
out=subprocess.run(['ffmpeg','-hide_banner','-i',raw,'-af','silencedetect=n=-38dB:d=0.08','-f','null','-'],capture_output=True,text=True).stderr
ss=[float(x) for x in re.findall(r'silence_start: ([0-9.]+)',out)]; se=[float(x) for x in re.findall(r'silence_end: ([0-9.]+)',out)]
sil=list(zip(ss,se))
norm=lambda s: re.sub(r"[^\w']",'',s.lower().replace(' ','').replace('’',"'"))
A=[norm(t) for t in toks]; B=[norm(w['text']) for w in ws]
st=[None]*len(toks)
for tag,i1,i2,j1,j2 in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes():
    if tag=='equal':
        for k in range(i2-i1): st[i1+k]=ws[j1+k]['start']
    elif j2>j1:
        for k in range(i2-i1): st[i1+k]=ws[min(j1+k,j2-1)]['start']
        if (i2-i1)!=(j2-j1): print('replace',toks[i1:i2],[w['text'] for w in ws[j1:j2]])
for i in range(len(st)):
    if st[i] is None: st[i]=st[i-1]+0.1
anch=list(st); before={}
for i in range(1,len(toks)):
    if re.search(r'[.,:?!…]$',toks[i-1]):
        best=min(sil,key=lambda x:abs(x[1]-st[i])) if sil else None
        if best and abs(best[1]-st[i])<0.4: anch[i]=best[1]; before[i]=best
SR=24000
a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',raw,'-ac','1','-ar',str(SR),'-f','s16le','-']),np.int16).astype(np.float32)
def quiet(t0,t1):
    h=int(0.01*SR); best=None
    for x in range(int(t0*SR),int(t1*SR),h):
        r=np.sqrt(np.mean(a[x:x+h]**2))
        if best is None or r<best[0]: best=(r,x/SR)
    return best[1]
EDITS=[]  # (start,end,inserted)
owner={}
for k,(s,e) in before.items(): owner[(s,e)]=k
for s,e in sil:
    k=owner.get((s,e)); DEF=KEEP.get(-1,0.2); L=KEEP.get(k,DEF) if k is not None else DEF
    if e-s>L+0.03: EDITS.append([s+L/2,e-L/2,0.0])
# lengthen short sentence-end pauses up to the target (when a default target is given)
if -1 in KEEP:
    for k in range(1,len(toks)):
        if not re.search(r'[.?!:…]$',toks[k-1]) or k in INS: continue
        L=KEEP.get(k,KEEP[-1])
        if k in before:
            s,e=before[k]
            if e-s<L-0.03: INS[k]=L-(e-s)
        else: INS[k]=L
for k,ins in INS.items():
    if k in before: s,e=before[k]; c=(s+e)/2
    else: c=quiet(anch[k]-0.2,anch[k]+0.05)
    hit=[E for E in EDITS if E[0]<=c<=E[1]]
    if hit: hit[0][2]+=ins
    else: EDITS.append([c,c,ins])
EDITS.sort()
seg=[];prev=0;F=int(.008*SR)
for s,e,ins in EDITS:
    x=a[int(prev*SR):int(s*SR)].copy()
    if seg: x[:F]*=np.linspace(0,1,F)
    x[-F:]*=np.linspace(1,0,F); seg.append(x); seg.append(np.zeros(int(ins*SR),np.float32)); prev=e
x=a[int(prev*SR):].copy(); x[:F]*=np.linspace(0,1,F); seg.append(x)
b=np.concatenate(seg)
subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-af',f'atempo={TEMPO}',outw],input=b.astype(np.int16).tobytes())
def m(t):
    sh=0
    for s,e,ins in EDITS:
        if t>=e and not (s==e and t<s): sh+=(e-s)-ins
        elif s<t<e: return (s-sh)/TEMPO
    return (t-sh)/TEMPO
R=[round(m(anch[i]),3) for i in range(len(toks))]
for i in range(1,len(R)):
    if R[i]<=R[i-1]+0.04: R[i]=round(R[i-1]+0.05,3)
dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',outw]))
pauses={k:[round(m(s)+0.0,3),round(R[k],3)] for k,(s,e) in before.items()}
json.dump({'raw':R,'tokens':toks,'voice':round(dur,3),'pauses':pauses},open(outj,'w'),ensure_ascii=False)
print('voice',round(dur,2),'edits',len(EDITS))
