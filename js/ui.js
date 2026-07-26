/*
 * ui.js
 * UIManager — HUD, prompts, reward/win/start screens, and mobile control bindings. No clue-describing text, ever.
 * Depends on: Utils, Textures.
 */
class UIManager{
  constructor(audio){
    this.audio = audio;
    this.el = {};
    ['hud','crosshair','prompt-pill','progress-plaque','progress-num',
     'inspect-banner','position-banner','start-screen','begin-btn','continue-btn','controls-hint',
     'loading-line','reward-modal','reward-seal','reward-eyebrow','reward-name','reward-desc','reward-env',
     'reward-continue-btn','win-screen','win-count','win-time','new-vault-btn','mobile-controls','interact-btn',
     'inspect-btn','drop-btn','reset-btn','mute-btn',
     'settings-modal','settings-fields','settings-begin-btn','settings-randomize-btn','settings-cancel-btn'
    ].forEach(id => { this.el[id] = document.getElementById(id); });

    this.el['reward-continue-btn'].addEventListener('click', () => this._hideReward());
    this.el['mute-btn'].textContent = this.audio.muted ? '\u2715' : '\u266B';
    this.el['mute-btn'].addEventListener('click', () => {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      this.el['mute-btn'].textContent = muted ? '\u2715' : '\u266B';
      this.el['mute-btn'].setAttribute('aria-pressed', String(muted));
    });
  }

  controlsHintText(){
    if(Utils.isTouchDevice()){
      return '<b>Left joystick</b> to move &middot; <b>swipe</b> to look<br><b>Use</b> to interact &middot; <b>Inspect</b> to rotate a held key<br><b>Drop</b> once to aim, again to set it down';
    }
    return '<b>WASD</b> to move &middot; <b>mouse</b> to look<br><b>Click</b> to interact &middot; <b>right-click + drag</b> to inspect<br><b>G</b> once to aim a held key, again to set it down';
  }

  showStart(hasSave){
    this.el['controls-hint'].innerHTML = this.controlsHintText();
    this.el['continue-btn'].classList.toggle('hidden', !hasSave);
    this.el['start-screen'].classList.remove('hidden');
  }
  hideStart(){ this.el['start-screen'].classList.add('hidden'); }
  setLoadingLine(text){ this.el['loading-line'].textContent = text || ''; }

  showHud(){ this.el.hud.classList.add('visible'); }

  setPrompt(text){
    const pill = this.el['prompt-pill'];
    if(text){ pill.innerHTML = text; pill.classList.add('show'); }
    else pill.classList.remove('show');
  }
  setCrosshairHot(hot){ this.el.crosshair.classList.toggle('hot', !!hot); }

  // The physical key visible near the reticle is the only "held key" indicator
  // now — no UI text ever names its colour, symbol, or any other attribute.
  setHeldKey(keyData){ /* intentionally no UI — the world speaks for itself */ }

  setInspecting(on){
    this.el['inspect-banner'].classList.toggle('show', !!on);
    this.el['inspect-btn'].classList.toggle('on', !!on);
  }
  setPositioning(on){
    this.el['position-banner'].classList.toggle('show', !!on);
    this.el['drop-btn'].classList.toggle('on', !!on);
  }

  updateProgress(count, total){
    this.el['progress-num'].textContent = count + ' / ' + total;
  }

  showReward(boxData, queueEntry, onDismiss){
    const r = queueEntry.reward;
    this.el['reward-eyebrow'].textContent = queueEntry.special ? 'A Rare Find' : 'Found Inside';
    this.el['reward-seal'].textContent = r.icon || '\u2726';
    this.el['reward-name'].textContent = r.name;
    this.el['reward-desc'].textContent = r.desc;
    const envEl = this.el['reward-env'];
    if(queueEntry.env){ envEl.textContent = queueEntry.env.label; envEl.classList.remove('hidden'); }
    else { envEl.textContent = ''; envEl.classList.add('hidden'); }
    document.exitPointerLock && document.exitPointerLock();
    this._onRewardDismiss = onDismiss || null;
    this.el['reward-modal'].classList.add('show');
  }
  _hideReward(){
    this.el['reward-modal'].classList.remove('show');
    if(this._onRewardDismiss) this._onRewardDismiss();
  }

  showWin(count, elapsedMs){
    document.exitPointerLock && document.exitPointerLock();
    this.el['win-count'].textContent = String(count);
    this.el['win-time'].textContent = Utils.fmtTime(elapsedMs);
    this.el['win-screen'].classList.remove('hidden');
  }
  hideWin(){ this.el['win-screen'].classList.add('hidden'); }

  enableMobileControls(on){ this.el['mobile-controls'].classList.toggle('active', !!on); }

  bindGameplayButtons(interaction, audio){
    const startInteract = e => { e.preventDefault(); audio.resume(); this.el['interact-btn'].classList.add('hot'); interaction.interact(); };
    const endInteract = () => { this.el['interact-btn'].classList.remove('hot'); };
    this.el['interact-btn'].addEventListener('touchstart', startInteract, { passive:false });
    this.el['interact-btn'].addEventListener('touchend', endInteract);
    this.el['inspect-btn'].addEventListener('touchstart', e => { e.preventDefault(); interaction.toggleInspect(); }, { passive:false });
    this.el['drop-btn'].addEventListener('touchstart', e => { e.preventDefault(); audio.resume(); interaction.toggleDrop(); }, { passive:false });
  }

  // Opening the settings panel *is* the confirmation step — nothing destructive
  // happens until the person explicitly clicks Begin inside it. This also
  // sidesteps native confirm()/alert() dialogs, which some embedding contexts
  // (sandboxed iframes, etc.) can silently suppress.
  bindTopRight(onOpenSettings){
    this.el['reset-btn'].addEventListener('click', onOpenSettings);
  }

  // ---- schema-driven settings panel — add a new field to Generator's
  // SETTINGS_SCHEMA and it renders here automatically, no UI changes needed ----
  renderSettingsFields(schema, values){
    const container = this.el['settings-fields'];
    container.innerHTML = '';
    schema.forEach(field => {
      const row = document.createElement('div');
      row.className = 'setting-row';
      const head = document.createElement('div');
      head.className = 'setting-head';
      const label = document.createElement('label');
      label.textContent = field.label;
      head.appendChild(label);

      if(field.type === 'range'){
        const valueSpan = document.createElement('span');
        valueSpan.className = 'setting-value';
        valueSpan.textContent = values[field.key];
        head.appendChild(valueSpan);
        row.appendChild(head);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = field.min; input.max = field.max; input.step = field.step || 1;
        input.value = values[field.key];
        input.dataset.key = field.key;
        input.addEventListener('input', () => { valueSpan.textContent = input.value; });
        row.appendChild(input);
      } else if(field.type === 'select'){
        row.appendChild(head);
        const select = document.createElement('select');
        select.dataset.key = field.key;
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.label;
          if(opt.value === values[field.key]) o.selected = true;
          select.appendChild(o);
        });
        row.appendChild(select);
      }
      if(field.hint){
        const hint = document.createElement('p');
        hint.className = 'setting-hint';
        hint.textContent = field.hint;
        row.appendChild(hint);
      }
      container.appendChild(row);
    });
  }

  readSettingsValues(schema){
    const container = this.el['settings-fields'];
    const out = {};
    schema.forEach(field => {
      const el = container.querySelector('[data-key="' + field.key + '"]');
      if(!el){ out[field.key] = field.default; return; }
      out[field.key] = field.type === 'range' ? Number(el.value) : el.value;
    });
    return out;
  }

  showSettings(schema, values){
    this.renderSettingsFields(schema, values);
    this.el['settings-modal'].classList.remove('hidden');
  }
  hideSettings(){ this.el['settings-modal'].classList.add('hidden'); }

  bindSettingsButtons({ onBegin, onRandomize, onCancel }){
    this.el['settings-begin-btn'].addEventListener('click', onBegin);
    this.el['settings-randomize-btn'].addEventListener('click', onRandomize);
    this.el['settings-cancel-btn'].addEventListener('click', onCancel);
  }
}
