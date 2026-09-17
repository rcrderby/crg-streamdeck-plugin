// Draws a switch for each element with a data-setting attribute, and
// keeps it and the action's setting of that name in step.
//
// sdpi-components has no switch, and its checkbox draws inside a shadow
// root a page cannot reach, so the switch is built here.

// Wrapped so its names stay its own. Every property inspector script
// shares one global scope, and a name declared twice stops the second
// script dead before it runs.
(() => {
  const SWITCH_STYLE = `
    .sdpi-switch {
      appearance: none;
      border: none;
      padding: 0;
      width: 40px;
      height: 22px;
      border-radius: 11px;
      background: #4a4a4a;
      position: relative;
      cursor: pointer;
      transition: background 120ms ease-in-out;
    }
    .sdpi-switch[aria-checked='true'] { background: #0079c5; }
    .sdpi-switch::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #d8d8d8;
      transition: transform 120ms ease-in-out;
    }
    .sdpi-switch[aria-checked='true']::after { transform: translateX(18px); }
    .sdpi-switch:focus-visible { outline: 1px solid #0079c5; outline-offset: 2px; }
  `;

  /** Settings and CRG both keep flags as text at times, so both forms read as on. */
  function isOn(value) {
    return value === true || value === 'true';
  }

  /** Draws one switch, and reports its state back to the action's settings when it is used. */
  function connectSwitch(element, client) {
    const name = element.dataset.setting;
    let settings;

    const show = (value) => element.setAttribute('aria-checked', isOn(value) ? 'true' : 'false');

    element.classList.add('sdpi-switch');
    element.setAttribute('role', 'switch');
    element.setAttribute('aria-busy', 'true');
    show(false);

    element.addEventListener('click', () => {
      if (settings === undefined) {
        return;
      }

      const value = element.getAttribute('aria-checked') !== 'true';

      show(value);
      settings = { ...settings, [name]: value };
      void client.setSettings(settings);
    });

    const take = (next) => {
      settings = next;
      show(settings[name]);
      element.setAttribute('aria-busy', 'false');
    };

    void client.getSettings().then((payload) => take(payload?.settings ?? payload ?? {}));

    // The plugin writes CRG's value into the settings when it changes, so
    // an open page follows it rather than showing where it was.
    client.didReceiveSettings?.subscribe((message) => {
      const next = message?.payload?.settings;

      if (next !== undefined && next !== null) {
        take(next);
      }
    });
  }

  const style = document.createElement('style');

  style.textContent = SWITCH_STYLE;
  document.head.append(style);

  for (const element of document.querySelectorAll('[data-setting]')) {
    connectSwitch(element, window.SDPIComponents.streamDeckClient);
  }
})();
