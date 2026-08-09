import { UniversalAudioPlayer } from "./UniversalAudioPlayer";

const DEMO_SOURCE = {
  id: "demo-track",
  title: "Universal Audio Demo",
  subtitle: "Generic player shell for any spoken content",
  src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
  durationSeconds: 2,
  mimeType: "audio/mpeg",
};

export function UniversalAudioPlayerDemo() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <UniversalAudioPlayer source={DEMO_SOURCE} variant="expanded" />
      <UniversalAudioPlayer source={DEMO_SOURCE} variant="mini" />
    </main>
  );
}
