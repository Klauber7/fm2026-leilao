from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, random

W,H=3210,1840
OUT=Path("public/champions")
OUT.mkdir(parents=True,exist_ok=True)
INK=(233,244,255); GOLD=(250,210,117)
font_r="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_b="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F=lambda n,b=False:ImageFont.truetype(font_b if b else font_r,n)

# Exactly the 15 approved fixture records: per-team first leg, second leg and aggregate.
R16=[
 dict(a="Grêmio FZ",b="Porto FZ",ida=(1,1),volta=(1,1),win="Grêmio FZ",pen=True),
 dict(a="Corinthians",b="Bahia FZ",ida=(2,1),volta=(1,1),win="Corinthians"),
 dict(a="Oeste Brasil FZ",b="Flamengo FZ",ida=(1,1),volta=(1,0),win="Oeste Brasil FZ"),
 dict(a="Vasco FZ",b="Benfica FZ",ida=(1,1),volta=(2,1),win="Vasco FZ"),
 dict(a="Sport FZ",b="Ajax FZ",ida=(1,0),volta=(0,0),win="Sport FZ"),
 dict(a="Cruzeiro FZ",b="Nacional de Patos FZ",ida=(1,1),volta=(2,0),win="Cruzeiro FZ"),
 dict(a="Ibis FZ",b="Duque de Caxias",ida=(2,2),volta=(1,1),win="Ibis FZ",pen=True),
 dict(a="Internacional FZ",b="Juventude FZ",ida=(2,2),volta=(2,0),win="Internacional FZ"),
]
QF=[
 dict(a="Grêmio FZ",b="Corinthians",ida=(4,2),volta=(2,3),win="Grêmio FZ"),
 dict(a="Oeste Brasil FZ",b="Vasco FZ",ida=(4,1),volta=(4,2),win="Oeste Brasil FZ"),
 dict(a="Sport FZ",b="Cruzeiro FZ",ida=(1,0),volta=(3,1),win="Sport FZ"),
 dict(a="Ibis FZ",b="Internacional FZ",ida=(1,0),volta=(3,3),win="Ibis FZ"),
]
SF=[
 dict(a="Grêmio FZ",b="Oeste Brasil FZ",ida=(3,2),volta=(2,4),win="Oeste Brasil FZ"),
 dict(a="Sport FZ",b="Ibis FZ",ida=(3,2),volta=(2,2),win="Sport FZ"),
]
FINAL=dict(a="Oeste Brasil FZ",b="Sport FZ",ida=(3,2),volta=(1,0),win="Oeste Brasil FZ")
for m in R16+QF+SF+[FINAL]:
 m["agg"]=(sum((m["ida"][0],m["volta"][0])),sum((m["ida"][1],m["volta"][1])))
 assert m["win"]==m["a"] and m["agg"][0]>m["agg"][1] or m["win"]==m["b"] and m["agg"][1]>m["agg"][0] or m["agg"][0]==m["agg"][1] and m.get("pen")
for i,m in enumerate(QF):
 assert {m["a"],m["b"]}=={R16[2*i]["win"],R16[2*i+1]["win"]}
assert {SF[0]["a"],SF[0]["b"]}=={QF[0]["win"],QF[1]["win"]}
assert {SF[1]["a"],SF[1]["b"]}=={QF[2]["win"],QF[3]["win"]}
assert {FINAL["a"],FINAL["b"]}=={SF[0]["win"],SF[1]["win"]}
assert FINAL["agg"]==(4,2)

img=Image.new("RGB",(W,H));px=img.load()
for y in range(H):
 for x in range(W):
  fx=x/W;fy=y/H; glow=max(0,1-math.hypot((fx-.51)*1.5,(fy-1.04)*1.4))
  px[x,y]=(7+int(9*glow)+int(5*fy),17+int(28*glow)+int(11*fy),36+int(45*glow)+int(14*fy))
D=ImageDraw.Draw(img,"RGBA");rng=random.Random(27)
D.ellipse((-300,1350,3500,2230),outline=(39,108,168,90),width=7)
D.ellipse((200,1440,3200,2150),outline=(38,106,168,60),width=5)
for i in range(150):
 x=rng.randrange(W); y=rng.randrange(1300,H);D.ellipse((x,y,x+2,y+2),fill=(88,158,244,rng.randrange(30,95)))
for i in range(14):
 xa=rng.randrange(W);ya=rng.randrange(45,H)
 D.line((xa,ya,xa+rng.randrange(-600,700),ya+rng.randrange(70,480)),fill=(35,92,184,26),width=rng.randrange(2,7))
D.rounded_rectangle((52,36,3155,159),radius=25,fill=(3,11,27,188),outline=(74,143,208,92),width=2)
D.text((92,59),"CHAMPIONS CUP FZ",font=F(63,True),fill=(243,248,255))
D.text((99,129),"FRIENDZONE LEAGUE    •    TEMPORADA 2026    •    IDA + VOLTA + AGREGADO",font=F(21),fill=(148,186,221))
D.text((3007,82),"★",font=F(58,True),fill=GOLD,anchor="mm")

X=[52,722,1396,2080];WIDTH=[590,560,550,530];h=162
y16=[210+i*185 for i in range(8)]
cent16=[y+h/2 for y in y16]
cyq=[(cent16[i]+cent16[i+1])/2 for i in (0,2,4,6)]
cysemi=[(cyq[0]+cyq[1])/2,(cyq[2]+cyq[3])/2];cyfin=sum(cysemi)/2
YQ=[int(y-h/2) for y in cyq];YSF=[int(y-h/2) for y in cysemi];YF=int(cyfin-h/2)
for lab,x,w in zip(("OITAVAS DE FINAL","QUARTAS DE FINAL","SEMIFINAIS","FINAL"),X,WIDTH):
 D.rounded_rectangle((x,174,x+w,201),radius=7,fill=(18,52,88,236),outline=(57,143,212,112),width=1)
 D.text((x+w/2,187),lab,font=F(21,True),fill=GOLD,anchor="mm")
def connect_children(xsrc,ws,children,xtarget,target):
 x0=xsrc+ws+5;join=(x0+xtarget-16)/2;rgb=(70,169,235,180)
 for yy in children:D.line((x0,yy,join,yy),fill=rgb,width=4)
 D.line((join,min(children),join,max(children)),fill=rgb,width=4)
 D.line((join,target,xtarget-10,target),fill=rgb,width=4)
 D.ellipse((join-5,target-5,join+5,target+5),fill=(254,204,107,215))
for i in range(4):connect_children(X[0],WIDTH[0],[cent16[2*i],cent16[2*i+1]],X[1],cyq[i])
for i in range(2):connect_children(X[1],WIDTH[1],[cyq[2*i],cyq[2*i+1]],X[2],cysemi[i])
connect_children(X[2],WIDTH[2],cysemi,X[3],cyfin)

def tfit(s,font_size,max_width,min_size=16):
 size=font_size
 while size>min_size and D.textbbox((0,0),s,font=F(size,True))[2]>max_width:size-=1
 return F(size,True)
def draw_card(x,y,w,m):
 D.rounded_rectangle((x+2,y+4,x+w+4,y+h+4),radius=15,fill=(0,0,0,65))
 D.rounded_rectangle((x,y,x+w,y+h),radius=15,fill=(7,25,49,242),outline=(57,135,205,200),width=2)
 D.rounded_rectangle((x+2,y+2,x+w-2,y+21),radius=12,fill=(25,60,97,148))
 D.line((x+12,y+121,x+w-12,y+121),fill=(49,89,132,170),width=2)
 sx=[x+w-168,x+w-104,x+w-39]
 for label,xx in zip(("IDA","VOLTA","TOTAL"),sx):
  D.text((xx,y+17),label,font=F(16,True),fill=(144,187,218),anchor="mm")
 for k,team in enumerate((m["a"],m["b"])):
  ty=y+47+k*39;winner=team==m["win"]
  if winner:D.rounded_rectangle((x+11,ty-8,x+16,ty+22),radius=2,fill=GOLD)
  D.text((x+27,ty),team,font=tfit(team,24,sx[0]-x-56,17),fill=(255,237,192) if winner else (221,237,249))
  for xx,v in zip(sx,(m["ida"][k],m["volta"][k],m["agg"][k])):
   D.text((xx,ty+15),str(v),font=F(28,True),fill=(255,225,147) if winner else (204,221,237),anchor="mm")
 foot="CLASSIFICADO: "+m["win"]+(" • PÊNALTIS" if m.get("pen") else "")
 D.text((x+20,y+132),foot,font=tfit(foot,20,w-36,16),fill=GOLD)
for i,m in enumerate(R16):draw_card(X[0],y16[i],WIDTH[0],m)
for i,m in enumerate(QF):draw_card(X[1],YQ[i],WIDTH[1],m)
for i,m in enumerate(SF):draw_card(X[2],YSF[i],WIDTH[2],m)
draw_card(X[3],YF,WIDTH[3],FINAL)

cx=2670;cw=480;cy=int(cyfin)
D.line((X[3]+WIDTH[3],cy,cx-20,cy),fill=(251,192,98,220),width=6)
D.rounded_rectangle((cx,468,cx+cw,1305),radius=30,fill=(7,23,45,246),outline=(245,185,83,238),width=4)
D.text((cx+cw/2,554),"GRANDE CAMPEÃO",font=F(33,True),fill=GOLD,anchor="mm")
D.text((cx+cw/2,625),"CHAMPIONS CUP 2026",font=F(21),fill=(199,222,245),anchor="mm")
# Use the club's ORIGINAL logo file from the FriendZone repository, not a generated crest.
crest=Image.open("public/team-logos/oeste-brasil-fz.png").convert("RGBA")
# Strip only outer transparent whitespace, never redraw the club's emblem.
if crest.getbbox():crest=crest.crop(crest.getbbox())
crest.thumbnail((225,270),Image.Resampling.LANCZOS)
img.paste(crest,(int(cx+cw/2-crest.width/2),685+int((270-crest.height)/2)),crest)
D=ImageDraw.Draw(img,"RGBA")
D.rounded_rectangle((cx+32,1033,cx+cw-32,1160),radius=20,fill=(206,145,46,240),outline=(255,228,161,250),width=3)
D.text((cx+cw/2,1075),"OESTE BRASIL FZ",font=F(35,True),fill=(15,31,52),anchor="mm")
D.text((cx+cw/2,1134),"FINAL  •  4 × 2",font=F(25,True),fill=(25,43,65),anchor="mm")
D.text((cx+cw/2,1228),"CAMPEÃO DA CHAMPIONS CUP FZ",font=F(17),fill=(171,194,220),anchor="mm")
D.text((W/2,H-42),"RESULTADOS TRANSCRITOS DAS 5 IMAGENS ORIGINAIS   •   COLUNAS: IDA / VOLTA / AGREGADO   •   PRÉVIA PARA APROVAÇÃO",font=F(21),fill=(146,175,201),anchor="mm")
path=OUT/"chaveamento-oficial.png"
img.save(path,optimize=True)
print("CREATED",path,path.stat().st_size)
