# Blocky Sword Battle Royale — 專案文件索引

## 專案定位

一款面向 Web 平台的第三人稱多人刀劍對戰遊戲，核心特色為：

- 方塊人 / Blocky Low-Poly 角色風格
- 第三人稱 Souls-lite 鎖定戰鬥
- 6 種刀劍／近戰武器，各自具有獨特招式與戰鬥節奏
- 攻擊、格擋、Perfect Guard / Parry、反擊、閃避
- 小型 Battle Royale / 決鬥大逃殺結構
- 以短局、高密度交戰、高手技巧表現為核心
- 技術上採 Web + Authoritative Server 架構
- 可逐步延伸成 SRE / 即時多人系統作品集

---

## 文件清單

### 01 — Skills 與 Codex 工作流
`01_skills_and_codex_workflow.md`

內容：
- 建議使用的遊戲開發 Skills
- Codex 與 ChatGPT 的分工
- Three.js / Multiplayer / Game Feel / QA Skill 配置
- 建議開發流程
- Skill 避免重複與過度安裝原則

### 02 — 技術選型與程式架構
`02_technical_stack_architecture.md`

內容：
- TypeScript
- Three.js
- Rapier 3D
- Node.js
- Colyseus
- Redis
- PostgreSQL
- Combat Engine 架構
- Frame Data Driven 設計
- Client / Server 職責切分

### 03 — 網路拓樸與 SRE 路線
`03_network_topology_and_sre.md`

內容：
- Authoritative Server
- Matchmaking
- Game Room
- WebSocket
- Redis / Database
- Load Balancer
- Horizontal Scaling
- SLO / Metrics
- Grafana / Prometheus / OpenTelemetry
- Graceful Drain
- CI/CD
- Load Test / Chaos Test

### 04 — 視覺風格與美術方向
`04_visual_style_and_art_direction.md`

內容：
- 方塊人角色設計
- Low-Poly / Blocky 風格
- 程序化角色原型
- 武器輪廓設計
- 動作可讀性
- VFX / Hit Feel
- UI / Lock-on Target 視覺

### 05 — 動作、操作與戰鬥系統
`05_combat_actions_and_controls.md`

內容：
- Lock-on
- Strafe
- Light / Heavy Attack
- Guard
- Perfect Guard / Parry
- Counter
- Dodge
- Stamina
- Hitbox / Hurtbox
- Attack Timeline
- Combat State Machine
- 多人延遲與 Parry 驗證策略

### 06 — 武器、技能與道具
`06_weapons_skills_and_items.md`

內容：
- 6 種武器定位
- 每把武器的獨特招式
- Matchup
- 武器平衡原則
- 道具與 Battle Royale 資源設計
- 避免 Loot 數值膨脹
- 可用的 Utility / Consumable 類道具

### 07 — Directional Guard V1：Triangle Forward Guard
`07_directional_triangle_guard_spec.md`

內容：
- KayKit `Melee_Block` / `Melee_Blocking` 作為 authored Guard base 的使用邊界
- 劍尖、持劍手、空手形成前向 Triangle Guard
- TOP / RIGHT / LEFT 三向 Guard silhouette 規格
- 手肘內收、縮小胸腹空隙與前向威脅感
- Directional additive bone layer 與 blend 規則
- Action Studio Directional Guard Lab V1 UI / debug visuals
- Guard Enter / Hold / Block Hit / Counter presentation chain
- Canonical guard metadata 建議格式
- G1～G5 實作階段與視覺驗收條件
- Authoring presentation 與 authoritative combat 判定邊界

### 08 — G2 Skyrim Guard Visual Retarget Probe
`08_skyrim_guard_visual_retarget_probe.md`

內容：
- `shd_blockidle.hkx` 單一 Guard Hold 母姿勢驗證
- HKX + matching Skyrim skeleton 的 offline conversion boundary
- Skyrim humanoid → procedural Blockman semantic bone mapping
- rest-pose delta / axis correction retarget strategy
- 30 fps in-place GLB bake 規格
- shield-oriented 左臂的 correction-cost 判定
- Action Studio G2 review mode
- ADOPT / ADOPT WITH CORRECTIONS / REJECT 驗收條件
- G2.1～G2.5 decode、mapping、bake、visual review、decision record
- 通過後才進 G3 Guard Family 與 G4 三向 Triangle Guard additive authoring

### 09 — G2.1 Skyrim → Action Studio Retarget Adapter
`09_skyrim_action_studio_retarget_adapter.md`

內容：
- Action Studio Blockman rig 作為 canonical target skeleton
- 19 個 Skyrim humanoid semantic bone mappings
- bracketed Skyrim bone names 與 exporter alias resolution
- decoder-independent `{ root, clip }` / `{ scene, animations }` contract
- world-space rest-pose delta → target-local quaternion bake
- root / pelvis translation scale policy
- 30 fps `THREE.AnimationClip` runtime output
- G2.2 decoder bridge 與 `shd_blockidle` first bake 接口

### 10 — G2.2 Skyrim HKX Decoder Bridge
`10_skyrim_hkx_decoder_bridge.md`

內容：
- `shd_blockidle.hkx` 真實檔案 marker / SHA-256 probe record
- `npm run probe:skyrim-hkx -- <file.hkx>` raw source gate
- Havok decoder 與遊戲 runtime 的 dependency boundary
- self-contained Skyrim source GLB contract
- `assets/skyrim/guard/converted/shd_blockidle.source.glb` canonical bridge slot
- Action Studio `Skyrim Guard Probe` external source
- 本機 `Import converted Skyrim GLB` 實驗入口
- GLB sanitized Skyrim bone aliases
- G2.2 engineering completion checklist 與 G2.3 first visual bake gate

### 11 — G2.3 First Real Bake + Visual Guard Review
`11_skyrim_guard_first_real_bake_review.md`

內容：
- PyNifly / Blender Skyrim LE source-bake contract
- `skeleton.hkx` 作為 source-side bone-order / rest-pose dependency
- `shd_blockidle.source.glb` 真實 source bridge 輸出規格
- `skyrim-guard-visual-review.html` 專用 review lab
- Front / Side / 3/4、Once / Loop / scrub 視覺檢查
- start/end major-bone rotation 與 root/pelvis translation seam metric
- pelvis/foot、torso、weapon arm、off-hand、loop 五項 visual gates
- ADOPT / ADOPT WITH CORRECTIONS / REJECT 決策規則
- `.gitignore` Skyrim raw/experimental asset 邊界

### 12 — G2.3.1 Real HKX Decode / First Source Bake
`12_skyrim_real_hkx_decode_first_source_bake.md`

內容：
- 真實 `skeleton.hkx` + `shd_blockidle.hkx` pair validation
- 兩支實際輸入的 SHA-256 / size / Havok generation manifest
- 19/19 Skyrim source semantic bone gate
- `npm run validate:skyrim-bake-pair -- <skeleton> <animation>`
- Blender + PyNifly first real source-bake workflow
- hkxcmd KF fallback boundary
- self-contained `shd_blockidle.source.glb` output contract
- `npm run validate:skyrim-source-glb -- <source.glb>`
- 禁止在 Blender 預先 retarget 到 Blockman；G2.1 為唯一 canonical retarget stage
- current execution container 無 Havok decoder 時的 truthful boundary
- G2.3.2 First Real Visual Decision 完成條件

### 13 - G2.3.2 Real Source Bake Execution Record
`13_skyrim_guard_g2_3_2_execution_record.md`

Contents:
- real 30 fps HavokToolset `hk_to_gltf` conversion record
- `shd_blockidle.source.glb` SHA-256, size, and validator result
- G2.1 canonical Blockman retarget runtime probe
- loop-seam engineering metric
- Front / 3-quarter / Side / Back review support
- Windows browser sandbox blocker and truthful `PENDING` visual decision

### 14 — G2.4 Skyrim Retarget Correctness & Root Motion Fix
`14_skyrim_guard_g2_4_root_motion_fix.md`

內容：
- 修正 Skyrim / Action Studio 跨單位 translation scale，不再把約 `0.01` 的合理比例夾成 `0.5`
- 將 root motion 與 pelvis root-relative body motion 分離，避免 world-space 位移重複套用
- 保留 `inPlace` 下的 pelvis 重心微移，同時只移除真正 root locomotion
- 新增整段 max excursion / max step translation diagnostics
- 新增「中途飛走但首尾相同」regression test
- PR #13 CI engineering validation result
- 明確保留 99 animated nodes → 19 semantic bones 的 fidelity follow-up 邊界
- G2.4.1 canonical GLB visual playback acceptance gate

### 15 — G2.4.1 Canonical GLB Visual Playback Verification
`15_skyrim_guard_g2_4_1_canonical_visual_verification.md`

內容：
- GitHub Actions headless Chrome 直接載入 canonical `shd_blockidle.source.glb`
- 1201-frame target-rig in-place runtime probe
- root max excursion `0.0000`、hips max excursion `0.0145`，確認飛走問題已修復
- loop seam engineering result GOOD
- 0 / 25 / 50 / 75 / 99.8% timeline screenshots
- Front / 3-quarter / Side / Back visual evidence
- G2.4.1 overall visual acceptance = **FAIL**
- 確認 global Skyrim → Action Studio coordinate-basis mismatch 仍未修正
- 下一階段：G2.4.2 Skyrim Coordinate Basis Calibration

---

## 建議開發階段

### Phase 1 — Combat Lab
- 1 Player
- 1 Dummy
- Lock-on
- Strafe
- Attack
- Guard
- Parry
- Dodge
- Hit Feel

### Phase 2 — 1v1 Bot
- 基礎 AI
- 攻防節奏
- Parry / Dodge 測試
- 武器差異驗證

### Phase 3 — 4 Bots Free For All
- 多目標鎖定
- 切換 Target
- 被圍攻問題
- Camera 壓力測試

### Phase 4 — Battle Royale Loop
- 8 Players / Bots
- Shrinking Zone
- Elimination
- Final Duel
- Match Result

### Phase 5 — Network Multiplayer
- Authoritative Server
- Colyseus Rooms
- WebSocket
- 1v1 Online
- 8 Player Match

### Phase 6 — SRE / Production
- Redis
- PostgreSQL
- Metrics
- Logging
- Tracing
- CI/CD
- Autoscaling
- Graceful Drain
- Load Test

---

## 核心產品原則

1. 戰鬥手感優先於畫質。
2. 武器差異優先於數值成長。
3. 技巧勝負優先於裝備碾壓。
4. Battle Royale 只負責逼玩家交戰。
5. Final Duel 應成為每局的高潮。
6. 第一版先證明「打 Dummy 都很好玩」，再做多人。
7. 網路與 SRE 架構採漸進式加入，不做過度設計。
