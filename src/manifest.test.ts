import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

type ManifestAction = { UUID: string; Name: string; Tooltip?: string; PropertyInspectorPath?: string };

type Description = { summary: string; details?: string[] };

type FakeElement = { className: string; textContent: string; children: FakeElement[] };

const manifest = JSON.parse(readFileSync(new URL('manifest.json', PLUGIN), 'utf8')) as { Actions: ManifestAction[] };

const descriptionsScript = readFileSync(new URL('ui/descriptions.js', PLUGIN), 'utf8');

function streamDeckClient(getConnectionInfo: () => Promise<unknown>): unknown {
  return { SDPIComponents: { streamDeckClient: { getConnectionInfo } } };
}

/** The descriptions ui/descriptions.js defines. */
function descriptions(): Record<string, Description> {
  const context: Record<string, unknown> = { window: streamDeckClient(() => new Promise(() => undefined)) };

  runInNewContext(`${descriptionsScript}\nglobalThis.descriptions = DESCRIPTIONS;`, context);

  return context['descriptions'] as Record<string, Description>;
}

function fakeElement(): FakeElement & { replaceChildren: (...children: FakeElement[]) => void } {
  const element = {
    className: '',
    textContent: '',
    children: [] as FakeElement[],
    replaceChildren: (...children: FakeElement[]) => {
      element.children = children;
    }
  };

  return element;
}

/** Runs ui/descriptions.js on a stand-in page for one action, and returns the lines it shows. */
async function shownLines(uuid: string): Promise<string[]> {
  const target = fakeElement();

  runInNewContext(descriptionsScript, {
    window: streamDeckClient(async () => ({ actionInfo: { action: uuid } })),
    document: {
      getElementById: (id: string) => (id === 'description' ? target : null),
      createElement: () => fakeElement(),
      head: { append: () => undefined }
    }
  });

  await setImmediate();

  return target.children.map((child) => `${child.className}: ${child.textContent}`);
}

describe('manifest actions', () => {
  it('each have a property inspector that shows a description', () => {
    for (const action of manifest.Actions) {
      assert.ok(action.PropertyInspectorPath, action.Name);

      const page = readFileSync(new URL(action.PropertyInspectorPath, PLUGIN), 'utf8');

      assert.match(page, /<div id="description"><\/div>/, action.Name);
      assert.match(page, /<script src="descriptions\.js"><\/script>/, action.Name);
    }
  });

  it('each have a description whose lines are sentences', () => {
    const all = descriptions();

    for (const action of manifest.Actions) {
      const description = all[action.UUID];

      assert.ok(description, action.Name);

      for (const sentence of [description.summary, ...(description.details ?? [])]) {
        assert.match(sentence, /^\S.*[.]$/, `${action.Name}: ${sentence}`);
        assert.doesNotMatch(sentence, / {2}/, `${action.Name}: ${sentence}`);
      }
    }
  });

  it('show the summary, then each detail on its own line', async () => {
    const all = descriptions();

    for (const action of manifest.Actions) {
      const description = all[action.UUID] as Description;

      assert.deepEqual(
        await shownLines(action.UUID),
        [`summary: ${description.summary}`, ...(description.details ?? []).map((detail) => `detail: ${detail}`)],
        action.Name
      );
    }
  });

  it('carry their description as one line in the tooltip, as the build writes it', () => {
    const all = descriptions();

    for (const action of manifest.Actions) {
      const description = all[action.UUID] as Description;

      assert.equal(
        action.Tooltip,
        [description.summary, ...(description.details ?? [])].join(' '),
        `${action.Name}: run npm run build to rewrite the tooltips from ui/descriptions.js`
      );
    }
  });
});
