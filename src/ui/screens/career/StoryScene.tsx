import { useEffect, useRef, useState } from 'react';
import { SPEAKERS } from '../../../content/story';
import type { UiState } from '../../../shared/contracts';
import { Keycap } from '../../components/Keycap';
import { useUi } from '../../uiContext';

const CHARS_PER_S = 40;
const TICK_MS = 25;

const storyImageUrl = (image: string): string => `${import.meta.env.BASE_URL}story/${image}.webp`;

/**
 * Career story scene (WP36, story.md section 5): the image on top, the line typing out below. SPACE / Enter / click /
 * gamepad A finishes the line, then shows the next; after the last one it races (or, after the ending, continues).
 * ESC / gamepad B skip the whole scene (App sends 'back'). A missing or loading image leaves the dark background.
 */
export function StoryScene({ state }: { state: UiState }) {
  const ui = useUi();
  const scene = state.story;
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const line = scene?.lines[index] ?? null;
  const full = line?.text.length ?? 0;
  const last = scene === null || index >= scene.lines.length - 1;
  const done = shown >= full;
  const ending = scene?.id === 'beat-ending';

  // Types the line out; a finished line (shown = full) stays finished.
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.min(full, Math.floor(((performance.now() - start) * CHARS_PER_S) / 1000));
      setShown((s) => Math.max(s, n));
      if (n >= full) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [index, full]);

  const advance = (): void => {
    if (!done) return setShown(full);
    if (!last) {
      ui.sound('move');
      setIndex(index + 1);
      setShown(0);
      return;
    }
    ui.sound('confirm');
    ui.dispatch({ type: 'continueStory' });
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => ui.onNav((n) => n === 'confirm' && advanceRef.current()), [ui]);

  const speaker = line ? SPEAKERS[line.speaker] : undefined;
  const pad = state.usingGamepad;
  return (
    <div className="screen story-screen" onClick={() => advanceRef.current()}>
      <div className="story-image">
        {scene && (
          <img
            key={scene.image}
            src={storyImageUrl(scene.image)}
            alt=""
            loading="lazy"
            decoding="async"
            className={loaded ? 'loaded' : undefined}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      <div className="story-panel">
        <div className="story-text">
          {speaker && (
            <span className="story-speaker display" style={{ color: speaker.color }}>
              {speaker.name}
            </span>
          )}
          <p className="story-line">{line?.text.slice(0, shown)}</p>
        </div>
        <div className="story-hints muted">
          {scene === null ? null : done && last ? (
            <span className="key-hint story-go display">
              <Keycap label={pad ? 'A' : 'SPACE'} pad={pad} />
              {ending ? 'to continue' : 'to race'}
            </span>
          ) : (
            <>
              <span className="key-hint">
                <Keycap label={pad ? 'A' : 'SPACE'} pad={pad} />
                NEXT
              </span>
              <span className="key-hint">
                <Keycap label={pad ? 'B' : 'ESC'} pad={pad} />
                SKIP
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
