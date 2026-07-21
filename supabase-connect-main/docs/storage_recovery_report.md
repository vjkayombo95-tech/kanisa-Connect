# Storage Recovery Report

Generated: 2026-07-11

Scope:
- `supabase-connect-main`
- `supabase/audio/.venv`
- Faster-Whisper caches
- `evaluation/speech_lab`
- temporary benchmark outputs

No files were deleted. Model caches were not removed.

## Summary

| Class | Estimated Size | Notes |
|---|---:|---|
| SAFE_TO_DELETE | 387.52 KB | Rebuildable cache/temp files found in this pass. |
| REGENERATABLE | 12.07 GB | Mostly source audio zip archives, `node_modules`, and the audio Python virtualenv. Delete only after confirming restore path. |
| KEEP | 23.90 GB | Source, extracted audio, benchmark outputs, Golden References, reports, and model caches. |

Immediate low-risk recovery is limited in the current scan. The largest possible recovery comes from regeneratable artifacts, especially original audio zip archives and reinstallable dependency directories. Faster-Whisper caches are classified as KEEP per instruction.

## Classification Rules

| Class | Meaning |
|---|---|
| SAFE_TO_DELETE | Rebuildable cache/temp artifacts such as `__pycache__`, `.pytest_cache`, `.tmp`, `.lock`, `.incomplete`. |
| REGENERATABLE | Can be recreated from dependencies, package managers, or verified source archives. Should not be deleted without confirmation. |
| KEEP | Source data, Golden References, model outputs, reports, production data, extracted audio, Git metadata, and model caches. |

## Largest Directories

| Rank | Size | Class | Path |
|---:|---:|---|---|
| 1 | 32.58 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main` |
| 2 | 27.68 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase` |
| 3 | 22.85 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed` |
| 4 | 22.85 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible` |
| 5 | 22.81 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible` |
| 6 | 22.81 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1` |
| 7 | 13.04 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted` |
| 8 | 9.77 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source` |
| 9 | 4.83 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio` |
| 10 | 4.40 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab` |
| 11 | 4.40 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation` |
| 12 | 4.39 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab\model_cache` |
| 13 | 3.39 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub` |
| 14 | 3.02 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models` |
| 15 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab\model_cache\large-v3` |
| 16 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models\models--Systran--faster-whisper-large-v3` |
| 17 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models\models--Systran--faster-whisper-large-v3\snapshots\edaa852ec7e145841d8ffdb056a99866b5f0a478` |
| 18 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models\models--Systran--faster-whisper-large-v3\snapshots` |
| 19 | 1.81 GB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv` |
| 20 | 1.81 GB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages` |
| 21 | 1.81 GB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib` |
| 22 | 1.51 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab\model_cache\large-v3-turbo` |
| 23 | 1.51 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--deepdml--faster-whisper-large-v3-turbo-ct2` |
| 24 | 1.51 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--deepdml--faster-whisper-large-v3-turbo-ct2\snapshots\4df90f75321148c3a29a9e2351b7ddf8f5b115a8` |
| 25 | 1.51 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--deepdml--faster-whisper-large-v3-turbo-ct2\snapshots` |
| 26 | 1.43 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-medium` |
| 27 | 1.43 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-medium\snapshots\08e178d48790749d25932bbc082711ddcfdfbc4f` |
| 28 | 1.43 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-medium\snapshots` |
| 29 | 1.19 GB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\torch` |
| 30 | 1.11 GB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\torch\lib` |
| 31 | 779.40 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\PSA` |
| 32 | 650.06 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\JER` |
| 33 | 612.28 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\GEN` |
| 34 | 609.84 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\ISA` |
| 35 | 593.17 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\EZK` |
| 36 | 527.72 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\NUM` |
| 37 | 520.38 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\EXO` |
| 38 | 497.93 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\LUK` |
| 39 | 490.28 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\node_modules` |
| 40 | 472.83 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\DEU` |
| 41 | 471.34 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\ACT` |
| 42 | 463.69 MB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-small` |
| 43 | 463.69 MB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-small\snapshots\536b0662742c02347bc0e980a01041f333bce120` |
| 44 | 463.69 MB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-small\snapshots` |
| 45 | 424.52 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\2CH` |
| 46 | 417.32 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\MAT` |
| 47 | 391.45 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\1SA` |
| 48 | 387.04 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\LEV` |
| 49 | 386.74 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\1KI` |
| 50 | 375.49 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\2KI` |

## Largest Files

| Rank | Size | Class | Path |
|---:|---:|---|---|
| 1 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab\model_cache\large-v3\model.bin` |
| 2 | 2.88 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models\models--Systran--faster-whisper-large-v3\snapshots\edaa852ec7e145841d8ffdb056a99866b5f0a478\model.bin` |
| 3 | 1.51 GB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\evaluation\speech_lab\model_cache\large-v3-turbo\model.bin` |
| 4 | 1.51 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--deepdml--faster-whisper-large-v3-turbo-ct2\snapshots\4df90f75321148c3a29a9e2351b7ddf8f5b115a8\model.bin` |
| 5 | 1.42 GB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-medium\snapshots\08e178d48790749d25932bbc082711ddcfdfbc4f\model.bin` |
| 6 | 662.09 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\torch\lib\dnnl.lib` |
| 7 | 561.50 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Zaburi 1.zip` |
| 8 | 509.06 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Jeremiah.zip` |
| 9 | 479.57 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Genesis.zip` |
| 10 | 463.06 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Ezekiel.zip` |
| 11 | 461.15 MB | KEEP | `C:\Users\HP\.cache\huggingface\hub\models--Systran--faster-whisper-small\snapshots\536b0662742c02347bc0e980a01041f333bce120\model.bin` |
| 12 | 435.01 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Isaac.zip` |
| 13 | 420.53 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\numbers.zip` |
| 14 | 407.51 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Exodus.zip` |
| 15 | 332.00 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Chronicles Book 2.zip` |
| 16 | 327.14 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Luke.zip` |
| 17 | 322.88 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Acts.zip` |
| 18 | 318.04 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Deuternomy.zip` |
| 19 | 314.07 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Mathew.zip` |
| 20 | 310.35 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\levictus.zip` |
| 21 | 299.16 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Kings Book 1.zip` |
| 22 | 288.03 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Kings Book 2.zip` |
| 23 | 283.46 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-1sa.zip` |
| 24 | 278.69 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Chronicles book 1.zip` |
| 25 | 250.20 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Samuel Book 2.zip` |
| 26 | 244.08 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\torch\lib\torch_cpu.dll` |
| 27 | 242.29 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-jhn.zip` |
| 28 | 239.32 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\judges.zip` |
| 29 | 233.63 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-job.zip` |
| 30 | 220.55 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Joshua.zip` |
| 31 | 202.27 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-mrk.zip` |
| 32 | 186.95 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Proverbs.zip` |
| 33 | 155.09 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Revelations.zip` |
| 34 | 153.46 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Daniel.zip` |
| 35 | 138.49 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\models\models--Systran--faster-whisper-base\snapshots\ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66\model.bin` |
| 36 | 138.03 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Nehemia.zip` |
| 37 | 126.80 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-1co.zip` |
| 38 | 125.50 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\03fa25b6e0d9432e-rev1-p_01-book-rom.zip` |
| 39 | 102.20 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Ezra.zip` |
| 40 | 96.01 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Hebrews.zip` |
| 41 | 94.48 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Corinthians 2.zip` |
| 42 | 81.63 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Zacharia.zip` |
| 43 | 72.88 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Esther.zip` |
| 44 | 71.85 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Ecclesiastes.zip` |
| 45 | 70.98 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Hosea.zip` |
| 46 | 56.55 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\ctranslate2\ctranslate2.dll` |
| 47 | 55.21 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\audio\.venv\Lib\site-packages\torch\lib\kineto.lib` |
| 48 | 53.61 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Amos.zip` |
| 49 | 44.97 MB | KEEP | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\extracted\PSA\PSA_119.mp3` |
| 50 | 44.73 MB | REGENERATABLE | `C:\Users\HP\Church final version\supabase-connect-main\supabase\seed\bible\audio1\open bible\source\Galatians.zip` |

## Recovery Candidates

1. `supabase/seed/bible/audio1/open bible/source` is `9.77 GB`. These are original zip archives. They are classified as REGENERATABLE because extracted audio exists, but they should only be removed after confirming the archives are backed up or no longer needed.
2. `supabase/audio/.venv` is `1.81 GB`. This is reinstallable, but deleting it will break local evaluation commands until dependencies are reinstalled.
3. `node_modules` is `490.28 MB`. This is reinstallable with the package manager.
4. Faster-Whisper/model caches total several GB, but they are KEEP and were not considered recoverable because the request explicitly says not to remove model caches.

## Notes

- The current scan found very little immediately safe cache space (`387.52 KB`). A previous cleanup dry-run had identified Python cache as a larger target, but this audit now sees only a tiny remaining cache footprint.
- Benchmark outputs, reports, Golden References, and model caches were all classified as KEEP.
- No deletion commands were run.
