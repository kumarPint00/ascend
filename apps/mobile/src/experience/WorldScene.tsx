import React,{useCallback,useEffect,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {GLView,type ExpoWebGLRenderingContext} from 'expo-gl';
import {LinearGradient} from 'expo-linear-gradient';
import {C} from '../theme';
import {CrystalFallback} from './CrystalFallback';

type Props={active?:boolean;reduceMotion?:boolean;height?:number;rank?:string};

function makeSphere(rings=25,segments=40):Float32Array{
  const data:number[]=[];
  const point=(a:number,b:number):number[]=>{
    const theta=Math.PI*a/rings,phi=Math.PI*2*b/segments;
    return [Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
  };
  for(let y=0;y<rings;y++)for(let x=0;x<segments;x++){
    const a=point(y,x),b=point(y+1,x),c=point(y,x+1),d=point(y+1,x+1);
    data.push(...a,...b,...c,...c,...b,...d);
  }
  return new Float32Array(data);
}
function makeOrbit(plane:number):Float32Array{
  const arr:number[]=[];
  for(let j=0;j<=200;j++){
    const t=Math.PI*2*j/200;
    const x=Math.cos(t)*1.34,y=Math.sin(t)*1.34;
    if(plane===0)arr.push(x,y*.36,y*.93);
    else if(plane===1)arr.push(x*.4,y,x*.92);
    else arr.push(x*.78,y*.82,Math.sin(t+.8)*.8);
  }
  return new Float32Array(arr);
}
function makeStars():Float32Array{
  const arr:number[]=[];
  // Deterministic starfield, no noisy Math.random() rerenders.
  let seed=1927;
  const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<210;i++){
    const phi=rand()*6.2832,z=rand()*2-1,r=Math.sqrt(1-z*z);
    const distance=2.35+rand()*3.7;
    arr.push(r*Math.cos(phi)*distance,r*Math.sin(phi)*distance,z*distance);
  }
  return new Float32Array(arr);
}
const VERTEX=`
attribute vec3 aPosition;
uniform float uTime;
uniform float uMode;
uniform float uScale;
varying vec3 vNormal;
varying float vDepth;
void main(){
  float t=uTime*.35;
  vec3 p=aPosition;
  if(uMode<1.5){
    float c=cos(t),s=sin(t);
    p=vec3(c*p.x-s*p.z,p.y,c*p.z+s*p.x);
    float a=sin(t*.63)*.22;
    p.yz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.yz;
  } else {
    p.xy+=vec2(sin(t*.5),cos(t*.3))*.045;
  }
  p*=uScale;
  vNormal=normalize(p);
  vDepth=p.z;
  float z=5.0+p.z*.22;
  gl_Position=vec4(p.x*2.5,p.y*2.55,p.z*.24,z);
  gl_PointSize=uMode>1.5?2.2+2.2*abs(sin(uTime+p.x*2.0)):2.0;
}
`;
const FRAGMENT=`
precision mediump float;
uniform float uTime;
uniform float uMode;
uniform vec3 uTint;
varying vec3 vNormal;
varying float vDepth;
void main(){
  if(uMode>1.5){
    vec2 p=gl_PointCoord-vec2(.5);
    float f=1.-smoothstep(.14,.5,length(p));
    gl_FragColor=vec4(mix(vec3(.26,.6,.95),vec3(.96,.82,.57),abs(vNormal.y)),f*.78);
  }else if(uMode>.5){
    float glow=.40+.60*abs(sin(uTime*.6+vNormal.y*12.));
    gl_FragColor=vec4(mix(uTint,vec3(.78,.91,1.),glow*.6),.75);
  }else{
    vec3 normal=normalize(vNormal);
    float fresnel=pow(1.-abs(normal.z),2.4);
    float pulses=.5+.5*sin(19.*normal.y+12.*normal.x-uTime*.66);
    float facet=.5+.5*sin(29.*normal.x-10.*normal.z+uTime*.25);
    float light=max(.0,dot(normal,normalize(vec3(-.4,.75,.9))));
    vec3 core=mix(vec3(.025,.09,.22),uTint,.24+.45*light);
    core+=vec3(.09,.35,.57)*fresnel;
    core+=vec3(.06,.2,.44)*pulses*facet*.34;
    core+=vec3(.8,.65,.29)*pow(max(.0,facet-0.84),4.)*.8;
    float alpha=.72+.28*fresnel;
    gl_FragColor=vec4(core,alpha);
  }
}
`;
function shader(gl:ExpoWebGLRenderingContext,type:number,source:string){
  const s=gl.createShader(type);
  if(!s)throw Error('Unable to create 3D shader');
  gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
    const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error||'3D shader compilation failed');
  }
  return s;
}
function init(gl:ExpoWebGLRenderingContext){
  const p=gl.createProgram();if(!p)throw Error('Unable to create 3D program');
  const v=shader(gl,gl.VERTEX_SHADER,VERTEX),f=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D program link failed');
  gl.deleteShader(v);gl.deleteShader(f);gl.useProgram(p);
  const attribute=gl.getAttribLocation(p,'aPosition');
  const time=gl.getUniformLocation(p,'uTime');
  const mode=gl.getUniformLocation(p,'uMode');
  const scale=gl.getUniformLocation(p,'uScale');
  const tint=gl.getUniformLocation(p,'uTint');
  if(attribute<0||!time||!mode||!scale||!tint)throw Error('3D uniforms unavailable');
  const mk=(data:Float32Array)=>{
    const b=gl.createBuffer();if(!b)throw Error('3D buffer failed');
    gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    return {buffer:b,count:data.length/3};
  };
  return {p,attribute,time,mode,scale,tint,
    sphere:mk(makeSphere()),stars:mk(makeStars()),
    orbits:[mk(makeOrbit(0)),mk(makeOrbit(1)),mk(makeOrbit(2))]};
}
/**
 * Real-time WebGL 3D scene: shaded, rotating procedural orb, three orbit rings
 * and depth-distributed star particles. No external textures, asset downloads,
 * user data or network calls. Render loop halts when hidden/backgrounded.
 */
export function WorldScene({active=true,reduceMotion=false,height=300,rank='E'}:Props){
  const live=useRef(true),activeRef=useRef(active),motionRef=useRef(reduceMotion);
  const frame=useRef<number|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{activeRef.current=active;motionRef.current=reduceMotion;},[active,reduceMotion]);
  useEffect(()=>()=>{live.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
  const onContextCreate=useCallback((gl:ExpoWebGLRenderingContext)=>{
    try{
      const resources=init(gl);
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.clearColor(.023,.037,.092,1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.enableVertexAttribArray(resources.attribute);
      let first=0,last=0;
      const draw=(stamp:number)=>{
        if(!live.current||!activeRef.current)return;
        if(!first)first=stamp;
        if(stamp-last<33&&!motionRef.current){
          frame.current=requestAnimationFrame(draw);return;
        }
        last=stamp;
        const elapsed=motionRef.current?0:(stamp-first)/1000;
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(resources.p);
        gl.uniform1f(resources.time,elapsed);
        const render=(obj:{buffer:WebGLBuffer;count:number},mode:number,scale:number,
          tint:[number,number,number],drawMode:number)=>{
          gl.bindBuffer(gl.ARRAY_BUFFER,obj.buffer);
          gl.vertexAttribPointer(resources.attribute,3,gl.FLOAT,false,0,0);
          gl.uniform1f(resources.mode,mode);gl.uniform1f(resources.scale,scale);
          gl.uniform3f(resources.tint,...tint);
          gl.drawArrays(drawMode,0,obj.count);
        };
        render(resources.stars,2,1,[.50,.66,1],gl.POINTS);
        render(resources.sphere,0,1,[.18,.73,.98],gl.TRIANGLES);
        resources.orbits.forEach((ring,i)=>render(ring,1,1,
          i===1?[.81,.57,1]:i===2?[.98,.72,.35]:[.24,.78,1],gl.LINE_STRIP));
        gl.flush();gl.endFrameEXP();
        if(!motionRef.current&&live.current&&activeRef.current)
          frame.current=requestAnimationFrame(draw);
      };
      frame.current=requestAnimationFrame(draw);
    }catch(error){
      // Native rendering failure should never result in an empty hero.
      // Only static shader context is logged, not personal or quest data.
      console.warn('[ASCEND/3D] WebGL unavailable; animated crystal fallback active.',
        error instanceof Error?error.message:'unknown renderer error');
      if(live.current)setFailed(true);
    }
  },[]);
  return <View style={[styles.shell,{height}]} accessible accessibilityLabel="Animated three-dimensional ascension crystal with luminous orbit rings">
    <LinearGradient colors={['#0B1930','#080B20','#120D2C']} style={StyleSheet.absoluteFill}/>
    {!failed&&<GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate}/>}
    <LinearGradient pointerEvents="none" colors={['transparent','#05091400','#050914C5']}
      style={StyleSheet.absoluteFill}/>
    {/* Deliberately retain a visible animated ceremonial core even if GPU
        shaders report success but produce a black frame on an emulator. */}
    <CrystalFallback active={active} reduceMotion={reduceMotion} opacity={failed?.98:.87}/>
    <View pointerEvents="none" style={styles.corner}>
      <View style={styles.dot}/><View><View style={{height:1,width:28,backgroundColor:'#6AAFF7'}}/></View>
    </View>
    <View pointerEvents="none" style={styles.rank}>
      <View style={styles.rankPill}><View style={styles.dot}/></View>
    </View>
    <View pointerEvents="none" style={styles.bottom}>
      <View style={styles.line}/>
      <View style={styles.centerLine}/>
      <View style={styles.line}/>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  shell:{width:'100%',overflow:'hidden',backgroundColor:C.bg,borderRadius:28,
    borderWidth:1,borderColor:'#335C8F',marginBottom:12},
  corner:{position:'absolute',top:18,left:18,flexDirection:'row',alignItems:'center',gap:10},
  dot:{height:7,width:7,borderRadius:4,backgroundColor:'#7CEAFF'},
  rank:{position:'absolute',top:18,right:18},
  rankPill:{borderWidth:1,borderColor:'#5182AE',borderRadius:20,padding:8,backgroundColor:'#0E2036'},
  bottom:{position:'absolute',bottom:15,left:18,right:18,flexDirection:'row',
    alignItems:'center',justifyContent:'space-between',gap:6},
  line:{height:1,backgroundColor:'#27577E',flex:1},
  centerLine:{height:2,width:36,borderRadius:5,backgroundColor:'#7DDFF9'}
});
