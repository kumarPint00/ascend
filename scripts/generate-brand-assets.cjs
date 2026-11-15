// Reproducible original ASCEND brand PNG assets. No network, paid service, or binary files in Git history.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const OUTPUT=path.join(__dirname,'../apps/mobile/assets');
fs.mkdirSync(OUTPUT,{recursive:true});
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const distLine=(x,y,ax,ay,bx,by)=>{
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
  return Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
};
const seg=(x,y,p,q)=>distLine(x,y,...p,...q);
const A=[[[.307,.706],[.5,.247]],[[.5,.247],[.693,.706]],[[.412,.564],[.588,.564]]];
function logo(x,y){
  const d=Math.min(...A.map(([p,q])=>seg(x,y,p,q)));
  const halo=Math.exp(-Math.pow(d/.063,2))*0.54;
  const fringe=Math.exp(-Math.pow(d/.026,2))*0.64;
  const core=1-clamp((d-.009)/.010);
  const center=Math.exp(-Math.pow(Math.hypot((x-.5)*1.4,(y-.493)*1.2)/.13,2))*.27;
  return {halo,fringe,core,center};
}
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const chunk=(name,data)=>{const type=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length,0);crc.writeUInt32BE(crc32(Buffer.concat([type,data])),0);return Buffer.concat([len,type,data,crc]);};
function png(file,w,h,mode){
  const raw=Buffer.alloc((w*4+1)*h);const full=mode==='icon',mono=mode==='mono';
  for(let py=0;py<h;py++){
    raw[py*(w*4+1)]=0;
    for(let px=0;px<w;px++){
      const x=(px+.5)/w,y=(py+.5)/h,index=py*(w*4+1)+1+px*4;
      const {halo,fringe,core,center}=logo(x,y);
      let r=0,g=0,b=0,a=255;
      if(full){
        const top=Math.max(0,1-y),orb=Math.exp(-Math.pow(Math.hypot((x-.5)*.95,(y-.52)*1.23)/.42,2));
        const ring=Math.exp(-Math.pow((Math.hypot((x-.5)*1.1,(y-.76)*2.2)-.39)/.013,2));
        const stars=(Math.sin(px*147.73+py*51.29)*Math.sin(px*59.17-py*163.3)>.991)?40:0;
        r=7+top*5+orb*13+ring*8+stars*.2;
        g=12+top*8+orb*18+ring*62+stars*.8;
        b=31+top*13+orb*39+ring*115+stars;
        r+=halo*39+fringe*80+core*178+center*11;
        g+=halo*110+fringe*175+core*232+center*45;
        b+=halo*170+fringe*200+core*247+center*105;
      } else if(mono){
        r=g=b=255; a=clamp((core*.9+fringe*.13))*255;
      } else {
        r=halo*42+fringe*94+core*180+center*24;
        g=halo*104+fringe*173+core*235+center*73;
        b=halo*164+fringe*207+core*255+center*134;
        a=clamp(halo*.64+fringe*.88+core+center*.30)*255;
      }
      raw[index]=clamp(Math.round(r),0,255);raw[index+1]=clamp(Math.round(g),0,255);
      raw[index+2]=clamp(Math.round(b),0,255);raw[index+3]=clamp(Math.round(a),0,255);
    }
  }
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  fs.writeFileSync(path.join(OUTPUT,file),Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}
png('icon.png',1024,1024,'icon');
png('adaptive-foreground.png',1024,1024,'foreground');
png('adaptive-monochrome.png',1024,1024,'mono');
png('splash-icon.png',1024,1024,'foreground');
console.log('Generated original ASCEND icon, adaptive icon and splash PNGs in apps/mobile/assets');
