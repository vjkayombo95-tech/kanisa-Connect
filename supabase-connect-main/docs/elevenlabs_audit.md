# ElevenLabs Audit

Generated: 2026-07-11

Audit only. No code was modified, no integrations were created, and no files were deleted.

## Executive Summary

Kanisa Connect has a dormant ElevenLabs Bible Audio integration. The integration is implemented as a Supabase Edge Function, database/storage infrastructure, frontend player plumbing, documentation, and tests. It is not currently active by default.

The repository evidence says audio generation is gated by:

- `platform_features.key = 'bible_audio'`, globally disabled by default.
- `bible_translations.audio_generation_allowed`, default `false`.
- Server-side Supabase auth and church membership.
- Server-side ElevenLabs secrets.
- Official Open.Bible audio preference before any AI generation.

No committed evidence shows successful ElevenLabs generation. Existing Swahili Bible MP3s are official Open.Bible extracted files, not ElevenLabs-generated files.

## Files Referencing ElevenLabs

| File | Purpose |
|---|---|
| `supabase/functions/generate-bible-audio/index.ts` | Real server-side ElevenLabs text-to-speech integration. |
| `supabase/migrations/20260706110000_bible_audio_infrastructure.sql` | Bible Audio tables, `bible-audio` bucket, `provider = 'elevenlabs'`, default model, feature flag. |
| `docs/BIBLE_AUDIO_ELEVENLABS.md` | Architecture, security, gating, local secrets, UAT plan. |
| `docs/ENVIRONMENT_SETUP.md` | Documents ElevenLabs function secrets. |
| `src/test/bible-audio.test.ts` | Tests backend gates, provider call ordering, and secret isolation from browser source. |
| `reports/bible/pilot-import-report.json` | Confirms official Open.Bible import and `elevenlabs_invoked = false`. |

Related but not ElevenLabs-specific:

| File | Purpose |
|---|---|
| `src/lib/bible-audio.ts` | Frontend request normalization/cache path helpers; contains placeholder default voice ID `kanisa-default-sw`. |
| `src/components/bible/BibleAudioPlayer.tsx` | Frontend invokes `generate-bible-audio`; browser never sends provider text or voice identity. |
| `scripts/bible/import-open-bible-audio.ts` | Imports official Open.Bible audio; writes `voice_id` metadata for official audio rows. |

## Existing Integration Code

The primary integration is:

`supabase/functions/generate-bible-audio/index.ts`

It:

- Reads `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and optional `ELEVENLABS_MODEL_ID`.
- Rejects member-supplied narration text, voice ID, and audio version.
- Checks feature flags and translation eligibility before provider access.
- Looks for official Open.Bible audio first.
- Builds narration text server-side.
- Calls `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`.
- Requests `output_format=mp3_44100_128`.
- Uploads generated MP3 bytes to private Supabase Storage bucket `bible-audio`.
- Stores metadata in `bible_audio_assets`.

## Expected Environment Variables

Server-side only:

| Variable | Required | Location |
|---|---:|---|
| `ELEVENLABS_API_KEY` | Yes for AI generation | Supabase function secret / `supabase/functions/.env.local` for local function dev |
| `ELEVENLABS_VOICE_ID` | Yes for AI generation | Supabase function secret / `supabase/functions/.env.local` for local function dev |
| `ELEVENLABS_MODEL_ID` | Optional | Defaults to `eleven_multilingual_v2` |
| `BIBLE_AUDIO_VERSION` | Optional | Defaults to function built-in version `rc-3.4.0` |

No committed `.env*` file showed ElevenLabs values in the targeted audit. The docs explicitly warn not to expose these through `VITE_*`.

## Stored Voice IDs

| Value | Location | Meaning |
|---|---|---|
| `kanisa-default-sw` | `src/lib/bible-audio.ts` | Placeholder/default cache-path voice ID used in frontend helper code. Not an ElevenLabs provider voice ID. |
| `ELEVENLABS_VOICE_ID` | `supabase/functions/generate-bible-audio/index.ts`, docs | Real provider voice ID is expected as a server-side secret. No committed value found. |

## Generated Audio Files Found

Large committed/local audio presence was found, but it is official Open.Bible audio, not ElevenLabs output:

| Location | Count | Size | Notes |
|---|---:|---:|---|
| `supabase/seed/bible/audio1/open bible/extracted` | 1189 MP3/WAV files | 13,352.85 MB | Extracted official Open.Bible Swahili Bible chapter audio. |
| `public` | 12 MP3/WAV files | 6.95 MB | Static public audio/media assets. |
| `src` | 524 MP3/WAV files | 4.02 MB | Source-adjacent media/assets. |
| `evaluation/speech_lab/model_outputs` | 49 matches | 3.66 MB | Mostly JSON outputs matched by broad include traversal; not ElevenLabs output. |
| `evaluation/speech_lab/reports` | 90 matches | 0.69 MB | Report artifacts; not ElevenLabs output. |
| `supabase/functions` | 11 matches | 0.06 MB | Function-adjacent files; not evidence of generated ElevenLabs output. |

Known official Swahili Bible audio examples:

- `supabase/seed/bible/audio1/open bible/extracted/GEN/GEN_001.mp3`
- `supabase/seed/bible/audio1/open bible/extracted/PSA/PSA_023.mp3`
- `supabase/seed/bible/audio1/open bible/extracted/MAT/MAT_005.mp3`
- `supabase/seed/bible/audio1/open bible/extracted/JHN/JHN_003.mp3`
- `supabase/seed/bible/audio1/open bible/extracted/ROM/ROM_008.mp3`

The pilot import report confirms these official files were imported/uploaded locally with `elevenlabs_invoked = false`.

## Test Scripts Previously Used

| File | Coverage |
|---|---|
| `src/test/bible-audio.test.ts` | Feature gates, request validation, official-audio preference, cache behavior, provider call ordering, no provider secrets in browser source. |
| `scripts/bible/import-open-bible-audio.ts` | Official Open.Bible audio import workflow, not ElevenLabs generation. |
| `scripts/bible/prepare-open-bible-audio.cjs` | Prepares/extracts official Open.Bible audio. |

## Unfinished Or Dormant Implementation

The ElevenLabs integration is intentionally dormant:

- `bible_audio` feature is inserted disabled by default.
- `sw-biblica` is explicitly set `audio_generation_allowed = false`.
- Docs state no Bible audio has been generated by ElevenLabs in this repository.
- Edge Function requires server-side secrets that are not committed.
- Official Open.Bible audio is preferred before AI cache or generation.

This is not unfinished in the sense of missing code; it is an inactive/gated implementation awaiting permission, configuration, and feature enablement.

## Functional Status

Kanisa Connect already has ElevenLabs integration infrastructure, but audio generation is not currently functional by default.

To become functional, all of these must be true:

1. `generate-bible-audio` is deployed/served.
2. `ELEVENLABS_API_KEY` is configured server-side.
3. `ELEVENLABS_VOICE_ID` is configured server-side.
4. `bible_audio` is enabled in platform features.
5. The church is allowed to use the feature.
6. The selected translation has `audio_generation_allowed = true`.
7. No official Open.Bible audio row is available for the requested chapter, otherwise the function returns official audio before ElevenLabs.

## Previously Generated Swahili Bible Or Prayer Audio

Evidence found:

- Swahili Bible chapter MP3s exist under `supabase/seed/bible/audio1/open bible/extracted`.
- These are official Open.Bible assets, not ElevenLabs-generated assets.
- `reports/bible/pilot-import-report.json` records four official local uploads and explicitly says `elevenlabs_invoked = false`.

No previously generated ElevenLabs Swahili Bible audio was found in committed/local repository artifacts.

No ElevenLabs-generated prayer audio was found in the audit.

## Conclusion

The repository contains a secure, server-side, dormant ElevenLabs Bible Audio integration. It is designed to avoid browser secret exposure, reject arbitrary user text, prefer official Open.Bible audio, and cache generated MP3s in private Supabase Storage.

Current status: integrated but inactive. Existing audio is official Open.Bible audio. There is no evidence that ElevenLabs has generated Bible or prayer audio in this repository.
