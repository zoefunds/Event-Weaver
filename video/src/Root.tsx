import { Composition } from 'remotion';
import { Film } from './Film';
import { FPS, MASTER_DURATION, TEASER_DURATION } from './constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Master"
        component={Film}
        durationInFrames={MASTER_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: 'landscape' as const }}
      />
      <Composition
        id="Vertical"
        component={Film}
        durationInFrames={MASTER_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: 'vertical' as const }}
      />
      <Composition
        id="Square"
        component={Film}
        durationInFrames={MASTER_DURATION}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: 'square' as const }}
      />
      <Composition
        id="Teaser"
        component={Film}
        durationInFrames={TEASER_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: 'landscape' as const, teaser: true }}
      />
    </>
  );
};
