import { probeSweptBladeShieldPhysicalContact } from '../../src/combat/swept-blade-shield-physical-contact.js?v=g43b5r292r111';
import {
  ANATOMICAL_3D_DOF_NAMES,
  ANATOMICAL_3D_JOINT_DEFAULTS,
  buildBladePolylineFromAnatomicalArm3D,
  forwardAnatomicalSwordArm3D,
  stepAnatomical3dJointState,
} from '../../src/combat/anatomical-3d-joint-response.js?v=g43b5r292r111';
import {
  BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE,
  BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS,
  createServoDrivenShieldState,
  probePersistentBladeShieldContact,
  solveBidirectionalShieldBladeImpulse,
  stepServoDrivenShield,
} from '../../src/combat/bidirectional-shield-blade-contact.js?v=g43b5r292r111';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer) throw new Error(`${BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE} requires Three.js r128`);

const FIXED_DT = 1 / 240;
const SHIELD_RADIUS = 0.42;
const SHIELD_THICKNESS = 0.065;
const RIM_BAND_METERS = 0.035;
const CONTACT_CENTER_SECONDS = 0.15;
const BASE_SWEEP_DURATION_SECONDS = 0.20;
const LOCAL_SHIELD_FACE_NORMAL = new THREE.Vector3(0, -1, 0);
const SHOULDER_ORIGIN = Object.freeze({ x: -0.95, y: 1.16, z: -0.70 });
const GEOMETRY = Object.freeze({ upperArmLengthMeters: 0.38, forearmLengthMeters: 0.31, handLengthMeters: 0.10, guardOffsetMeters: 0.08, swordLengthMeters: 1.05 });
const REST_ANGLES = Object.freeze({ shoulderYaw: deg(15), shoulderPitch: deg(-4), shoulderRoll: deg(4), elbowFlex: deg(-25), forearmRoll: deg(8), wristFlex: deg(20), wristDeviation: deg(-4) });
const ATTACK_QDOT = Object.freeze({ shoulderYaw: 1.34, shoulderPitch: -0.10, shoulderRoll: 0.08, elbowFlex: 0.34, forearmRoll: 0.10, wristFlex: 0.18, wristDeviation: 0.06 });

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 7, 15);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
camera.position.set(3.55, 2.65, -4.45);
camera.lookAt(-0.08, 1.08, -0.22);
scene.add(new THREE.HemisphereLight(0xddeaff, 0x202738, 1.35));
const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(4, 7, -3); scene.add(key);
const rimLight = new THREE.DirectionalLight(0x84e7d3, 0.55); rimLight.position.set(-4, 3, 2); scene.add(rimLight);
scene.add(new THREE.GridHelper(10, 20, 0x33445f, 0x202a3b));

function makeShield(material) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(SHIELD_RADIUS, SHIELD_RADIUS, SHIELD_THICKNESS, 48), material);
  group.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(SHIELD_RADIUS, 0.018, 10, 48), new THREE.MeshBasicMaterial({ color: 0xb9fbff, transparent: material.transparent, opacity: material.opacity ?? 1, wireframe: material.wireframe ?? false }));
  rim.rotation.x = Math.PI / 2; rim.position.y = -SHIELD_THICKNESS * 0.52; group.add(rim);
  scene.add(group); return group;
}
const shield = makeShield(new THREE.MeshStandardMaterial({ color: 0x39c6d8, metalness: 0.55, roughness: 0.34, transparent: true, opacity: 0.82 }));
const targetShield = makeShield(new THREE.MeshBasicMaterial({ color: 0x8defff, transparent: true, opacity: 0.18, wireframe: true }));
targetShield.visible = false;

const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.26), new THREE.MeshStandardMaterial({ color: 0x51446f, roughness: 0.62 }));
torso.position.set(SHOULDER_ORIGIN.x - 0.14, SHOULDER_ORIGIN.y - 0.15, SHOULDER_ORIGIN.z - 0.02); scene.add(torso);
function makeBone(color, thickness) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, thickness, thickness), new THREE.MeshStandardMaterial({ color, roughness: 0.55 })); scene.add(mesh); return mesh; }
function makeJoint(color, radius = 0.045) { const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), new THREE.MeshBasicMaterial({ color })); scene.add(mesh); return mesh; }
const upperArmMesh = makeBone(0x79c79a, 0.095), forearmMesh = makeBone(0x71bb92, 0.080), handMesh = makeBone(0x8ed8ae, 0.070), bladeMesh = makeBone(0xe2e7ef, 0.032), handleMesh = makeBone(0x5f4737, 0.055), crossguardMesh = makeBone(0xb9a778, 0.040);
bladeMesh.material.metalness = 0.78; bladeMesh.material.roughness = 0.20; crossguardMesh.material.metalness = 0.55;
const shoulderJoint = makeJoint(0xa997e8, 0.052), elbowJoint = makeJoint(0xffcb77, 0.045), wristJoint = makeJoint(0x7ef0ad, 0.042), contactMarker = makeJoint(0xff955f, 0.052); contactMarker.visible = false;
const impulseArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),0.6,0xff8b4f,0.11,0.055);
const reactionArrow = new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(),0.6,0x69e5ff,0.11,0.055);
impulseArrow.visible = reactionArrow.visible = false; scene.add(impulseArrow,reactionArrow);

const hudContact=document.getElementById('hudContact'),hudPersistence=document.getElementById('hudPersistence'),hudImpulse=document.getElementById('hudImpulse'),hudShield=document.getElementById('hudShield'),hudArm=document.getElementById('hudArm'),hudServo=document.getElementById('hudServo');
const status=document.getElementById('status'),reportNode=document.getElementById('report');
const shieldSpeedInput=document.getElementById('shieldSpeed'),shieldMassInput=document.getElementById('shieldMass'),servoScaleInput=document.getElementById('servoScale'),contactMsInput=document.getElementById('contactMs'),showTargetInput=document.getElementById('showTarget');
const shieldSpeedValue=document.getElementById('shieldSpeedValue'),shieldMassValue=document.getElementById('shieldMassValue'),servoScaleValue=document.getElementById('servoScaleValue'),contactMsValue=document.getElementById('contactMsValue');

let accumulator=0,simTime=0,lastTimestamp=performance.now(),paused=false,initialContactEstablished=false,contactActive=false,contactAgeSeconds=0,contactMissSteps=0,persistentGeometricSteps=0,persistentImpulseSteps=0;
let latestInitialContact=null,latestSurfaceContact=null,latestImpulse=null,latestServo=null,lastBladeFraction=0.5;
let maxShieldLinearReaction=0,maxShieldAngularReaction=0,maxServoPositionError=0,maxServoAngularError=0,maxTipTravel=0,maxWristTravel=0;
let impactTip=null,impactWrist=null;
let armState=makeInitialArmState();
let shieldState=createServoDrivenShieldState({center:{x:0,y:0,z:0},quaternion:{x:0,y:0,z:0,w:1},massKg:shieldMass()});

function deg(v){return v*Math.PI/180;} function degrees(v){return v*180/Math.PI;} function clamp01(v){return Math.max(0,Math.min(1,v));} function smoothstep(t){const u=clamp01(t);return u*u*(3-2*u);} function lerp(a,b,t){return a+(b-a)*t;} function v3(v){return new THREE.Vector3(v.x,v.y,v.z);}
function shieldSpeed(){return Number(shieldSpeedInput.value)||1;} function shieldMass(){return Number(shieldMassInput.value)||5.6;} function servoScale(){return Number(servoScaleInput.value)||1;} function contactMaxSeconds(){return (Number(contactMsInput.value)||30)/1000;}
function makeInitialArmState(){return{anglesRad:{...REST_ANGLES},jointVelocityRadPerSecond:{...ATTACK_QDOT}};}
function refreshLabels(){shieldSpeedValue.textContent=`${shieldSpeed().toFixed(2)}×`;shieldMassValue.textContent=`${shieldMass().toFixed(2)}kg`;servoScaleValue.textContent=`${servoScale().toFixed(2)}×`;contactMsValue.textContent=`${Math.round(contactMaxSeconds()*1000)}ms`;}

function sampleShieldMotorTarget(timeSeconds){
  const duration=BASE_SWEEP_DURATION_SECONDS/Math.max(0.35,shieldSpeed()); const start=CONTACT_CENTER_SECONDS-duration*0.5; const p=smoothstep((timeSeconds-start)/duration);
  const center=new THREE.Vector3(lerp(0.28,0.02,p),1.12+Math.sin(p*Math.PI)*0.020,lerp(-0.12,-0.18,p));
  const parryAngle=deg(lerp(-6,24,p)); const desiredNormal=new THREE.Vector3(Math.sin(parryAngle),0.045*Math.sin(p*Math.PI),-Math.cos(parryAngle)).normalize();
  const quaternion=new THREE.Quaternion().setFromUnitVectors(LOCAL_SHIELD_FACE_NORMAL,desiredNormal).normalize();
  return{center,quaternion};
}
function angularVelocityBetween(previousQuaternion,currentQuaternion,dt){const delta=currentQuaternion.clone().multiply(previousQuaternion.clone().invert()).normalize();if(delta.w<0){delta.x*=-1;delta.y*=-1;delta.z*=-1;delta.w*=-1;}const w=Math.max(-1,Math.min(1,delta.w)),angle=2*Math.acos(w),s=Math.sqrt(Math.max(0,1-w*w));return angle<1e-7||s<1e-7?new THREE.Vector3():new THREE.Vector3(delta.x/s,delta.y/s,delta.z/s).multiplyScalar(angle/Math.max(dt,1e-6));}
function buildTargetForStep(timeSeconds,dt){const previous=sampleShieldMotorTarget(Math.max(0,timeSeconds-dt)),current=sampleShieldMotorTarget(timeSeconds);return{center:{x:current.center.x,y:current.center.y,z:current.center.z},quaternion:{x:current.quaternion.x,y:current.quaternion.y,z:current.quaternion.z,w:current.quaternion.w},linearVelocity:{x:(current.center.x-previous.center.x)/dt,y:(current.center.y-previous.center.y)/dt,z:(current.center.z-previous.center.z)/dt},angularVelocity:(()=>{const w=angularVelocityBetween(previous.quaternion,current.quaternion,dt);return{x:w.x,y:w.y,z:w.z};})(),visual:current};}
function servoProfile(){const s=servoScale();return{servoPositionStiffnessNPerM:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.servoPositionStiffnessNPerM*s,servoPositionDampingNsPerM:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.servoPositionDampingNsPerM*Math.sqrt(s),servoAngularStiffnessNmPerRad:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.servoAngularStiffnessNmPerRad*s,servoAngularDampingNmsPerRad:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.servoAngularDampingNmsPerRad*Math.sqrt(s),maxServoForceN:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.maxServoForceN*s,maxServoTorqueNm:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.maxServoTorqueNm*s};}
function inertiaProfile(){return{...ANATOMICAL_3D_JOINT_DEFAULTS.inertiaKgM2};}
function passiveProfile(){return{restAnglesRad:REST_ANGLES,inertiaKgM2:inertiaProfile()};}
function makeKinematics(anglesRad){return forwardAnatomicalSwordArm3D({shoulderOrigin:SHOULDER_ORIGIN,geometry:GEOMETRY,anglesRad});}
function predictAngles(angles,velocity,dt){return Object.fromEntries(ANATOMICAL_3D_DOF_NAMES.map((n)=>[n,angles[n]+velocity[n]*dt]));}
function dofLerp(a,b,t){return Object.fromEntries(ANATOMICAL_3D_DOF_NAMES.map((n)=>[n,lerp(a[n],b[n],t)]));}
function shieldPose(state){return{center:{...state.center},quaternion:{...state.quaternion}};}
function setSegmentMesh(mesh,aValue,bValue){const a=v3(aValue),b=v3(bValue),direction=b.clone().sub(a),segmentLength=direction.length();if(segmentLength<=1e-7)return;mesh.position.copy(a).add(b).multiplyScalar(0.5);mesh.scale.set(segmentLength,1,1);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction.normalize());}
function updateArmVisuals(){const k=makeKinematics(armState.anglesRad);setSegmentMesh(upperArmMesh,k.shoulder,k.elbow);setSegmentMesh(forearmMesh,k.elbow,k.wrist);setSegmentMesh(handMesh,k.wrist,k.grip);setSegmentMesh(bladeMesh,k.bladeStart,k.bladeTip);const handDir=v3(k.handDirection).normalize(),handUp=v3(k.handUp).normalize(),handleBack=v3(k.grip).addScaledVector(handDir,-0.11);setSegmentMesh(handleMesh,handleBack,k.bladeStart);const guardCenter=v3(k.bladeStart);setSegmentMesh(crossguardMesh,guardCenter.clone().addScaledVector(handUp,-0.13),guardCenter.clone().addScaledVector(handUp,0.13));shoulderJoint.position.copy(v3(k.shoulder));elbowJoint.position.copy(v3(k.elbow));wristJoint.position.copy(v3(k.wrist));if(impactTip&&impactWrist){maxTipTravel=Math.max(maxTipTravel,v3(k.bladeTip).distanceTo(impactTip));maxWristTravel=Math.max(maxWristTravel,v3(k.wrist).distanceTo(impactWrist));}return k;}
function syncShieldVisualFromPhysicalState(){shield.position.set(shieldState.center.x,shieldState.center.y,shieldState.center.z);shield.quaternion.set(shieldState.quaternion.x,shieldState.quaternion.y,shieldState.quaternion.z,shieldState.quaternion.w);shield.updateMatrixWorld(true);}
function syncTargetGhost(target){targetShield.visible=showTargetInput.checked;if(!targetShield.visible)return;targetShield.position.copy(target.visual.center);targetShield.quaternion.copy(target.visual.quaternion);targetShield.updateMatrixWorld(true);}
function stepPassiveArm(dt){const next=stepAnatomical3dJointState(armState,dt,passiveProfile());armState={anglesRad:{...next.anglesRad},jointVelocityRadPerSecond:{...next.jointVelocityRadPerSecond}};}
function showImpulse(point,impulse){contactMarker.position.copy(v3(point));contactMarker.visible=true;const j=v3(impulse.impulse);if(j.lengthSq()>1e-8){impulseArrow.position.copy(v3(point));impulseArrow.setDirection(j.clone().normalize());impulseArrow.setLength(Math.min(1.15,0.16+j.length()*0.18),0.11,0.055);impulseArrow.visible=true;reactionArrow.position.copy(v3(point));reactionArrow.setDirection(j.clone().normalize().multiplyScalar(-1));reactionArrow.setLength(Math.min(1.15,0.16+j.length()*0.18),0.11,0.055);reactionArrow.visible=true;}}
function trackReaction(impulse){if(!impulse?.applied)return;maxShieldLinearReaction=Math.max(maxShieldLinearReaction,Math.hypot(impulse.nextShieldState.deltaLinearVelocity?.x||0,impulse.nextShieldState.deltaLinearVelocity?.y||0,impulse.nextShieldState.deltaLinearVelocity?.z||0));maxShieldAngularReaction=Math.max(maxShieldAngularReaction,Math.hypot(impulse.nextShieldState.deltaAngularVelocity?.x||0,impulse.nextShieldState.deltaAngularVelocity?.y||0,impulse.nextShieldState.deltaAngularVelocity?.z||0));}

function resetSimulation(){accumulator=0;simTime=0;paused=false;initialContactEstablished=false;contactActive=false;contactAgeSeconds=0;contactMissSteps=0;persistentGeometricSteps=0;persistentImpulseSteps=0;latestInitialContact=null;latestSurfaceContact=null;latestImpulse=null;latestServo=null;lastBladeFraction=0.5;maxShieldLinearReaction=maxShieldAngularReaction=maxServoPositionError=maxServoAngularError=maxTipTravel=maxWristTravel=0;impactTip=impactWrist=null;armState=makeInitialArmState();const target0=sampleShieldMotorTarget(0);shieldState=createServoDrivenShieldState({center:{x:target0.center.x,y:target0.center.y,z:target0.center.z},quaternion:{x:target0.quaternion.x,y:target0.quaternion.y,z:target0.quaternion.z,w:target0.quaternion.w},massKg:shieldMass(),inertiaKgM2:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.shieldInertiaKgM2});contactMarker.visible=impulseArrow.visible=reactionArrow.visible=false;syncShieldVisualFromPhysicalState();updateArmVisuals();status.textContent=`${BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE} READY · physical shield servo armed`;status.className='warn';buildReport();}

function solveInitialCcd(previousAngles,predictedAngles,previousShieldState,predictedShieldState,dt,target){const previousK=makeKinematics(previousAngles),predictedK=makeKinematics(predictedAngles);const contact=probeSweptBladeShieldPhysicalContact({previousBlade:buildBladePolylineFromAnatomicalArm3D(previousK),currentBlade:buildBladePolylineFromAnatomicalArm3D(predictedK),previousShieldPose:shieldPose(previousShieldState),currentShieldPose:shieldPose(predictedShieldState),shieldRadiusMeters:SHIELD_RADIUS,shieldThicknessMeters:SHIELD_THICKNESS,rimBandMeters:RIM_BAND_METERS,localFaceNormal:{x:0,y:-1,z:0},deltaSeconds:dt,active:true});if(!contact.contact)return false;const impactAngles=dofLerp(previousAngles,predictedAngles,contact.sweepAlpha),impactK=makeKinematics(impactAngles);const impactShield=createServoDrivenShieldState({center:contact.impactShieldPose.center,quaternion:contact.impactShieldPose.quaternion,linearVelocity:predictedShieldState.linearVelocity,angularVelocity:predictedShieldState.angularVelocity,massKg:predictedShieldState.massKg,inertiaKgM2:predictedShieldState.inertiaKgM2});const coupled=solveBidirectionalShieldBladeImpulse({kinematics:impactK,anglesRad:impactAngles,bladeFraction:contact.bladeFraction,contactPoint:contact.point,contactNormal:contact.normal,shieldState:impactShield,jointVelocityRadPerSecond:armState.jointVelocityRadPerSecond,inertiaKgM2:inertiaProfile(),restitution:0.05,friction:0.72});latestInitialContact=contact;latestImpulse=coupled;lastBladeFraction=contact.bladeFraction;if(!coupled.applied){status.textContent=`${BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE} CCD CONTACT but coupled impulse rejected: ${coupled.reason}`;status.className='bad';return false;}armState={anglesRad:impactAngles,jointVelocityRadPerSecond:{...coupled.nextJointVelocityRadPerSecond}};shieldState=coupled.nextShieldState;initialContactEstablished=true;contactActive=true;contactAgeSeconds=0;contactMissSteps=0;persistentGeometricSteps=1;persistentImpulseSteps=1;const impactTipK=impactK;impactTip=v3(impactTipK.bladeTip);impactWrist=v3(impactTipK.wrist);showImpulse(contact.point,coupled);trackReaction(coupled);const remaining=dt*(1-contact.sweepAlpha);if(remaining>0){stepPassiveArm(remaining);shieldState=stepServoDrivenShield(shieldState,target,remaining,servoProfile());}status.textContent=`${BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE} CONTACT · shared impulse + persistent contact window`;status.className='good';return true;}

function solvePersistentContact(){if(!contactActive||contactAgeSeconds>contactMaxSeconds())return;const k=makeKinematics(armState.anglesRad);const surface=probePersistentBladeShieldContact({bladeStart:k.bladeStart,bladeTip:k.bladeTip,shieldState,shieldRadiusMeters:SHIELD_RADIUS,shieldThicknessMeters:SHIELD_THICKNESS,localFaceNormal:{x:0,y:-1,z:0},previousBladeFraction:lastBladeFraction,contactToleranceMeters:BIDIRECTIONAL_SHIELD_BLADE_DEFAULTS.contactToleranceMeters});latestSurfaceContact=surface;contactAgeSeconds+=FIXED_DT;if(!surface.contact){contactMissSteps+=1;if(contactMissSteps>=2)contactActive=false;return;}contactMissSteps=0;persistentGeometricSteps+=1;lastBladeFraction=surface.bladeFraction;const coupled=solveBidirectionalShieldBladeImpulse({kinematics:k,anglesRad:armState.anglesRad,bladeFraction:surface.bladeFraction,contactPoint:surface.point,contactNormal:surface.normal,shieldState,jointVelocityRadPerSecond:armState.jointVelocityRadPerSecond,inertiaKgM2:inertiaProfile(),restitution:0,friction:0.76,maximumImpulseNs:8});if(coupled.applied){armState={anglesRad:{...armState.anglesRad},jointVelocityRadPerSecond:{...coupled.nextJointVelocityRadPerSecond}};shieldState=coupled.nextShieldState;latestImpulse=coupled;persistentImpulseSteps+=1;showImpulse(surface.point,coupled);trackReaction(coupled);}if(contactAgeSeconds>=contactMaxSeconds())contactActive=false;}

function fixedStep(dt){if(paused)return;const previousShieldState=shieldState;const previousAngles={...armState.anglesRad};simTime+=dt;const target=buildTargetForStep(simTime,dt);const predictedShieldState=stepServoDrivenShield(shieldState,target,dt,servoProfile());latestServo=predictedShieldState;maxServoPositionError=Math.max(maxServoPositionError,predictedShieldState.positionErrorMeters||0);maxServoAngularError=Math.max(maxServoAngularError,predictedShieldState.angularErrorRadians||0);syncTargetGhost(target);
  if(!initialContactEstablished){const predictedAngles=predictAngles(previousAngles,armState.jointVelocityRadPerSecond,dt);const contacted=solveInitialCcd(previousAngles,predictedAngles,previousShieldState,predictedShieldState,dt,target);if(!contacted){shieldState=predictedShieldState;armState.anglesRad=predictedAngles;}}
  else{shieldState=predictedShieldState;stepPassiveArm(dt);solvePersistentContact();}
  syncShieldVisualFromPhysicalState();updateArmVisuals();buildReport();
  if(initialContactEstablished&&simTime>0.84)paused=true;else if(!initialContactEstablished&&simTime>0.60){paused=true;status.textContent=`${BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE} NO CONTACT · physical shield missed blade`;status.className='bad';}}

function groupedDelta(d={}){return{wrist:Math.hypot(d.wristFlex||0,d.wristDeviation||0),elbowForearm:Math.hypot(d.elbowFlex||0,d.forearmRoll||0),shoulder:Math.hypot(d.shoulderYaw||0,d.shoulderPitch||0,d.shoulderRoll||0)};}
function updateHud(){hudContact.textContent=latestInitialContact?`Initial CCD: blade ${latestInitialContact.bladeFraction.toFixed(3)} · ${latestInitialContact.contactFeature} · TOI ${(latestInitialContact.timeOfImpactSeconds*1000).toFixed(2)}ms`:'Contact: waiting…';hudPersistence.textContent=initialContactEstablished?`Persistence: ${persistentGeometricSteps} geometric steps · ${persistentImpulseSteps} impulse steps · ${(contactAgeSeconds*1000).toFixed(1)}ms · ${contactActive?'ACTIVE':'released'}`:'Persistence: —';hudImpulse.textContent=latestImpulse?.applied?`Coupled J: ${latestImpulse.normalImpulseNs.toFixed(2)} N·s normal + ${latestImpulse.frictionImpulseNs.toFixed(2)} tangent · one shared impulse`:'Coupled impulse: —';hudShield.textContent=latestImpulse?.applied?`Shield reaction: max Δv ${maxShieldLinearReaction.toFixed(3)}m/s · max Δω ${degrees(maxShieldAngularReaction).toFixed(1)}°/s · mass ${shieldMass().toFixed(2)}kg`:'Shield reaction: —';const g=groupedDelta(latestImpulse?.deltaJointVelocityRadPerSecond);hudArm.textContent=latestImpulse?.applied?`Arm Δω: wrist ${degrees(g.wrist).toFixed(1)}°/s · elbow/forearm ${degrees(g.elbowForearm).toFixed(1)}°/s · shoulder ${degrees(g.shoulder).toFixed(1)}°/s`:'Arm response: —';hudServo.textContent=latestServo?`Servo lag: pos ${(latestServo.positionErrorMeters*1000).toFixed(1)}mm (max ${(maxServoPositionError*1000).toFixed(1)}) · angle ${degrees(latestServo.angularErrorRadians).toFixed(1)}° (max ${degrees(maxServoAngularError).toFixed(1)}°)`:'Servo: —';}
function buildReport(){const report={stage:BIDIRECTIONAL_SHIELD_BLADE_CONTACT_STAGE,pass:Boolean(latestInitialContact?.contact&&latestImpulse?.applied),initialCcd:latestInitialContact?{bladeFraction:latestInitialContact.bladeFraction,sweepAlpha:latestInitialContact.sweepAlpha,timeOfImpactSeconds:latestInitialContact.timeOfImpactSeconds,feature:latestInitialContact.contactFeature}:null,persistentContact:{active:contactActive,ageSeconds:contactAgeSeconds,geometricSteps:persistentGeometricSteps,impulseSteps:persistentImpulseSteps,lastSurfaceSignedDistanceMeters:latestSurfaceContact?.surfaceSignedDistanceMeters??null},shieldReaction:{maxDeltaLinearVelocity:maxShieldLinearReaction,maxDeltaAngularVelocity:maxShieldAngularReaction,maxServoPositionError,maxServoAngularError},travel:{maxTipTravel,maxWristTravel},invariants:{shieldIsServoDrivenPhysicalBody:true,animationProvidesTargetOnly:true,bidirectionalEqualOppositeImpulse:true,persistentContactAfterInitialCcd:true,attackerAnatomical7Dof:true,rigidGrip:true,noOneShotHitAuthority:true,noKinematicSetShieldPoseAuthority:true,noFreeSword:true,noSpringHand:true,fixedStepHz:240}};reportNode.textContent=JSON.stringify(report,null,2);document.documentElement.dataset.g43b5r292r111=report.pass?'pass':'pending';window.__G43B5R292R111_RESULT__=report;return report;}
function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function setPreset(v){if(v.shieldSpeed!=null)shieldSpeedInput.value=v.shieldSpeed;if(v.shieldMass!=null)shieldMassInput.value=v.shieldMass;if(v.servoScale!=null)servoScaleInput.value=v.servoScale;if(v.contactMs!=null)contactMsInput.value=v.contactMs;refreshLabels();resetSimulation();}
document.getElementById('restart').addEventListener('click',resetSimulation);document.getElementById('strong').addEventListener('click',()=>setPreset({shieldSpeed:1.65,shieldMass:5.6,servoScale:1,contactMs:30}));document.getElementById('heavy').addEventListener('click',()=>setPreset({shieldSpeed:1.65,shieldMass:8.5,servoScale:1.15,contactMs:28}));document.getElementById('softServo').addEventListener('click',()=>setPreset({shieldSpeed:1.65,shieldMass:5.6,servoScale:0.58,contactMs:30}));for(const input of[shieldSpeedInput,shieldMassInput,servoScaleInput,contactMsInput]){input.addEventListener('input',refreshLabels);input.addEventListener('change',resetSimulation);}showTargetInput.addEventListener('change',()=>{targetShield.visible=showTargetInput.checked;});refreshLabels();resize();addEventListener('resize',resize);resetSimulation();
function frame(timestamp){const frameSeconds=Math.min(0.05,Math.max(0,(timestamp-lastTimestamp)/1000));lastTimestamp=timestamp;accumulator+=frameSeconds;while(accumulator>=FIXED_DT){fixedStep(FIXED_DT);accumulator-=FIXED_DT;}updateHud();renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.__G43B5R292R111_LAB__={resetSimulation,get shieldState(){return shieldState;},get armState(){return armState;},get latestImpulse(){return latestImpulse;},get persistentImpulseSteps(){return persistentImpulseSteps;},get fixedStepHz(){return 1/FIXED_DT;}};
