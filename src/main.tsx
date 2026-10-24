import { mountAudioHarness } from './audio/harness';
import { mountDebug2dHarness } from './debug/harness';
import { startGame } from './game';
import { mountInputHarness } from './input/harness';
import { mountRenderHarness } from './render/harness';
import { mountUiHarness } from './ui/harness';

// Query-param routing (SPEC.md section 4). WP08 takes this file over in wave B.
const params = new URLSearchParams(window.location.search);
const root = document.getElementById('app');
if (!root) throw new Error('missing #app');

const fail = (err: unknown): void => {
  console.error(err);
  root.textContent = `Boot failed: ${err instanceof Error ? err.message : String(err)}`;
};

switch (params.get('harness')) {
  case 'debug2d':
    mountDebug2dHarness(root, params).catch(fail);
    break;
  case 'render':
    mountRenderHarness(root);
    break;
  case 'ui':
    mountUiHarness(root);
    break;
  case 'audio':
    mountAudioHarness(root);
    break;
  case 'input':
    mountInputHarness(root);
    break;
  default:
    startGame(root).catch(fail);
}
