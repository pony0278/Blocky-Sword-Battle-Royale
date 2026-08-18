from pathlib import Path
import re


def patch_template():
    path = Path('tools/action-studio/index.template.html')
    text = path.read_text(encoding='utf-8')
    if 'id="guardRuntimePanel"' in text and 'data-guard-runtime-static="true"' in text:
        return
    old = '''        <div class="button-grid three secondary-row">
          <button data-template="guard">Guard</button>
          <button data-template="parry">Parry</button>
          <button data-template="counter">Counter</button>
        </div>
      </section>'''
    new = '''      </section>

      <section id="guardRuntimePanel" class="panel guard-runtime-panel" data-stage="G3.4" data-guard-runtime-static="true" data-controller-bound="false" data-guard-runtime-button-count="5">
        <div class="panel-title"><span>Guard Runtime · G3.4</span><small>Skyrim Guard ↔ KayKit Counter</small></div>
        <p class="blocking-intro">真正 Guard FSM 預覽。Block / Parry 使用 Skyrim Guard family；Counter 只會在預覽送出 authoritative <b>COUNTER_CONFIRMED</b> 後進入 KayKit <b>Melee_Block_Attack</b>，完成後回到 Skyrim Recover / Hold。</p>
        <div class="button-grid three">
          <button data-guard-runtime="hold">Guard Hold</button>
          <button data-guard-runtime="block">Block Hit</button>
          <button data-guard-runtime="parry">Parry</button>
        </div>
        <div class="button-grid two secondary-row">
          <button data-guard-runtime="perfect">Perfect Parry</button>
          <button data-guard-runtime="counter" class="primary">▶ Counter</button>
        </div>
        <div id="guardRuntimeStatus" class="status-line">G3.4 · assets load on first preview</div>
        <div id="guardRuntimeDetail" class="status-line">Counter = Melee_Block_Attack · presentation never self-confirms combat authority</div>
      </section>'''
    if old not in text:
        raise SystemExit('Expected legacy Phase A Guard/Parry/Counter row was not found')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def patch_controller():
    path = Path('tools/action-studio/studio-guard-runtime-controller.js')
    text = path.read_text(encoding='utf-8')
    if 'function resolveGuardPanel()' not in text:
        replacement = '''const REQUIRED_GUARD_RUNTIME_MODES = Object.freeze(['hold', 'block', 'parry', 'perfect', 'counter']);

function resolveGuardPanel() {
  const panel = document.getElementById('guardRuntimePanel');
  if (!panel) {
    throw new Error('Action Studio Guard Runtime panel must be authored statically in index.template.html');
  }
  const buttons = [...panel.querySelectorAll('[data-guard-runtime]')];
  const modes = buttons.map((button) => button.dataset.guardRuntime);
  const missing = REQUIRED_GUARD_RUNTIME_MODES.filter((mode) => !modes.includes(mode));
  if (buttons.length !== REQUIRED_GUARD_RUNTIME_MODES.length || missing.length) {
    throw new Error(`Static Guard Runtime panel is incomplete: ${missing.join(', ') || `${buttons.length} buttons`}`);
  }
  panel.setAttribute('data-guard-runtime-static', 'true');
  panel.setAttribute('data-controller-bound', 'true');
  panel.setAttribute('data-guard-runtime-button-count', String(buttons.length));
  return panel;
}

function createUnavailableGuardRuntime'''
        text, count = re.subn(
            r"function installGuardPanel\(\) \{.*?\n\}\n\nfunction createUnavailableGuardRuntime",
            replacement,
            text,
            count=1,
            flags=re.S,
        )
        if count != 1:
            raise SystemExit(f'Expected one dynamic Guard panel installer, replaced {count}')
    text = text.replace('const panel = installGuardPanel();', 'const panel = resolveGuardPanel();', 1)
    if 'insertAdjacentHTML' in text:
        raise SystemExit('Dynamic Guard Runtime HTML injection still remains')
    path.write_text(text, encoding='utf-8')


def patch_contract_test():
    path = Path('tests/action-studio-contract.test.js')
    text = path.read_text(encoding='utf-8')
    if "Action Studio authors Guard Runtime statically and binds the real G3.4 controller" in text:
        return
    new_test = r'''test('Action Studio authors Guard Runtime statically and binds the real G3.4 controller', async () => {
  const template = await readFile(new URL('../tools/action-studio/index.template.html', import.meta.url), 'utf8');
  const html = await readFile(new URL('../tools/action-studio/index.html', import.meta.url), 'utf8');
  const externalController = await readFile(new URL('../tools/action-studio/studio-external-animation-controller.js', import.meta.url), 'utf8');
  const guardController = await readFile(new URL('../tools/action-studio/studio-guard-runtime-controller.js', import.meta.url), 'utf8');

  assert.match(externalController, /createStudioGuardRuntimeController/);
  for (const surface of [template, html]) {
    assert.equal((surface.match(/id="guardRuntimePanel"/g) || []).length, 1);
    assert.match(surface, /Guard Runtime · G3\.4/);
    assert.match(surface, /data-guard-runtime-static="true"/);
    assert.match(surface, /data-controller-bound="false"/);
    assert.match(surface, /data-guard-runtime="hold"/);
    assert.match(surface, /data-guard-runtime="block"/);
    assert.match(surface, /data-guard-runtime="parry"/);
    assert.match(surface, /data-guard-runtime="perfect"/);
    assert.match(surface, /data-guard-runtime="counter"/);
    assert.doesNotMatch(surface, /data-template="(?:guard|parry|counter)"/);
  }

  assert.match(guardController, /resolveGuardPanel/);
  assert.match(guardController, /data-controller-bound/);
  assert.match(guardController, /data-guard-runtime-button-count/);
  assert.doesNotMatch(guardController, /insertAdjacentHTML|legacyGuardRow|quickActions\.querySelector/);
  assert.match(guardController, /Melee_Block_Attack/);
  assert.match(guardController, /GUARD_EVENTS\.COUNTER_CONFIRMED/);
  assert.match(guardController, /GUARD_WEAPON_MOUNT_PROFILE_IDS\.KAYKIT_DEFAULT/);
  assert.match(guardController, /GUARD_WEAPON_MOUNT_PROFILE_IDS\.SKYRIM_GUARD/);
  assert.doesNotMatch(guardController, /machine\.send\(GUARD_EVENTS\.COUNTER_COMPLETE/);
});

'''
    text, count = re.subn(
        r"test\('Action Studio exposes the real G3\.4 Guard FSM and Counter in its Guard runtime panel', async \(\) => \{.*?\n\}\);\n\n(?=test\('Three-dependent character modules are importable without gameplay globals')",
        new_test,
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise SystemExit(f'Expected one Guard Runtime contract test, replaced {count}')
    path.write_text(text, encoding='utf-8')


patch_template()
patch_controller()
patch_contract_test()
print('Static Guard Runtime patch applied/current.')
