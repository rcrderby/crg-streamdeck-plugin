// The CRG operator profile the deck keeps its settings under: the name
// wherever a page writes {operator}, and the form that makes a new one.
//
// The dropdown itself is an sdpi-select fed by the plugin, so it is
// styled and stored by the library. This only fills in the name and
// wires the create form. The name is written with textContent, never as
// markup, because it is whatever somebody typed into CRG.

// Wrapped so its names stay its own. Every property inspector script
// shares one global scope, and a name declared twice stops the second
// script dead before it runs.
(() => {
  const client = window.SDPIComponents.streamDeckClient;

  // The profile the plugin makes for itself. src/crg/operators.ts holds
  // the same name, and a test keeps the two together.
  const OWN_PROFILE = 'StreamDeck';

  // CRG replaces these when an operator logs in, so 'Rose City' is kept
  // as 'Rose_City'.
  const REWRITTEN = /[.() ]/g;

  const FORM_STYLE = `
    .operator-row { display: flex; gap: 8px; align-items: center; width: 100%; }
    .operator-row input {
      flex: 1 1 auto;
      min-width: 0;
      box-sizing: border-box;
      height: 24px;
      padding: 0 6px;
      border: 1px solid #3d3d3d;
      border-radius: 3px;
      background: #303030;
      color: #d8d8d8;
      font-family: inherit;
      font-size: 12px;
    }
    .operator-row input:focus { outline: none; border-color: #0079c5; }
    .operator-row sdpi-button { flex: 0 0 auto; white-space: nowrap; }
    #operator-note { margin: 0; font-size: 11px; line-height: 1.4; color: #969696; }
    #operator-note.blocked { color: #d98c8c; }
  `;

  let settings = {};

  /** The profiles CRG holds, without its own default or a blank. */
  function profiles() {
    const held = Array.isArray(settings.operators) ? settings.operators : [];

    return held.filter((name) => typeof name === 'string' && name.trim() !== '' && name !== 'default');
  }

  /** The profile in use, which is the deck's own until somebody picks another. */
  function chosen() {
    const name = typeof settings.operator === 'string' ? settings.operator.trim() : '';

    return name === '' ? OWN_PROFILE : name;
  }

  /** The name CRG will store, which is not always the name typed. */
  function crgName(typed) {
    return typed.trim().replace(REWRITTEN, '_');
  }

  /** Splits each {operator} out of the page once, leaving an italic element to fill. */
  function prepareNames() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found = [];

    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes('{operator}')) {
        found.push(walker.currentNode);
      }
    }

    for (const node of found) {
      const parent = node.parentNode;

      node.nodeValue.split('{operator}').forEach((part, index) => {
        if (index > 0) {
          const name = document.createElement('em');

          name.dataset.operatorName = '';
          parent.insertBefore(name, node);
        }

        parent.insertBefore(document.createTextNode(part), node);
      });

      parent.removeChild(node);
    }
  }

  function showNames() {
    for (const element of document.querySelectorAll('[data-operator-name]')) {
      element.textContent = chosen();
    }
  }

  /** Wires the create form, if this page carries one. */
  function connectForm() {
    const reveal = document.getElementById('operator-reveal');
    const form = document.getElementById('operator-form');
    const field = document.getElementById('operator-name');
    const create = document.getElementById('operator-create');
    const note = document.getElementById('operator-note');

    if (reveal === null || form === null || field === null || create === null || note === null) {
      return undefined;
    }

    /** Create is offered only for a name CRG does not already hold. */
    const check = () => {
      const typed = field.value.trim();
      const name = crgName(typed);
      const taken = name !== '' && profiles().includes(name);

      create.toggleAttribute('disabled', name === '' || taken);
      note.classList.toggle('blocked', taken);
      note.textContent = taken
        ? `CRG already has a profile named ${name}.`
        : name !== '' && name !== typed
          ? `CRG will store this as ${name}.`
          : '';
      note.parentElement.hidden = note.textContent === '';
    };

    reveal.addEventListener('click', () => {
      form.hidden = !form.hidden;
      note.parentElement.hidden = true;

      if (!form.hidden) {
        field.focus();
      }
    });

    field.addEventListener('input', check);
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !create.hasAttribute('disabled')) {
        create.click();
      }
    });

    create.addEventListener('click', () => {
      const name = crgName(field.value);

      if (name === '' || profiles().includes(name)) {
        return;
      }

      client.send('sendToPlugin', { event: 'createOperator', name });
      field.value = '';
      form.hidden = true;
      note.parentElement.hidden = true;
      void client.setGlobalSettings({ ...settings, operator: name });
    });

    check();

    return check;
  }

  const style = document.createElement('style');

  style.textContent = FORM_STYLE;
  document.head.append(style);

  prepareNames();

  const recheck = connectForm();

  function render() {
    showNames();

    if (recheck !== undefined) {
      recheck();
    }
  }

  client.didReceiveGlobalSettings.subscribe((message) => {
    settings = message?.payload?.settings ?? {};
    render();
  });

  void client.getGlobalSettings().then((stored) => {
    settings = stored ?? {};
    render();
  });
})();
