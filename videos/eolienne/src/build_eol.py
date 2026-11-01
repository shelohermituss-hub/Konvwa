# STYLE STUDIO « Comment une éolienne fait de l'électricité » : python3 -I build_eol.py <dossier vidéo> <dossier de travail> <moteur style-anime>
# Écrit assets/audio/mix.mp3 (la voix seule devant, bruitages discrets dessous, pas de musique) et index.html.
import json,subprocess,os,sys,shutil,re
D,S,ENG=sys.argv[1:4]
V=S+'/eol/vo'
J=json.load(open(V+'/timing.json')); R=J['raw']; VO=J['voice']
W=json.load(open(V+'/disp.json'))
END=round(0.2+VO+1.2,1)
T=[round(0.2+r,2) for r in R]
for d in ('audio','sfx','fonts'): os.makedirs(D+'/assets/'+d,exist_ok=True)
B3=ENG+'/../style-3d/sfx/'
for f in ('clip','ui-blip','pale-swoosh','vent','engrenages','courant','tempete','envoi-tel','moteur-elec','bourdonnement','ambiance-vent'): shutil.copy(B3+f+'.mp3',D+'/assets/sfx/'+f+'.mp3')
for f in ('whoosh','scintille','ding','riser'): shutil.copy(ENG+'/sfx/'+f+'.mp3',D+'/assets/sfx/'+f+'.mp3')
TF=D+'/../telephone/assets/fonts/'
for f in ('jetbrains-mono-500','jetbrains-mono-700','jetbrains-mono-ext-700'): shutil.copy(TF+f+'.woff2',D+'/assets/fonts/'+f+'.woff2')
IF=D+'/../../.claude/skills/embedded-captions/modes/standard/fonts/files/'
for w in (400,700,800): shutil.copy(IF+f'inter-latin-{w}-normal.woff2',D+f'/assets/fonts/inter-{w}.woff2')
bed=S+'/eol/bed.wav'
# no music (variant C): a steady, very soft wind ambience instead, so the pauses never fall to digital silence
subprocess.run(['ffmpeg','-v','error','-y','-stream_loop','-1','-i',D+'/assets/sfx/ambiance-vent.mp3','-t',str(END),'-af',f'highpass=f=280,highpass=f=280,lowpass=f=9000,afade=t=in:d=0.6,afade=t=out:st={END-1.2}:d=1.2','-ac','2','-ar','48000',bed],check=True)
ev=[]; E=lambda f,s,v,cap=None: ev.append([D+'/assets/sfx/'+f+'.mp3',max(0,round(s,2)),v,cap])
CUT=lambda k,v=.16: E('whoosh',T[k]-0.12,v,0.5)
BLIP=lambda k,v=.25: E('ui-blip',T[k]-0.04,v)
# hook
E('pale-swoosh',0.05,.45); BLIP(7); E('pale-swoosh',T[11]+0.2,.4); E('pale-swoosh',T[11]+2.0,.3); E('scintille',T[29],.3)
# on top, wind; not a sail; the wing profile
E('vent',T[46]-0.1,.45,2.6); CUT(50); E('clip',T[57]-0.1,.35); CUT(59); BLIP(63)
# the flow, pressure, lift; rotor starts; the tip
E('vent',T[68],.25,3.0); E('riser',T[86]-0.6,.22,1.2); BLIP(88); E('pale-swoosh',T[95],.45); E('pale-swoosh',T[99]+0.3,.45); E('pale-swoosh',T[104],.5)
# slow shaft, the dial, the nacelle and the bus, the gearbox
E('bourdonnement',T[110],.2,2.5); E('engrenages',T[129]-0.2,.35); BLIP(139); BLIP(144); E('clip',T[149]-0.08,.35)
E('engrenages',T[151],.3,2.0); E('engrenages',T[159],.45); BLIP(164)
# generator, electrons, Faraday
E('bourdonnement',T[168],.3,3.0); E('courant',T[181],.4); E('courant',T[188],.35); E('ding',T[195],.3)
# down the tower, transformer, grid
E('courant',T[202],.3); BLIP(208); E('scintille',T[213],.3)
# the wind turns; vane, anemometer; yaw motors
E('vent',T[218]-0.1,.4,2.0); BLIP(230); BLIP(233); E('moteur-elec',T[237],.35,2.6)
# storm
E('tempete',T[249]-0.1,.45,3.6); E('clip',T[256],.35); E('clip',T[261],.3)
# ending
E('pale-swoosh',T[266],.35); E('engrenages',T[280],.3,1.6); E('whoosh',T[285]-0.1,.25); E('clip',T[290],.3); E('envoi-tel',T[296],.5)
plan={'voice':V+'/vo.wav','voice_start':0.2,'duration':END,'bed':bed,'bed_below_voice_db':20,'sfx_gain':1.3,'events':ev}
json.dump(plan,open(S+'/eol/plan.json','w'))
subprocess.run(['python3','-I',ENG+'/mix_anime.py',S+'/eol/plan.json',S+'/eol/mix.wav'],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',S+'/eol/mix.wav','-c:a','libmp3lame','-b:a','320k',D+'/assets/audio/mix.mp3'],check=True)
KEYW=[10,20,30,42,48,58,66,71,88,97,107,116,132,145,150,152,164,169,171,175,190,191,208,217,230,233,237,262,265,276,279,281,285,287]
SHOTK=[int(x) for x in re.findall(r'\{ k: (\d+),',open(S+'/eol-module.js').read())]
LIGHTK=[int(x) for x in re.findall(r'\{ k: (\d+), g: \[[^\]]*\], light: true',open(S+'/eol-module.js').read())]
mod=open(S+'/eol-module.js').read()
src=open(S+'/eol-shell.html').read().replace('__MODULE__',mod)
src=src.replace('__RAW__','['+', '.join(str(v) for v in R)+']').replace('__WORDS__',json.dumps(W,ensure_ascii=False)).replace('__END__',str(END)).replace('__KEYWORDS__',json.dumps(KEYW)).replace('__SHOTK__',json.dumps(SHOTK)).replace('__LIGHTK__',json.dumps(LIGHTK))
open(D+'/index.html','w').write(src)
print('END',END,'VO',VO,'sons',len(ev),'plans',len(SHOTK),'clairs',LIGHTK)
