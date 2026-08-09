# Translation Lookup Diagnostic

## Scope

This diagnostic investigates why Evaluation Round 1 could not resolve:

```text
bible_translations.code = "sw-biblica"
```

No production code, Speech Engine code, Synchronization Engine code, Bible Index Engine code, Universal Audio Platform code, Evaluation Lab code, or Benchmark Runner code was modified.

## Root Cause

`sw-biblica` exists in the configured Supabase database, but the benchmark process loaded the anon key from `.env.local`, not an evaluation-only service-role key.

The audio environment loader checks env files in this order:

1. `supabase/audio/.env`
2. `.env.local`
3. `.env`
4. `.env.staging.local`
5. `.env.staging`

Because `.env.local` exists, loading stops there. `.env.local` contains only Vite Supabase values, so the loader maps:

```text
VITE_SUPABASE_ANON_KEY -> SUPABASE_ANON_KEY
```

The production text provider then uses the anon key. Current RLS grants Bible table reads to `authenticated`, not `anon`, so `bible_translations` returns zero rows to the benchmark. The provider reports:

```text
Bible translation 'sw-biblica' was not found.
Available translations:
- none
```

## Database Findings

The locally configured production/staging env files point at the same Supabase project ref:

```text
nunfrjcuimaytydnaqtt
```

No separate production project ref was found in the local env files inspected.

### Available Translation Codes

Using a service-role key outside frontend/Vite env files, `bible_translations` currently contains:

| Code | Name | Language | Active |
| --- | --- | --- | --- |
| `sw-biblica` | Biblica Toleo Wazi Neno | `sw` | true |

Using the anon key loaded by the benchmark from `.env.local`, `bible_translations` returns:

```text
[]
```

### Does `sw-biblica` Exist?

Yes. It exists in the configured remote database:

```text
code = sw-biblica
name = Biblica Toleo Wazi Neno
language_code = sw
is_active = true
```

## Benchmark Corpus Verification

The fixed benchmark corpus is valid for `sw-biblica`:

| Chapter | DB Book | Chapter Found | Verse Count |
| --- | --- | --- | ---: |
| Genesis 1 | Mwanzo | yes | 31 |
| Psalm 23 | Zaburi | yes | 6 |
| Matthew 5 | Mathayo | yes | 48 |
| John 3 | Yohana | yes | 36 |
| Romans 8 | Warumi | yes | 39 |

## Provider Logic Findings

`SupabaseBibleProvider._translation()` performs an exact lookup:

```text
bible_translations?select=id,code,name&code=eq.<translation>&limit=1
```

The benchmark configuration sets:

```text
text_provider: supabase
text_provider_options.translation: sw-biblica
```

The lookup logic is correct for the configured database row. The failure occurs before the translation lookup can see that row because the loaded key has no visible rows under current RLS.

## Correct Translation Code

For the current production benchmark target, the correct code is:

```text
sw-biblica
```

Note: the app-facing Bible helper currently declares `PRIMARY_BIBLE_TRANSLATION_CODE = "sw-open-bible"`, and the current published Open Bible seed uses `sw-open-bible`. That code was not present in the queried remote `bible_translations` table. This is a separate app/content metadata mismatch and is not the reason the Round 1 benchmark failed.

## Required Configuration Changes

For evaluation runs to retrieve benchmark text successfully without exposing credentials to the frontend:

1. Store evaluation-only credentials in `evaluation/speech_lab/.env.evaluation`.
2. Ensure the audio pipeline does not stop at an env file containing only `VITE_SUPABASE_ANON_KEY`.
3. Keep `text_provider_options.translation` set to `sw-biblica` for this database.

Acceptable operational fix:

- Load `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `evaluation/speech_lab/.env.evaluation` before initializing evaluation-only Supabase access.

Do not put service-role credentials in `.env.local`, `.env.staging.local`, `supabase/audio/.env`, or any `VITE_*` variable.

Do not change model parameters. Do not evaluate AI models until the text provider can retrieve the five benchmark chapters.

## Conclusion

The translation lookup failed because the benchmark used an anon Supabase key with no RLS visibility into `bible_translations`. The correct Swahili benchmark translation code is `sw-biblica`, and the benchmark corpus exists for that translation.
