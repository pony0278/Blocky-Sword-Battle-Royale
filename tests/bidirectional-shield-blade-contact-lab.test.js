import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('tools/action-studio/bidirectional-shield-blade-contact-lab-r292r111.html','utf8');
const source=fs.readFileSync('tools/action-studio/bidirectional-shield-blade-contact-lab-r292r111.js','utf8');
function section(name,nextName){const start=source.indexOf(`function ${name}`);assert.ok(start>=0,`missing ${name}`);const end=nextName?source.indexOf(`function ${nextName}`,start+1):source.length;return source.slice(start,end>start?end:source.length);}

test('R1.1.1 HTML loads dedicated bidirectional physical-contact lab',()=>{assert.match(html,/G4\.3B\.5R\.2\.9\.2R1\.1\.1/);assert.match(html,/Bidirectional Shield/);assert.match(html,/servo-driven physical body/);assert.match(html,/bidirectional-shield-blade-contact-lab-r292r111\.js/);});

test('actual shield is servo-driven physical state rather than animation pose authority',()=>{const fixed=section('fixedStep','groupedDelta');assert.match(source,/stepServoDrivenShield\(/);assert.match(source,/syncShieldVisualFromPhysicalState\(/);assert.match(source,/sampleShieldMotorTarget\(/);assert.doesNotMatch(source,/function setShieldPose/);assert.doesNotMatch(fixed,/shield\.position\.set\(/);});

test('initial whole-blade CCD feeds one coupled bidirectional impulse',()=>{const contact=section('solveInitialCcd','solvePersistentContact');const ccd=contact.indexOf('probeSweptBladeShieldPhysicalContact({');const coupled=contact.indexOf('solveBidirectionalShieldBladeImpulse({');assert.ok(ccd>=0);assert.ok(coupled>ccd);assert.match(contact,/bladeFraction:contact\.bladeFraction/);assert.match(contact,/contactPoint:contact\.point/);assert.match(contact,/contactNormal:contact\.normal/);assert.match(contact,/shieldState:impactShield/);});

test('post-contact authority keeps solving persistent shield-blade surface contact',()=>{const persistent=section('solvePersistentContact','fixedStep');assert.match(persistent,/probePersistentBladeShieldContact\(/);assert.match(persistent,/solveBidirectionalShieldBladeImpulse\(/);assert.match(persistent,/persistentGeometricSteps\+=1/);assert.match(persistent,/persistentImpulseSteps\+=1/);assert.match(persistent,/contactAgeSeconds\+=FIXED_DT/);assert.doesNotMatch(source,/hit\s*=\s*true/);});

test('lab preserves R1.1 attacker authority and forbids rejected models',()=>{assert.match(source,/forwardAnatomicalSwordArm3D/);assert.match(source,/stepAnatomical3dJointState/);assert.doesNotMatch(source,/solveAnatomical3dContactImpulse/);assert.doesNotMatch(source,/solveKinematicShieldSwordImpulse/);assert.doesNotMatch(source,/physical-grip-wrist-compliance/);assert.doesNotMatch(source,/aimEffectorWithBone|applyRigPose|followRatio|poseTarget|targetPose/);assert.match(source,/const FIXED_DT = 1 \/ 240/);});

test('report exposes bidirectional and persistence invariants',()=>{assert.match(source,/shieldIsServoDrivenPhysicalBody:true/);assert.match(source,/animationProvidesTargetOnly:true/);assert.match(source,/bidirectionalEqualOppositeImpulse:true/);assert.match(source,/persistentContactAfterInitialCcd:true/);assert.match(source,/noOneShotHitAuthority:true/);assert.match(source,/noKinematicSetShieldPoseAuthority:true/);});
