import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import {
  loadSkyrimConvertedAnimationLibrary,
  retargetConvertedSkyrimGltf,
} from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from '../../src/combat/longsword-guard-metadata.js';
import { applyGuardQuaternionOffsets } from '../../src/combat/longsword-guard-correction.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G3.3.1 requires Three.js + GLTFLoader');

const IDS = Object.freeze(['shd_blockhit','shd_blockbashintro','shd_blockbash','shd_blockbashpower']);
const SOURCE_URL = '../../assets/skyrim/guard/converted/shd_blockidle.source.glb';
const DATA_BASE = './.g331/';
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1018);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x27344a, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(3,5,4); scene.add(key);
scene.add(new THREE.GridHelper(8,16,0x34435d,0x202a3b));

const character = createDefaultCharacter(THREE);
scene.add(character.object3d);
let sword = null;
const clips = new Map();
const diagnostics = {};
let selected = 'shd_blockhit';
let progress = 0.5;

const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const hud = document.getElementById('hud');
const progressInput = document.getElementById('progress');

function setView(view) {
  if (view === 'front') camera.position.set(0,1.42,5.3);
  else if (view === 'side') camera.position.set(5.2,1.45,0);
  else if (view === 'back') camera.position.set(0,1.42,-5.3);
  else camera.position.set(4.0,1.58,4.25);
  camera.lookAt(0,1.0,0); camera.updateMatrixWorld(true);
}
function resize(){ const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
function loadGlb(url){ return new Promise((resolve,reject)=>new THREE.GLTFLoader().load(url,resolve,undefined,reject)); }

function vec3Values(values, frames) {
  const out = [];
  for (let i=0;i<frames;i++) {
    const v = values[i] || values.at(-1) || [0,0,0];
    out.push(Number(v[0])||0, Number(v[1])||0, Number(v[2])||0);
  }
  return out;
}
function quatValues(values, frames) {
  const out = [];
  for (let i=0;i<frames;i++) {
    const v = values[i] || values.at(-1) || [0,0,0,1];
    const q = new THREE.Quaternion(Number(v[0])||0,Number(v[1])||0,Number(v[2])||0,Number(v[3])||1).normalize();
    out.push(q.x,q.y,q.z,q.w);
  }
  return out;
}

function sourceClipFromDecoded(gltf, data, id) {
  if (data.numTracks !== data.jointNames.length || data.numTracks !== data.tracks.length) {
    throw new Error(`${id}: decoded track/joint mismatch`);
  }
  const frameCount = data.numFrames;
  const times = Array.from({length:frameCount},(_,i)=>Math.min(data.duration, i * data.frameDuration));
  const tracks = [];
  for (let index=0; index<data.numTracks; index++) {
    const name = data.jointNames[index];
    const node = gltf.scene.getObjectByName(name);
    if (!node) throw new Error(`${id}: canonical source hierarchy missing joint ${index} ${name}`);
    const source = data.tracks[index];
    if (source.translations?.length) tracks.push(new THREE.VectorKeyframeTrack(`${node.uuid}.position`, times, vec3Values(source.translations,frameCount)));
    if (source.rotations?.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${node.uuid}.quaternion`, times, quatValues(source.rotations,frameCount)));
    if (source.scales?.length) tracks.push(new THREE.VectorKeyframeTrack(`${node.uuid}.scale`, times, vec3Values(source.scales,frameCount)));
  }
  return new THREE.AnimationClip(`SOURCE/${id}`, data.duration, tracks);
}

async function buildReaction(id) {
  const [gltf, data] = await Promise.all([
    loadGlb(SOURCE_URL),
    fetch(`${DATA_BASE}${id}.json`).then((r)=>{ if(!r.ok) throw new Error(`${id} decoded data ${r.status}`); return r.json(); }),
  ]);
  const sourceClip = sourceClipFromDecoded(gltf, data, id);
  const targetClip = retargetConvertedSkyrimGltf(THREE, { scene:gltf.scene, animations:[sourceClip] }, character.rig, {
    id,
    file:`${id}.source-probe`,
    clipId:`SKYRIM_REACTION/${id}`,
    role:'G3.3.1 visual probe',
  }, { fps:30 });
  clips.set(id,targetClip);
  diagnostics[id] = {
    duration:Number(targetClip.duration.toFixed(6)),
    sourceFrames:data.numFrames,
    sourceTracks:data.numTracks,
    translationScale:Number(targetClip.userData.translationScale.toFixed(8)),
    root:targetClip.userData.translationMetrics.root,
    hips:targetClip.userData.translationMetrics.hips,
    translationSafety:targetClip.userData.translationSafety,
    armMaxErrorDegrees:Number(targetClip.userData.armChainMetrics.maxDirectionErrorDegrees.toFixed(6)),
    helperCoverage:targetClip.userData.armChainMetrics.helperCoverage,
  };
}

function sample(id=selected, value=progress) {
  const clip = clips.get(id); if(!clip || !sword) return;
  selected=id; progress=Math.max(0,Math.min(1,Number(value)||0));
  character.sampleAnimation(clip.name, clip.duration * Math.min(0.999999,progress), { loop:false, inPlace:true });
  applyGuardQuaternionOffsets(THREE, character.rig, LONGSWORD_GUARD_AUTHORING_STATE.offsets);
  character.object3d.updateMatrixWorld(true); sword.update(); character.update(0,camera); character.object3d.updateMatrixWorld(true); sword.update();
  const sweep=sword.getSweepSegment();
  const weaponHand=character.rig.bones['hand.r'].getWorldPosition(new THREE.Vector3());
  const offHand=character.rig.bones['hand.l'].getWorldPosition(new THREE.Vector3());
  const hips=character.rig.bones.hips.getWorldPosition(new THREE.Vector3());
  hud.textContent=`${id} · ${(progress*100).toFixed(0)}% · ${(clip.duration*progress).toFixed(3)}s`;
  progressInput.value=String(progress);
  return { id, progress, swordGrip:sweep.start.toArray(), swordTip:sweep.end.toArray(), weaponHand:weaponHand.toArray(), offHand:offHand.toArray(), hips:hips.toArray() };
}

async function main(){
  status.textContent='Loading accepted Guard bind + four decoded reactions…'; status.className='warn';
  const idleLibrary=await loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(),{THREE,rig:character.rig,fps:30});
  const idleClip=idleLibrary.clips.get('SKYRIM_GUARD/shd_blockidle');
  if(!idleClip?.userData?.weaponBindCalibration?.correctionQuaternion) throw new Error('Accepted G2.4.5 weapon bind missing');
  sword=createDebugSword(THREE);
  mountDebugSword(character,sword,composeSkyrimWeaponMountCalibration(THREE,DEFAULT_KAYKIT_SWORD_MOUNT,idleClip.userData.weaponBindCalibration));
  for(const id of IDS) await buildReaction(id);
  character.registerAnimations({clips:new Map([...clips.values()].map((clip)=>[clip.name,clip])),source:'g331-probe'});
  const engineeringPass=IDS.every((id)=>diagnostics[id].translationSafety.safe && diagnostics[id].armMaxErrorDegrees <= 0.1);
  const result={stage:'G3.3.1',engineeringPass,diagnostics};
  document.documentElement.dataset.g331=engineeringPass?'pass':'fail';
  document.documentElement.dataset.g331Count=String(IDS.length);
  reportNode.textContent=JSON.stringify(result,null,2); window.__G331_RESULT__=result;
  status.textContent=`G3.3.1 engineering ${engineeringPass?'PASS':'FAIL'} · visual decision still requires screenshots`; status.className=engineeringPass?'good':'bad';
  const params=new URLSearchParams(location.search); selected=IDS.includes(params.get('clip'))?params.get('clip'):'shd_blockhit'; progress=Math.max(0,Math.min(1,Number(params.get('progress')??0.5))); setView(params.get('view')||'three'); sample();
}

document.querySelectorAll('[data-clip]').forEach((b)=>b.addEventListener('click',()=>sample(b.dataset.clip,progress)));
document.querySelectorAll('[data-view]').forEach((b)=>b.addEventListener('click',()=>setView(b.dataset.view)));
progressInput.addEventListener('input',()=>sample(selected,Number(progressInput.value)));
setView('three'); resize(); addEventListener('resize',resize);
(function frame(){ if(sword)sword.update(); renderer.render(scene,camera); requestAnimationFrame(frame); })();
main().catch((error)=>{ document.documentElement.dataset.g331='fail'; status.textContent=`FAIL · ${error.message||error}`; status.className='bad'; reportNode.textContent=error.stack||String(error); window.__G331_RESULT__={stage:'G3.3.1',engineeringPass:false,error:error.stack||String(error)}; });
