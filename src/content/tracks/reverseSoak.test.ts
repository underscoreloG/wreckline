import { beforeAll, describe } from 'vitest';
import { initPhysics } from '../../sim/index';
import { REVERSED_TRACKS } from './index';
import { trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

// The 16-seed soak of the last five reversed layouts (WP39), split from reverse.test.ts so the two run in parallel.
for (const rev of Object.values(REVERSED_TRACKS).slice(5)) {
  describe(rev.id, () => {
    trackContentTests(rev, null, [], 'WP39');
  });
}
