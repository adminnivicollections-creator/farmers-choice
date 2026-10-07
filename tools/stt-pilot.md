# Telugu STT pilot — run this in Phase 1, not Phase 5

The whole voice-post design assumes `te-IN` transcription is good enough on
rural Telangana speech. Nobody has measured that. This measures it.

## Collect
50 real questions, spoken by farmers around Ghatkesar, on their own phones.
Not read from a script — actual questions they would ask.

Save as `samples/<id>.m4a` plus `samples/<id>.txt` holding a human transcript
written by a Telugu speaker.

## Measure
    node tools/stt-pilot.mjs samples/

Reports per-file and mean **word error rate** (WER).

## Decide
| Mean WER | Decision |
|---|---|
| under 15% | Ship transcripts as designed. |
| 15–30%    | Ship, but the transcript is always editable and never auto-posted. |
| over 30%  | Drop transcripts. Ship voice-only posts; revisit with a fine-tuned model. |

A wrong transcript on a crop-disease question is worse than no transcript:
an expert answers the words, not the audio.
