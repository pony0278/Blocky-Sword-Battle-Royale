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
