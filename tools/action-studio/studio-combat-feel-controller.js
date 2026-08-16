const PROFILE_LABELS = Object.freeze({
  light: 'Light Slash',
  heavy: 'Heavy Slash',
  block: 'Block',
  parry: 'Perfect Parry',
});

const PROFILE_VALUES = Object.freeze({
  light: Object.freeze({ hitstop: 0.03, shake: 0.18, knockback: 0.22 }),
  heavy: Object.freeze({ hitstop: 0.065, shake: 0.38, knockback: 0.68 }),
  block: Object.freeze({ hitstop: 0.04, shake: 0.24, knockback: 0.08 }),
  parry: Object.freeze({ hitstop: 0.085, shake: 0.46, knockback: 0.14 }),
});

function updateSlider(id, value, digits = 2, suffix = '') {
  const input = document.getElementById(id);
  const output = document.getElementById(`${id}Value`);
  if (!input || !output) return;
  input.value = String(value);
  output.textContent = `${Number(value).toFixed(digits)}${suffix}`;
}

function applyProfile(slot) {
  const select = document.getElementById(`feelProfile${slot}`);
  const name = select?.value || 'light';
  const values = PROFILE_VALUES[name];
  if (!values) return;
  window.dispatchEvent(new CustomEvent('action-studio-feel-profile', {
    detail: { profile: name },
  }));
  updateSlider('hitstop', values.hitstop, values.hitstop % 0.01 === 0 ? 2 : 3, 's');
  updateSlider('shake', values.shake);
  updateSlider('knockback', values.knockback);
  const status = document.getElementById('feelProfileStatus');
  if (status) status.textContent = `Active ${slot} · ${PROFILE_LABELS[name]} · same animation, different impact response`;
  document.getElementById('feelUseA')?.classList.toggle('on', slot === 'A');
  document.getElementById('feelUseB')?.classList.toggle('on', slot === 'B');
}

function bind() {
  const controls = document.getElementById('feelAbControls');
  if (!controls) return;
  document.getElementById('feelUseA')?.addEventListener('click', () => applyProfile('A'));
  document.getElementById('feelUseB')?.addEventListener('click', () => applyProfile('B'));
  document.getElementById('feelProfileA')?.addEventListener('change', () => {
    if (document.getElementById('feelUseA')?.classList.contains('on')) applyProfile('A');
  });
  document.getElementById('feelProfileB')?.addEventListener('change', () => {
    if (document.getElementById('feelUseB')?.classList.contains('on')) applyProfile('B');
  });
  applyProfile('A');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
else bind();
