import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Pressable,StyleSheet,View} from 'react-native';
import {GLView,type ExpoWebGLRenderingContext} from 'expo-gl';
import {LinearGradient} from 'expo-linear-gradient';
import {ChevronLeft,RotateCcw,ChevronRight,Shield} from 'lucide-react-native';
import {C} from '../theme';
import {T} from '../components/Elements';

/** Original procedural articulated Hunter: all geometry is generated on-device.
 * No downloaded models, copyrighted assets, web requests or user data.
 * The geometric character is deliberately NOT advertised as a rigged glTF model.
 */
export type RenderQuality='immersive'|'balanced'|'battery';
type Props={active?:boolean;reduceMotion?:boolean;quality?:RenderQuality;
  height?:number;rank?:string;level?:number;inspect?:boolean};
type Mesh={buffer:WebGLBuffer;count:number};

function sphere(rows=12,cols=18):Float32Array{
  const v:number[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const point=(a:number,b:number):[number,number,number]=>{
      const t=Math.PI*a/rows,p=2*Math.PI*b/cols;
      return [Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p)];
    };
    v.push(...point(y,x),...point(y+1,x),...point(y,x+1));
    v.push(...point(y,x+1),...point(y+1,x),...point(y+1,x+1));
  }
  return new Float32Array(v);
}
function particles():Float32Array{
  const points:number[]=[];
  let seed=75491;
  const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<155;i++){
    points.push((random()-.5)*5.5,(random()-.5)*4.4,-.4-random()*1.5);
  }
  return new Float32Array(points);
}
function halo():Float32Array{
  const points:number[]=[];
  for(let i=0;i<=120;i++){
    const a=i*Math.PI*2/120;
    points.push(Math.cos(a)*1.36,Math.sin(a)*1.36,-.85);
  }
  return new Float32Array(points);
}
const VS=[
  'attribute vec3 aPosition;',
  'uniform vec3 uCenter;',
  'uniform vec3 uSize;',
  'uniform float uTurn;',
  'uniform float uSwing;',
  'uniform float uTime;',
  'uniform float uAspect;',
  'uniform float uMode;',
  'varying vec3 vNorm;',
  'varying float vDepth;',
  'void main(){',
  'vec3 p=aPosition*uSize;',
  'float c=cos(uSwing),s=sin(uSwing);',
  'p.yz=mat2(c,-s,s,c)*p.yz;',
  'p+=uCenter;',
  'float yaw=uTurn+sin(uTime*.22)*.07;',
  'p.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*p.xz;',
  'vNorm=normalize(aPosition);vDepth=p.z;',
  'float perspective=1.0/(1.0+p.z*.12);',
  'gl_Position=vec4(p.x*.63*perspective/uAspect,p.y*.60*perspective,p.z*.14,1.);',
  'gl_PointSize=uMode>0.5?2.4+1.8*abs(sin(uTime+p.x*3.)):2.;',
  '}'
].join('\n');
const FS=[
  'precision mediump float;',
  'uniform vec3 uColor;',
  'uniform float uTime;',
  'uniform float uMode;',
  'varying vec3 vNorm;',
  'varying float vDepth;',
  'void main(){',
  'if(uMode>0.5){',
  'vec2 p=gl_PointCoord-vec2(.5);',
  'float fade=1.-smoothstep(.13,.49,length(p));',
  'gl_FragColor=vec4(mix(vec3(.22,.68,1.),uColor,.55),fade*.78);return;',
  '}',
  'vec3 n=normalize(vNorm);',
  'float diffuse=max(.11,dot(n,normalize(vec3(-.55,.8,.9))));',
  'float rim=pow(1.-abs(n.z),2.1);',
  'vec3 shade=uColor*(.25+diffuse*.69)+vec3(.18,.32,.46)*rim*.55;',
  'shade+=uColor*.055*sin(uTime*1.4+vDepth*7.);',
  'gl_FragColor=vec4(shade,.97);',
  '}'
].join('\n');
function shader(gl:ExpoWebGLRenderingContext,type:number,source:string){
  const s=gl.createShader(type);if(!s)throw Error('Hunter shader unavailable');
  gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Hunter shader failure');
  return s;
}
function setup(gl:ExpoWebGLRenderingContext){
  const p=gl.createProgram();if(!p)throw Error('Hunter GPU program unavailable');
  const v=shader(gl,gl.VERTEX_SHADER,VS),f=shader(gl,gl.FRAGMENT_SHADER,FS);
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Hunter GPU link failure');
  gl.deleteShader(v);gl.deleteShader(f);gl.useProgram(p);
  const a=gl.getAttribLocation(p,'aPosition');
  const uniform=(key:string)=>{const u=gl.getUniformLocation(p,key);if(!u)throw Error('Missing Hunter uniform '+key);return u;};
  const create=(points:Float32Array):Mesh=>{
    const buffer=gl.createBuffer();if(!buffer)throw Error('Hunter GPU buffer unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
    return {buffer,count:points.length/3};
  };
  return {p,a,center:uniform('uCenter'),size:uniform('uSize'),turn:uniform('uTurn'),
    swing:uniform('uSwing'),time:uniform('uTime'),aspect:uniform('uAspect'),
    mode:uniform('uMode'),color:uniform('uColor'),
    body:create(sphere()),points:create(particles()),ring:create(halo())};
}
const tint:Record<string,[number,number,number]>={
  E:[.31,.53,.75],D:[.22,.71,.92],C:[.39,.77,.83],
  B:[.67,.52,.96],A:[.91,.68,.34],S:[.98,.79,.42]
};
const metal:[number,number,number]=[.13,.20,.33];
const dark:[number,number,number]=[.08,.12,.23];
const robe:[number,number,number]=[.12,.13,.31];
const skin:[number,number,number]=[.56,.66,.77];

export function HunterWorld({active=true,reduceMotion=false,quality='balanced',
  height=350,rank='E',level=1,inspect=false}:Props){
  const activeRef=useRef(active),motionRef=useRef(reduceMotion),qualityRef=useRef(quality);
  const turnRef=useRef(0),frame=useRef<number|null>(null),live=useRef(true),foreground=useRef(true);
  const [error,setError]=useState(false);
  const [turn,setTurn]=useState(0);
  useEffect(()=>{activeRef.current=active;motionRef.current=reduceMotion;qualityRef.current=quality;},
    [active,reduceMotion,quality]);
  useEffect(()=>{turnRef.current=turn;},[turn]);
  useEffect(()=>{
    const s=AppState.addEventListener('change',state=>{foreground.current=state==='active';});
    return ()=>{s.remove();live.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);};
  },[]);
  const onContextCreate=useCallback((gl:ExpoWebGLRenderingContext)=>{
    try{
      const g=setup(gl);
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.clearColor(0,0,0,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.enableVertexAttribArray(g.a);
      let previous=0,origin=0,drawnStill=false;
      const render=(stamp:number)=>{
        if(!live.current)return;
        frame.current=requestAnimationFrame(render);
        if(!activeRef.current||!foreground.current)return;
        const still=motionRef.current||qualityRef.current==='battery';
        if(still&&drawnStill)return;
        const spacing=qualityRef.current==='immersive'?22:33;
        if(!still&&stamp-previous<spacing)return;
        previous=stamp;if(!origin)origin=stamp;
        const t=still?0:(stamp-origin)/1000;
        const accent=tint[rank]??tint.E;
        const angle=turnRef.current;
        const swing=still?0:Math.sin(t*1.35);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(g.p);gl.uniform1f(g.time,t);
        gl.uniform1f(g.turn,angle);gl.uniform1f(g.aspect,gl.drawingBufferWidth/gl.drawingBufferHeight);
        const draw=(mesh:Mesh,mode:number,center:[number,number,number],
          size:[number,number,number],color:[number,number,number],limb=0,kind:number=gl.TRIANGLES)=>{
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
          gl.vertexAttribPointer(g.a,3,gl.FLOAT,false,0,0);
          gl.uniform3f(g.center,...center);gl.uniform3f(g.size,...size);
          gl.uniform3f(g.color,...color);gl.uniform1f(g.swing,limb);
          gl.uniform1f(g.mode,mode);gl.drawArrays(kind,0,mesh.count);
        };
        // Original sanctuary scene: starlight, portal, tiered dais and monoliths.
        draw(g.points,1,[0,0,0],[1,1,1],accent,0,gl.POINTS);
        draw(g.ring,0,[0,.02,-.1],[1,1,1],accent,0,gl.LINE_STRIP);
        draw(g.body,0,[0,-1.45,-.13],[1.28,.12,.82],[.09,.31,.43]);
        draw(g.body,0,[0,-1.51,-.13],[1.43,.055,.92],accent);
        for(const x of [-1.18,1.18]){
          draw(g.body,0,[x,-.25,-.77],[.105,1.12,.13],metal);
          draw(g.body,0,[x,1.0,-.77],[.25,.12,.2],accent);
          draw(g.body,0,[x,-1.15,-.74],[.27,.14,.29],dark);
        }
        // Hero: layered cloak, articulated limbs, armor and rank-dependent aura.
        const bob=still?0:Math.sin(t*1.8)*.023;
        draw(g.body,0,[0,-.21+bob,-.32],[.54,.86,.19],robe);
        draw(g.body,0,[0,.14+bob,-.05],[.42,.63,.22],metal);
        draw(g.body,0,[0,-.40+bob,.13],[.33,.21,.20],dark);
        for(const x of [-1,1]){
          draw(g.body,0,[x*.20,-.94+bob,.02],[.15,.55,.17],metal, x*swing*.035);
          draw(g.body,0,[x*.20,-1.30+bob,.14],[.18,.19,.23],dark);
          draw(g.body,0,[x*.47,.24+bob,0],[.19,.41,.19],metal,x*swing*.06);
          draw(g.body,0,[x*.53,-.08+bob,.03],[.12,.24,.15],accent,x*swing*.11);
          draw(g.body,0,[x*.47,.60+bob,-.01],[.27,.19,.23],accent);
        }
        draw(g.body,0,[0,.30+bob,.18],[.27,.31,.055],accent);
        draw(g.body,0,[0,.82+bob,0],[.14,.15,.13],skin);
        draw(g.body,0,[0,1.05+bob,0],[.25,.32,.24],metal);
        draw(g.body,0,[0,1.07+bob,.21],[.20,.058,.05],accent);
        draw(g.body,0,[0,-.34+bob,.17],[.25,.075,.10],accent);
        if(level>=5){
          draw(g.body,0,[.63,-.42+bob,.11],[.035,.77,.045],skin);
          draw(g.body,0,[.63,.32+bob,.11],[.13,.12,.09],accent);
        }
        if(level>=10||rank==='S'){
          draw(g.body,0,[0,.37+bob,.24],[.10,.11,.10],[.96,.75,.36]);
        }
        gl.flush();gl.endFrameEXP();
        drawnStill=still;
      };
      frame.current=requestAnimationFrame(render);
    }catch(e){
      console.warn('[ASCEND/Hunter] GPU scene unavailable; using accessible fallback',
        e instanceof Error?e.message:'unknown graphics issue');
      if(live.current)setError(true);
    }
  },[rank,level]);
  return <View style={[s.shell,{height}]} accessibilityLabel="Original animated three-dimensional Hunter in a celestial sanctuary">
    <LinearGradient colors={['#192B52','#11132D','#090F20']} style={StyleSheet.absoluteFill}/>
    {(!error)&&<GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate}/>}
    {error&&<View style={s.fallback}>
      <Shield size={96} color={C.energy} strokeWidth={1}/>
      <T bold size={14} color={C.frost}>HUNTER · RANK {rank}</T>
      <T size={11} color={C.sub}>Reduced graphics mode</T>
    </View>}
    <LinearGradient colors={['transparent','#090D1B00','#090D1BCF']}
      pointerEvents="none" style={StyleSheet.absoluteFill}/>
    <View style={s.label} pointerEvents="none">
      <View style={s.live}/><T size={10} color={C.frost} bold>THE HUNTER SANCTUARY</T>
    </View>
    {inspect&&<View style={s.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Rotate Hunter left"
        onPress={()=>setTurn(v=>v-.32)} style={s.control}>
        <ChevronLeft size={20} color={C.frost}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset Hunter rotation"
        onPress={()=>setTurn(0)} style={s.control}><RotateCcw size={17} color={C.frost}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Rotate Hunter right"
        onPress={()=>setTurn(v=>v+.32)} style={s.control}>
        <ChevronRight size={20} color={C.frost}/>
      </Pressable>
    </View>}
    {inspect&&<View style={s.footer} pointerEvents="none">
      <T size={10} color={C.gold} bold>RANK {rank} · LEVEL {level}</T>
      <T size={10} color={C.sub}>Procedural 3D · {quality==='battery'?'Low power':quality}</T>
    </View>}
  </View>;
}
const s=StyleSheet.create({
  shell:{overflow:'hidden',borderRadius:24,borderWidth:1,borderColor:'#5477AD',backgroundColor:C.bg},
  label:{position:'absolute',top:14,left:15,flexDirection:'row',gap:7,alignItems:'center',
    backgroundColor:'#0B1935CF',borderRadius:12,paddingHorizontal:10,paddingVertical:7},
  live:{width:7,height:7,borderRadius:5,backgroundColor:'#8AEAD8'},
  controls:{position:'absolute',right:12,top:'42%',gap:7},
  control:{width:39,height:39,borderRadius:12,backgroundColor:'#132644D9',borderWidth:1,
    borderColor:'#5F7EAA',alignItems:'center',justifyContent:'center'},
  footer:{position:'absolute',bottom:12,left:12,right:12,flexDirection:'row',
    justifyContent:'space-between',backgroundColor:'#101B31CC',padding:10,borderRadius:11},
  fallback:{flex:1,justifyContent:'center',alignItems:'center',gap:8},
});
