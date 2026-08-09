# ElevenLabs Swahili Pilot Plan

Generated: 2026-07-11

This plan prepares one controlled ElevenLabs review sample. It does not enable normal Bible Audio generation, does not modify Open.Bible assets, and does not run bulk generation.

## Current Architecture

The existing Bible Audio integration lives in `supabase/functions/generate-bible-audio/index.ts`.

Normal chapter generation expects this request payload:

```json
{
  "translationId": "uuid",
  "bookId": "uuid",
  "chapterNumber": 23,
  "languageCode": "sw"
}
```

Normal member requests must not include `text`, `narrationText`, `verseText`, `voiceId`, or `audioVersion`. The Edge Function retrieves Bible text server-side, applies the server-owned voice/model/version, prefers official Open.Bible audio when available, and only then considers ElevenLabs generation.

Normal output uses:

- Bucket: `bible-audio`
- Path: `{translation}/{language}/{voice}/{version}/{model}/{book}-{chapter}.mp3`
- Metadata table: `public.bible_audio_assets`

Normal authorization checks:

- Supabase authentication required.
- Church membership required.
- `platform_features.key = 'bible_audio'` must be enabled.
- Church feature override must not disable the feature.
- `bible_translations.audio_generation_allowed` must be true.

Duplicate handling:

- Ready official Open.Bible audio is returned before AI generation.
- Ready AI cache rows are reused.
- Pending/generating cache rows block duplicate generation.
- Failed/stale rows may be retried by reservation update.

Error handling:

- Provider/storage/update errors mark active production reservations as failed.
- Provider key values are not returned or logged.

ElevenLabs call:

- Endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- Output format: `mp3_44100_128`
- Model: `ELEVENLABS_MODEL_ID`, default `eleven_multilingual_v2`

## Pilot-Only Mode

Pilot requests use a separate payload:

```json
{
  "pilot": true,
  "testId": "PSA_023_PILOT_001",
  "text": "Bwana ndiye mchungaji wangu...",
  "dryRun": true,
  "confirmBillableGeneration": false
}
```

Pilot constraints:

- Requires `pilot: true`.
- Requires a single supplied `text` value.
- Maximum text length: 500 characters.
- Rejects `translationId`, `bookId`, `chapterNumber`, `verse`, and `verses`.
- Requires authenticated Super Admin, or local invocation with `ELEVENLABS_PILOT_LOCAL_TOKEN`.
- Supports dry-run with zero provider requests.
- Actual generation requires `confirmBillableGeneration: true`.
- Writes only to the pilot bucket/path.
- Never writes to `supabase/seed/bible/audio1/open bible/extracted`.
- Never updates production Bible Audio rows.
- Stores a JSON metadata sidecar with provider, redacted voice ID, model ID, character count, version, and timestamp.

Pilot output:

```text
bible-audio-pilot/elevenlabs/{voice_id}/{test_id}.mp3
bible-audio-pilot/elevenlabs/{voice_id}/{test_id}.json
```

For the requested sample:

```text
bible-audio-pilot/elevenlabs/{voice_id}/PSA_023_PILOT_001.mp3
```

## Required Secrets

Configure these only as Supabase function secrets or local function env values:

```text
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
```

Optional:

```text
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
BIBLE_AUDIO_VERSION=rc-3.4.0
ELEVENLABS_PILOT_LOCAL_TOKEN=<local-only random token>
```

Do not put these in `VITE_*` variables or frontend env files.

## Sample File

The pilot text is stored at:

```text
evaluation/speech_lab/elevenlabs_samples/psa_023_pilot.txt
```

Label:

```text
PSA_023_PILOT_001
```

Text:

```text
Bwana ndiye mchungaji wangu, sitapungukiwa na kitu. Katika malisho ya majani mabichi hunilaza, kando ya maji ya utulivu huniongoza.
```

Character count: 131.

## Dry-Run Command

```powershell
python -m evaluation.speech_lab.cli elevenlabs-pilot `
  --test-id PSA_023_PILOT_001 `
  --text-file evaluation/speech_lab/elevenlabs_samples/psa_023_pilot.txt `
  --dry-run
```

Dry-run prints:

- character count
- redacted voice ID
- selected model
- destination bucket and path
- whether output existence was locally checked
- estimated API requests

Dry-run does not call ElevenLabs.

## One-File Generation Command

Run this only after secrets, function deployment/local serving, auth, and pilot bucket setup are complete:

```powershell
python -m evaluation.speech_lab.cli elevenlabs-pilot `
  --test-id PSA_023_PILOT_001 `
  --text-file evaluation/speech_lab/elevenlabs_samples/psa_023_pilot.txt `
  --function-url "http://127.0.0.1:54321/functions/v1/generate-bible-audio" `
  --access-token "<SUPER_ADMIN_ACCESS_TOKEN>" `
  --confirm-billable-generation
```

For local service-token pilot invocation, also pass:

```powershell
  --local-pilot-token "<ELEVENLABS_PILOT_LOCAL_TOKEN>"
```

## Supabase Setup Steps

1. Configure `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` as Edge Function secrets.
2. Optionally configure `ELEVENLABS_MODEL_ID`.
3. Create private Storage bucket `bible-audio-pilot`.
4. Deploy or serve `generate-bible-audio`.
5. Use a Super Admin access token or local pilot token.
6. Run dry-run first.
7. Run exactly one confirmed generation command.

Do not enable `bible_audio` and do not set `sw-biblica.audio_generation_allowed = true` for this pilot.

## Rollback

No production Bible Audio records are changed by pilot mode. Rollback is limited to pilot storage cleanup:

1. Delete `bible-audio-pilot/elevenlabs/{voice_id}/PSA_023_PILOT_001.mp3`.
2. Delete `bible-audio-pilot/elevenlabs/{voice_id}/PSA_023_PILOT_001.json`.
3. Rotate or remove `ELEVENLABS_PILOT_LOCAL_TOKEN` if it was used.
4. Keep `bible_audio` disabled unless a separate release enables it.

## Character Usage Estimate

ElevenLabs billing depends on provider account rules, but this pilot uses the supplied text character count before provider submission. For this sample:

```text
131 characters
1 estimated API request
```

## Safety Confirmation

Normal Bible Audio remains unchanged:

- `bible_audio` remains disabled by default.
- `sw-biblica.audio_generation_allowed` remains false.
- No scheduler or batch generation was added.
- Open.Bible extracted audio remains untouched.
- Pilot output uses `bible-audio-pilot`, not `bible-audio` production cache paths.
