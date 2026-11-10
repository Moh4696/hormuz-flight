// (hormuz) Ships: two crude-oil tankers, one generic grey frigate, two fast patrol boats. All signed-distance geometry,
// ray-marched inside each ship's bounding sphere, plus their wakes and shadows on the water. No models, no textures.
// uShip[i] = (x, z, heading rad (0 = north / +z, clockwise), type: 0 tanker, 1 frigate, 2 patrol boat)
#define HZN 5
uniform vec4 uShip[HZN];
int gShI=0;
float hzBox(vec3 p, vec3 c, vec3 b){ vec3 d=abs(p-c)-b; return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.); }
vec2 hzMin(vec2 a, vec2 b){ return a.x<b.x?a:b; }
vec3 hzLocal(vec3 p, vec4 s){ vec2 d=p.xz-s.xy; float c=cos(s.z), sn=sin(s.z); return vec3(d.x*sn+d.y*c, p.y, d.x*c-d.y*sn); }   // x forward, y up, z starboard
float hzTankerW(float x){ return 30.*(1.-.97*pow(smoothstep(105.,166.,x),1.7))*(1.-.22*smoothstep(-135.,-166.,x)); }
float hzFrigW(float x){ return 8.2*(1.-.98*pow(smoothstep(15.,71.,x),1.5))*(1.-.12*smoothstep(-55.,-70.,x)); }
float hzBoatW(float x){ return 2.3*(1.-.95*pow(smoothstep(1.,8.5,x),1.4)); }
// laden VLCC, 332 m x 60 m: deck 9.5 m above the water, tiered accommodation block, funnel and free-fall lifeboat aft
vec2 hzTanker(vec3 q){
  float w=hzTankerW(q.x), az=abs(q.z);
  vec2 r=vec2(max(max(az-w, abs(q.y+.75)-10.25), abs(q.x)-166.), 1.);
  r=hzMin(r, vec2(max(hzBox(q,vec3(148.,10.9,0.),vec3(18.,1.2,40.)), az-w), 1.));         // forecastle
  r=hzMin(r, vec2(max(hzBox(q,vec3(-150.,11.,0.),vec3(14.,1.5,40.)), az-w+2.), 1.));     // poop
  if(q.x<-100.){                                                                           // ---- after end
    r=hzMin(r, vec2(hzBox(q,vec3(-128.,16.5,0.),vec3(12.,6.,24.))-.2, 3.));               // accommodation, lower tier
    r=hzMin(r, vec2(hzBox(q,vec3(-127.,25.5,0.),vec3(10.,3.2,19.))-.2, 3.));              // upper tier
    r=hzMin(r, vec2(hzBox(q,vec3(-125.,30.9,0.),vec3(6.5,2.2,29.5)), 3.));                // navigation bridge and wings
    r=hzMin(r, vec2(hzBox(q,vec3(-126.,34.2,0.),vec3(5.,1.1,8.)), 3.));                   // monkey island
    r=hzMin(r, vec2(min(hzBox(q,vec3(-126.,40.,0.),vec3(.45,5.,.45)), hzBox(q,vec3(-126.,42.,0.),vec3(.25,.25,4.5))), 3.));   // radar mast and yard
    r=hzMin(r, vec2(hzBox(q,vec3(-125.5,36.6,0.),vec3(.35,.3,2.6)), 8.));                 // radar scanner
    r=hzMin(r, vec2(hzBox(q,vec3(-146.,22.,0.),vec3(4.5-.04*(q.y-10.),12.5,3.6))-.3, 4.));   // funnel
    r=hzMin(r, vec2(hzBox(vec3(q.x,q.y,az),vec3(-128.,18.6,25.6),vec3(4.6,1.3,1.5))-.4, 11.));   // lifeboats in davits
    { vec3 qf=q-vec3(-160.,15.5,0.); float c=cos(.45), sn=sin(.45); qf.xy=vec2(c*qf.x+sn*qf.y,-sn*qf.x+c*qf.y);
      r=hzMin(r, vec2(hzBox(qf,vec3(0.),vec3(5.2,1.5,1.7))-.5, 11.));                     // free-fall lifeboat on its ramp
      r=hzMin(r, vec2(hzBox(q,vec3(-158.,12.6,0.),vec3(.4,2.,2.6)), 5.)); }
  }
  if(q.x>-112.&&q.y>9.){                                                                  // ---- cargo deck
    r=hzMin(r, vec2(hzBox(q,vec3(15.,10.6,0.),vec3(118.,.9,2.6)), 5.));                   // centreline pipe rack
    r=hzMin(r, vec2(hzBox(vec3(q.x,q.y,az),vec3(15.,10.25,6.5),vec3(118.,.4,.45)), 5.));  // outer lines
    r=hzMin(r, vec2(hzBox(q,vec3(15.,12.5,0.),vec3(120.,.12,.9)), 5.));                   // catwalk
    float qx=mod(q.x+14.,28.)-14.;
    r=hzMin(r, vec2(max(hzBox(vec3(qx,q.y,q.z),vec3(0.,10.2,0.),vec3(.5,.5,25.)), abs(q.x-15.)-118.), 5.));       // deck transverses
    r=hzMin(r, vec2(max(max(length(vec2(qx-7.,az-15.))-1.7, abs(q.y-10.)-.7), abs(q.x-15.)-118.), 5.));           // tank hatches
    r=hzMin(r, vec2(max(hzBox(vec3(qx+7.,q.y,az),vec3(0.,10.,21.),vec3(.9,.6,.9)), abs(q.x-15.)-118.), 5.));       // vents
    r=hzMin(r, vec2(hzBox(q,vec3(12.,11.3,0.),vec3(5.,1.6,27.)), 5.));                    // cargo manifold
    vec3 qc=vec3(q.x,q.y,az);
    r=hzMin(r, vec2(min(hzBox(qc,vec3(12.,16.,12.),vec3(.7,6.,.7)), hzBox(qc,vec3(19.,21.5,12.),vec3(7.,.5,.5))), 12.));   // hose cranes
    r=hzMin(r, vec2(hzBox(qc,vec3(150.,12.7,8.),vec3(3.,.7,2.)), 5.));                    // windlasses
    r=hzMin(r, vec2(min(hzBox(q,vec3(152.,17.5,0.),vec3(.5,5.5,.5)), hzBox(q,vec3(152.,21.,0.),vec3(.25,.25,3.))), 3.));   // foremast
  }
  return r;
}
// generic frigate, 141 m: flared hull with sheer, superstructure in three blocks, two masts, funnel, hangar and flight deck, gun
vec2 hzFrigate(vec3 q){
  float w=hzFrigW(q.x)*mix(.8,1.,smoothstep(0.,5.5,q.y)), az=abs(q.z);
  float deck=5.5+2.6*smoothstep(18.,70.,q.x);
  vec2 r=vec2(max(max(az-w, q.y-deck), max(-q.y-4.5, abs(q.x)-70.5)), 6.);
  if(q.y>4.5){
    float tum=.22*(q.y-5.5);
    r=hzMin(r, vec2(hzBox(q,vec3(2.,8.5,0.),vec3(27.-.5*(q.y-5.5),3.,6.4-tum))-.15, 6.));     // main deckhouse, sloped sides
    r=hzMin(r, vec2(hzBox(q,vec3(20.,13.3,0.),vec3(6.-.6*(q.y-11.4),1.9,5.6-.25*(q.y-11.4))), 7.));   // bridge (window band)
    r=hzMin(r, vec2(hzBox(q,vec3(18.,15.6,0.),vec3(3.,.5,3.)), 6.));
    r=hzMin(r, vec2(hzBox(q,vec3(-2.,12.8,0.),vec3(13.,1.4,5.)), 6.));
    r=hzMin(r, vec2(hzBox(q,vec3(9.,21.,0.),vec3(1.5-.07*(q.y-14.),7.,1.5-.07*(q.y-14.))), 6.));   // main mast
    r=hzMin(r, vec2(min(hzBox(q,vec3(9.,22.,0.),vec3(2.,.18,2.)), hzBox(q,vec3(9.,25.5,0.),vec3(1.5,.18,1.5))), 6.));   // mast platforms
    r=hzMin(r, vec2(hzBox(q,vec3(9.,24.5,0.),vec3(.3,.3,6.5)), 6.));                          // yard
    r=hzMin(r, vec2(hzBox(q,vec3(9.6,27.,0.),vec3(.3,.7,3.2)), 8.));                          // air-search radar
    r=hzMin(r, vec2(length(q-vec3(9.,29.6,0.))-1.3, 6.));
    r=hzMin(r, vec2(min(hzBox(q,vec3(-6.,17.5,0.),vec3(.6,3.5,.6)), hzBox(q,vec3(-6.,20.,0.),vec3(.2,.2,3.5))), 6.));   // after mast
    r=hzMin(r, vec2(hzBox(q,vec3(-13.,16.,0.),vec3(4.2-.15*(q.y-14.),2.6,3.2-.15*(q.y-14.))), 13.));   // funnel
    r=hzMin(r, vec2(length(q-vec3(-22.,15.8,0.))-2.6, 6.));                                   // radar dome
    r=hzMin(r, vec2(hzBox(q,vec3(-34.,9.3,0.),vec3(9.,3.8,6.2-tum)), 6.));                    // hangar
    r=hzMin(r, vec2(min(length(q-vec3(-37.,14.3,0.))-1.2, hzBox(q,vec3(-37.,13.4,0.),vec3(1.,.5,1.))), 8.));   // close-in mount on the hangar roof
    vec3 qs=vec3(q.x,q.y,az);
    r=hzMin(r, vec2(hzBox(qs,vec3(-8.,7.2,7.1),vec3(3.2,.9,.5))-.25, 8.));                    // boats in davits
    float qr=mod(q.x+3.,6.)-3.;
    r=hzMin(r, vec2(max(length(vec2(q.y-12.1,az-6.2))-.42, max(abs(qr)-1.1, abs(q.x+2.)-12.)), 14.));   // life-raft canisters
    r=hzMin(r, vec2(hzBox(q,vec3(33.,8.8,0.),vec3(4.,.9,3.4)), 6.));                          // launcher deck
    r=hzMin(r, vec2(min(length(q-vec3(45.,9.8,0.))-2.1, hzBox(q,vec3(50.5,10.3,0.),vec3(4.5,.28,.28))), 8.));   // gun
    r=hzMin(r, vec2(hzBox(q,vec3(62.,9.,0.),vec3(.25,1.2,.25)), 6.));                         // jackstaff
  }
  return r;
}
// fast patrol boat, 17 m, planing bow-up
vec2 hzBoat(vec3 q){
  q.y-=.35; { float c=cos(.09), s=sin(.09); q.xy=vec2(c*q.x+s*q.y, -s*q.x+c*q.y); }
  float w=hzBoatW(q.x)*mix(.7,1.,smoothstep(-.6,1.,q.y));
  vec2 r=vec2(max(max(abs(q.z)-w, abs(q.y-.4)-1.), abs(q.x)-8.5), 9.);
  r=hzMin(r, vec2(hzBox(q,vec3(-.6,2.05,0.),vec3(2.2,.7,1.5)), 10.));
  r=hzMin(r, vec2(hzBox(q,vec3(-.6,3.2,0.),vec3(.12,.9,.12)), 8.));
  r=hzMin(r, vec2(hzBox(q,vec3(4.3,1.9,0.),vec3(.5,.45,.3)), 8.));
  return r;
}
vec2 hzShipSD(vec3 p, int i){ vec4 s=uShip[i]; vec3 q=hzLocal(p,s); return s.w<.5?hzTanker(q):s.w<1.5?hzFrigate(q):hzBoat(q); }
float hzShipHit(vec3 ro, vec3 rd, float tmax){
  float best=-1.;
  for(int i=uZero;i<HZN;i++){
    vec4 s=uShip[i]; float R=s.w<.5?178.:s.w<1.5?76.:10.5;
    vec3 oc=ro-vec3(s.x,s.w<.5?12.:s.w<1.5?8.:1.5,s.y); float b=dot(oc,rd), c=dot(oc,oc)-R*R, h=b*b-c; if(h<0.) continue;
    h=sqrt(h); float t=max(-b-h,0.), t1=min(-b+h,best>0.?best:tmax); if(t1<=t) continue;
    for(int k=uZero;k<110;k++){ float d=hzShipSD(ro+rd*t,i).x; if(d<.0005*t+.015){ best=t; gShI=i; break; } t+=d*.7; if(t>t1) break; }
  }
  return best;
}
vec3 hzShipShade(vec3 p, vec3 rd, float t){
  int i=gShI; vec4 s=uShip[i]; float e=max(.03,.0004*t);
  vec2 d0=hzShipSD(p,i);
  vec3 N=normalize(vec3(hzShipSD(p+vec3(e,0,0),i).x-d0.x, hzShipSD(p+vec3(0,e,0),i).x-d0.x, hzShipSD(p+vec3(0,0,e),i).x-d0.x));
  vec3 q=hzLocal(p,s); float m=d0.y, up=smoothstep(.6,.8,N.y), side=1.-smoothstep(.2,.4,abs(N.y));
  float pix=t*uTan*2./uRes.y;
  vec3 alb=vec3(.2);
  float grime=.82+.36*vnoise(vec2(q.x*.9+q.z*.9,q.y*.12)+7.)*clamp(1.4-pix*.5,0.,1.);       // vertical weather streaks
  if(m<1.5){ alb=mix(vec3(.012,.012,.014),vec3(.15,.026,.02),smoothstep(1.5,.9,q.y));            // black topsides, red boot-top
             alb=mix(alb,vec3(.05,.022,.012),side*smoothstep(.55,.85,vnoise(vec2(q.x*.5+q.z,q.y*.07)+3.))*.6);   // rust weeps
             float dk=up*step(8.,q.y);
             vec3 dc=vec3(.105,.032,.025)*(.8+.4*vnoise(q.xz*.09))*(.9+.2*vnoise(q.xz*.9));     // red-oxide deck
             dc=mix(dc,vec3(.16,.15,.12),smoothstep(.25,.0,abs(abs(q.z)-hzTankerW(q.x)+1.6))*.8*clamp(1.5-pix*.6,0.,1.));   // deck-edge line
             alb=mix(alb,dc,dk); }
  else if(m<3.5){ alb=vec3(.60,.60,.58)*grime;
             float fy=fract((q.y-10.5)/2.9), row=smoothstep(.42,.47,fy)*smoothstep(.74,.69,fy);
             float fx=fract((abs(N.x)>.5?q.z:q.x)/2.3), col=smoothstep(.2,.26,fx)*smoothstep(.68,.62,fx);
             alb=mix(alb,vec3(.025,.035,.045),row*col*side*clamp(1.5-pix*.9,0.,1.)*step(q.y,28.4)*step(10.6,q.y)*step(q.x,-100.));
             alb=mix(alb,vec3(.02,.03,.04),side*smoothstep(30.2,30.4,q.y)*smoothstep(32.2,32.,q.y)*step(q.x,-100.)); }   // bridge windows
  else if(m<4.5){ alb=mix(vec3(.03,.04,.06),vec3(.5,.5,.48),smoothstep(26.,26.2,q.y)*smoothstep(29.2,29.,q.y)); alb=mix(alb,vec3(.012),smoothstep(31.5,32.,q.y)); alb*=grime; }   // funnel: band, sooty cap
  else if(m<5.5) alb=vec3(.16,.17,.165)*(.85+.3*vnoise(q.xz*.6));
  else if(m<6.5){ alb=vec3(.098,.106,.118)*mix(1.,grime,.35); float dk=up;
             vec3 dc=vec3(.055,.058,.063)*(.85+.3*vnoise(q.xz*.8));
             if(q.x<-43.&&q.y<7.){ vec2 f=q.xz-vec2(-56.,0.); float rr=length(f);                 // flight-deck markings
               float mk=smoothstep(.3,.1,abs(rr-5.))+smoothstep(.2,.05,abs(f.y))*step(abs(f.x),11.)+smoothstep(.25,.1,abs(abs(f.y)-6.6))*step(.5,fract(f.x*.25));
               dc=mix(dc,vec3(.42),clamp(mk,0.,1.)*clamp(1.5-pix*1.5,0.,1.)); }
             alb=mix(alb,dc,dk); alb=mix(alb,vec3(.018),smoothstep(.9,.4,q.y)*side); }                // haze grey, dark decks, black boot-top
  else if(m<7.5){ alb=mix(vec3(.098,.106,.118)*mix(1.,grime,.35),vec3(.012,.018,.026),side*smoothstep(13.1,13.3,q.y)*smoothstep(14.5,14.3,q.y)); }
  else if(m<8.5) alb=vec3(.05,.053,.06);
  else if(m<9.5) alb=mix(vec3(.11,.13,.125),vec3(.05),up);
  else if(m<10.5) alb=mix(vec3(.3,.31,.31),vec3(.03),side*step(2.,q.y)*step(q.y,2.9));
  else if(m<11.5) alb=vec3(.55,.13,.02);                                                             // lifeboat orange
  else if(m<12.5) alb=vec3(.42,.33,.05);                                                             // crane yellow
  else if(m<13.5) alb=mix(vec3(.098,.106,.118)*mix(1.,grime,.35),vec3(.015),smoothstep(17.6,17.9,q.y));         // frigate funnel, black cap
  else alb=vec3(.55);                                                                                // life rafts
  float ao=clamp(hzShipSD(p+N*1.4,i).x/1.4,0.,1.); ao=mix(.4,1.,ao);
  float sh=1., ts=.4;
  for(int k=uZero;k<28;k++){ float d=hzShipSD(p+N*.06+uSun*ts,i).x; if(d<.02){ sh=0.; break; } sh=min(sh,12.*d/ts); ts+=max(d,.5); if(ts>120.) break; }
  vec3 sI=skyIrr(N);
  vec3 L=SUN*max(dot(N,uSun),0.)*clamp(sh,0.,1.)+(sI*1.05+skyIrr(vec3(0,1,0))*vec3(.35,.5,.6)*.25*max(-N.y+.3,0.))*ao;
  vec3 c=alb*L;
  vec3 R=reflect(rd,N); c+=skyView(normalize(vec3(R.x,abs(R.y)+.02,R.z)))*.03*pow(1.-max(dot(-rd,N),0.),4.);   // faint paint sheen
  return c;
}
// wake foam (turbulent trail, hull-side wash, Kelvin arms) and the ship's shadow, composited over the shaded water
vec3 hzWake(vec3 col, vec3 pw, float t){
  float a=0., shd=0.; vec2 p=pw.xz;
  for(int i=uZero;i<HZN;i++){
    vec4 s=uShip[i]; vec2 dd=p-s.xy; float R=s.w<.5?1500.:s.w<1.5?1100.:420.; if(dot(dd,dd)>R*R) continue;
    vec3 q=hzLocal(pw,s);
    float b=s.w<.5?30.:s.w<1.5?8.2:2.3, hl=s.w<.5?166.:s.w<1.5?70.5:8.5, L=s.w<.5?520.:s.w<1.5?520.:200., k=s.w<.5?.5:s.w<1.5?.85:1.;
    float az=abs(q.z), sb=-hl-q.x, ub=hl-q.x;
    float n=.55+.45*vnoise(p*.11+vec2(3.1*float(i),uTime*.2))+.35*(vnoise(p*.5+7.)-.5);
    if(sb>-.1*hl){                                                                    // turbulent trail astern
      float wT=b*(.8+.011*max(sb,0.)); a=max(a,k*smoothstep(wT,wT*.45,az)*exp(-max(sb,0.)/L)*smoothstep(-.1*hl,.05*hl,sb)*n); }
    if(ub>0.&&sb<0.){                                                                 // wash along the hull
      float w=s.w<.5?hzTankerW(q.x):s.w<1.5?hzFrigW(q.x):hzBoatW(q.x); a=max(a,k*.75*smoothstep(1.5+.12*b,0.,az-w)*n); }
    if(ub>0.){                                                                        // Kelvin arms from the bow
      float wa=1.2+.15*b+.02*ub; a=max(a,k*.7*smoothstep(wa,0.,abs(az-(.25*b+ub*.3536)))*exp(-ub/(L*.55))*n); }
    if(uSun.y>.05&&dot(dd,dd)<(hl+260.)*(hl+260.)){ vec3 o=vec3(pw.x,.4,pw.z); float ts=1.; for(int j=uZero;j<24;j++){ float d=hzShipSD(o+uSun*ts,i).x; if(d<.05){ shd=1.; break; } ts+=max(d,1.); if(ts>260.) break; } }
  }
  col*=1.-.55*shd;
  if(a>.003){
    vec3 sI=skyIrr(vec3(0,1,0)); sI=mix(vec3(dot(sI,vec3(.3,.5,.2))),sI,.6);
    vec3 fc=(SUN*((uSun.y+.35)/1.35)*(1.-.6*shd)+sI*1.05)*vec3(.585,.665,.765);
    col=mix(col,fc*.9,clamp(a,0.,1.)*.92);
  }
  return col;
}
