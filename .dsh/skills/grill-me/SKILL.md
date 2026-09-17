---
name: grill-me
description: A relentless interview to sharpen a plan or design.
disable-model-invocation: true
---

Call the Skill tool with "grilling", then run that interview exactly as written.

This is the user-invoked front door. It works on anything — code, product, writing, a business call — needs no repo, and writes no files: the only thing it leaves behind is a sharper idea in the user's own head.

Two behaviours hold for the whole session:

- **Questions arrive as DSH question cards.** Each round is one `ask_user_question` call carrying the whole frontier: a stable `id` and short `header` per decision, the recommended option first and suffixed `(Recommended)` — `（推荐）` in a Chinese conversation — with a one-sentence tradeoff on every option. The user can always type their own answer instead of picking one. Never restate options in prose, and never ask in a plain numbered list unless the card tool is missing.
- **Facts stay your job, and the document check happens before you act.** Look up the files, documents, configs and history yourself before spending a card on them, and re-read the documents a settled decision touches before acting on it — report a contradiction instead of building on a stale answer.

Stop when the frontier is empty and the user confirms you share an understanding; keep the same conversation if it goes on to a spec or an implementation.
