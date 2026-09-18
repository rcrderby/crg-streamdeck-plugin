/**
 * The Automation key, and the page of CRG automation settings it opens.
 *
 * Auto End Jams and Auto End Team Timeouts switch CRG's global settings,
 * the ones CRG's own Automation dialog switches, rather than any
 * operator's stored defaults. Each flips with a press and shows the top
 * bar while its setting is on.
 */

import { type KeyDownEvent } from '@elgato/streamdeck';

import { AUTOMATION_SETTINGS } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { type AutomationSetting, automationKey, automationToggleKey } from '../render/designs.ts';
import { CrgKeyAction } from './key-action.ts';
import { openPage } from './navigation.ts';

export class Automation extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  /** Shows nothing from CRG, so there is nothing to veil. */
  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return automationKey();
  }

  override async onKeyDown(event: KeyDownEvent): Promise<void> {
    await openPage(event.action, 'automation');
  }
}

abstract class AutomationToggle extends CrgKeyAction {
  protected abstract get setting(): AutomationSetting;

  protected override watchedPaths(): readonly string[] {
    return [AUTOMATION_SETTINGS[this.setting]];
  }

  protected override describe(): KeySpec {
    return automationToggleKey(this.setting, this.#on());
  }

  /** Writes the text CRG keeps for a setting, as its own Automation dialog does. */
  override onKeyDown(): void {
    this.context.client.set(AUTOMATION_SETTINGS[this.setting], this.#on() ? 'false' : 'true');
  }

  #on(): boolean {
    return this.context.client.state.getBoolean(AUTOMATION_SETTINGS[this.setting]);
  }
}

export class AutoEndJams extends AutomationToggle {
  protected override get setting(): AutomationSetting {
    return 'endJams';
  }
}

export class AutoEndTeamTimeouts extends AutomationToggle {
  protected override get setting(): AutomationSetting {
    return 'endTeamTimeouts';
  }
}
