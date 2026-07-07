# Bible Audio & ElevenLabs Architecture

## Status

Bible Audio is implemented as dormant infrastructure for RC-3.0.0. The platform feature key is `bible_audio`, and it is globally disabled by default.

No Bible audio has been generated in this repository. The existing `sw-biblica` translation is not approved for AI audio generation based on repository evidence, so `audio_generation_allowed` defaults to `false`.

## Feature Management

Bible Audio is a platform-managed feature in `platform_features`.

When `bible_audio` is disabled:

- Member Listen/Sikiliza controls are not rendered.
- The browser cannot obtain audio through the Bible reader.
- The `generate-bible-audio` Edge Function rejects generation requests before provider access.
- No ElevenLabs request is made.

The frontend uses `useFeatureAccess()` and `isBibleAudioVisible()` as a presentation gate. The Edge Function repeats the feature check server-side using `platform_features` and `church_features`.

## Translation Eligibility

Bible translation presence, display eligibility, and AI-audio eligibility are separate.

The `bible_translations.audio_generation_allowed` column controls whether a translation may be narrated by AI. `sw-biblica` remains `false` until documented permission exists for AI narration and audio distribution.

## Edge Function

The secure server-side function is:

`supabase/functions/generate-bible-audio/index.ts`

Required request fields:

- `translationId`
- `bookId`
- `chapterNumber`
- `languageCode`

The member must never submit narration text or provider identity. Requests containing `text`, `narrationText`, `verseText`, `voiceId`, or `audioVersion` are rejected. Voice, model, and audio version are owned by server-side configuration.

## Generation Flow

1. Verify POST method.
2. Verify Supabase authentication.
3. Resolve the caller church membership.
4. Verify `bible_audio` is globally enabled and not locked.
5. Verify the church override does not disable or lock Bible Audio.
6. Verify the translation exists and `audio_generation_allowed = true`.
7. Validate book belongs to the requested translation.
8. Validate chapter exists.
9. Apply server-side voice/model/version configuration.
10. Check deterministic cache metadata.
11. Return a signed URL for ready cached audio.
12. Reserve a unique cache row to block duplicate concurrent generation.
13. Retrieve canonical Bible text server-side from `bible_verses`.
14. Call ElevenLabs with server-side secrets and a bounded timeout.
15. Store MP3 in private Supabase Storage.
16. Mark metadata ready and return a signed playback URL.
17. Mark metadata failed when provider/storage/update errors occur.

## ElevenLabs Provider

ElevenLabs is only called from the Edge Function. Required secret:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Optional secret/config:

- `ELEVENLABS_MODEL_ID`, default `eleven_multilingual_v2`
- `BIBLE_AUDIO_VERSION`, default `rc-3.0.0`

These values must be configured as Supabase function secrets. They must never be placed in `VITE_` environment variables or browser code.

## Local Development Secrets

For local Edge Function development, place ElevenLabs configuration in:

`supabase/functions/.env.local`

Required local values:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Optional local values:

- `ELEVENLABS_MODEL_ID`, default `eleven_multilingual_v2`
- `BIBLE_AUDIO_VERSION`, default `rc-3.0.0`

Run the function locally with the Supabase CLI env file flag:

```powershell
supabase functions serve generate-bible-audio --env-file supabase/functions/.env.local
```

Do not put ElevenLabs values in `.env`, `.env.local`, `.env.staging.local`, Netlify frontend variables, or any `VITE_*` variable. The browser must never receive provider credentials.

To rotate local ElevenLabs credentials, replace the values in `supabase/functions/.env.local`, restart the local Supabase function process, and discard the old key in the ElevenLabs dashboard. Do not commit the local file or paste secret values into logs, docs, issues, reports, or test output.

## Cache Architecture

Cache identity is deterministic:

`translationId:bookId:chapterNumber:languageCode:voiceId:audioVersion`

The implementation also includes the provider model in the internal cache key and unique tuple so changing the configured ElevenLabs model invalidates cache safely.

Metadata is stored in `bible_audio_assets`. The table has a unique `cache_key` and a unique tuple over translation, book, chapter, language, voice, audio version, and provider model. Ready cache rows are reused with signed URLs. Fresh pending/generating rows return a duplicate-generation response. Failed rows and stale in-progress rows are retried by updating the existing metadata row.

## Storage

Audio files use the private Supabase Storage bucket:

`bible-audio`

Playback uses signed URLs. Public storage is intentionally avoided because licensing status may vary per translation.

## Member Player

The existing Bible chapter reader renders the player only when:

- `bible_audio` exists and is enabled.
- The selected translation is audio eligible.
- The selected chapter has verses.

Controls include Listen/Sikiliza, Play, Pause, seek/progress, playback speed, previous chapter, next chapter, and optional auto-play next chapter. The layout is mobile-first and uses existing UI primitives.

## Security Controls

- No provider credentials in browser code.
- No service-role key in browser code.
- Auth required for generation.
- Server-side feature check.
- Server-side translation eligibility check.
- Server-side canonical Bible text retrieval.
- Member-supplied narration text rejected.
- Invalid book/chapter rejected.
- Private storage with signed URLs.
- Deterministic cache prevents unnecessary provider spend.

## Cost Controls

- Bible Audio is globally disabled by default.
- Translation eligibility defaults to false.
- Cached audio is reused.
- Duplicate in-flight generation is rejected.
- Member requests cannot choose voice or audio version.
- Failed rows are marked failed instead of remaining indefinitely in progress.
- Future activation should start with a limited translation, voice, and chapter set.

## Future Activation Process

1. Obtain documented permission for AI narration and audio distribution.
2. Add or identify the approved translation.
3. Set `audio_generation_allowed = true` only for that translation.
4. Configure `ELEVENLABS_API_KEY` and optional model secret in Supabase.
5. Deploy the Edge Function.
6. Enable `bible_audio` globally in Super Admin Feature Management.
7. Enable or leave inherited per-church access.
8. Run UAT on a small chapter set.

## UAT Procedure

1. Confirm `bible_audio` disabled: player is absent and Edge Function rejects requests.
2. Confirm `sw-biblica` cannot generate audio.
3. Confirm requests with arbitrary text are rejected.
4. Confirm invalid book and chapter requests are rejected.
5. Enable a licensed test translation only.
6. Request one chapter and confirm ElevenLabs is called once.
7. Request the same chapter again and confirm cached audio is reused.
8. Confirm playback controls work on mobile and desktop.
9. Confirm signed URLs expire and private bucket objects are not public.
10. Confirm Super Admin can disable the feature and immediately block further requests.
