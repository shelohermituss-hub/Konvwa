# STYLE STUDIO « Comment une clé ouvre une serrure » : python3 -I build_serr.py <dossier vidéo> <dossier de travail> <moteur style-anime>
# Écrit assets/audio/mix.mp3 (la voix devant, ambiance de pièce très basse, bruitages discrets, pas de musique) et index.html.
import json,subprocess,os,sys,shutil,re
D,S,ENG=sys.argv[1:4]
V=S+'/clef/vo'
J=json.load(open(V+'/timing.json')); R=J['raw']; VO=J['voice']
W=json.load(open(V+'/disp.json'))
END=round(0.2+VO+2.4,1)
T=[round(0.2+r,2) for r in R]
for d in ('audio','sfx','fonts'): os.makedirs(D+'/assets/'+d,exist_ok=True)
B3=ENG+'/../style-3d/sfx/'
for f in ('clip','ui-blip','cle-entre','cle-tourne','cle-bloquee','porte-grince','ressort','ambiance-piece','envoi-tel'): shutil.copy(B3+f+'.mp3',D+'/assets/sfx/'+f+'.mp3')
for f in ('whoosh','scintille','ding','frottement'): shutil.copy(ENG+'/sfx/'+f+'.mp3',D+'/assets/sfx/'+f+'.mp3')
TF=D+'/../telephone/assets/fonts/'
for f in ('jetbrains-mono-500','jetbrains-mono-700','jetbrains-mono-ext-700'): shutil.copy(TF+f+'.woff2',D+'/assets/fonts/'+f+'.woff2')
IF=D+'/../../.claude/skills/embedded-captions/modes/standard/fonts/files/'
for w in (400,700,800): shutil.copy(IF+f'inter-latin-{w}-normal.woff2',D+f'/assets/fonts/inter-{w}.woff2')
bed=S+'/clef/bed.wav'
# no music (variant C): a steady, very soft room tone so the pauses never fall to digital silence
subprocess.run(['ffmpeg','-v','error','-y','-stream_loop','-1','-i',D+'/assets/sfx/ambiance-piece.mp3','-t',str(END),'-af',f'highpass=f=200,highpass=f=200,lowpass=f=9000,afade=t=in:d=0.6,afade=t=out:st={END-1.2}:d=1.2','-ac','2','-ar','48000',bed],check=True)
ev=[]; E=lambda f,s,v,cap=None: ev.append([D+'/assets/sfx/'+f+'.mp3',max(0,round(s,2)),v,cap])
BLIP=lambda k,v=.25: E('ui-blip',T[k]-0.04,v)
# two keys, the door
E('clip',0.05,.3); BLIP(1); BLIP(5); E('cle-tourne',T[13]-0.1,.5); E('cle-bloquee',T[17]-0.05,.4)
# the key approaches, the lock is cut in two, the plug, the pins
E('cle-entre',T[22],.4,1.2); E('whoosh',T[29],.3,0.6); BLIP(39); E('scintille',T[56],.3)
# one stack: bottom, top, spring
BLIP(64); BLIP(68); E('ressort',T[73],.45); E('ressort',T[76]+0.1,.3)
# without a key: blocked
BLIP(88); E('cle-bloquee',T[95]-0.05,.45)
# the key goes in, the pins align, it turns, the bolt, the door
E('cle-entre',T[99]-0.1,.55); E('clip',T[116],.3); E('ding',T[128],.35); E('cle-tourne',T[139]-0.15,.55); E('clip',T[143],.3); E('porte-grince',T[146],.35)
# the neighbour's key
E('cle-entre',T[150],.45); BLIP(164); E('cle-bloquee',T[169]-0.05,.5)
# Egypt, wooden pins
E('scintille',T[176],.3); E('frottement',T[185],.35,1.2)
# ending: aligned, share sheet
E('ding',T[196],.3); E('whoosh',T[199]-0.1,.2,0.6); E('clip',T[204],.3); E('envoi-tel',T[208],.5)
plan={'voice':V+'/vo.wav','voice_start':0.2,'duration':END,'bed':bed,'bed_below_voice_db':20,'sfx_gain':1.3,'events':ev}
json.dump(plan,open(S+'/clef/plan.json','w'))
subprocess.run(['python3','-I',ENG+'/mix_anime.py',S+'/clef/plan.json',S+'/clef/mix.wav'],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',S+'/clef/mix.wav','-c:a','libmp3lame','-b:a','320k',D+'/assets/audio/mix.mp3'],check=True)
KEYW=[6,13,29,39,56,73,88,95,103,128,139,143,152,164,170,176,180,187,196,199,201]
mod=open(S+'/serr-module.js').read()
SHOTK=[int(x) for x in re.findall(r'\{ k: (\d+),',mod)]
src=open(S+'/serr-shell.html').read().replace('__MODULE__',mod)
src=src.replace('__PHONE_K__','199').replace('__PICK_K__','204').replace('__TAP_K__','207').replace('__SEND_K__','208')
src=src.replace('__RAW__','['+', '.join(str(v) for v in R)+']').replace('__WORDS__',json.dumps(W,ensure_ascii=False)).replace('__END__',str(END)).replace('__KEYWORDS__',json.dumps(KEYW)).replace('__SHOTK__',json.dumps(SHOTK)).replace('__LIGHTK__','[]')
open(D+'/index.html','w').write(src)
print('END',END,'VO',VO,'sons',len(ev),'plans',len(SHOTK))
