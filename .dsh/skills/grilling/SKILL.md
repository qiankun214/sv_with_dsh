---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the answers before the next round.

## Ask each round as one DSH question card

Put the **entire frontier into a single `ask_user_question` call** — the card pages through the questions one at a time, so a long frontier is fine. Never drip one call per question, and never dump numbered questions into chat prose.

Map each frontier decision onto one entry of `questions`:

- `id` — a short stable slug (`scope`, `storage-format`), so answers stay traceable across rounds.
- `header` — 2–5 words naming the decision.
- `question` — the whole question body: context, the tradeoff, what hangs on the answer. The card renders it as the title, so it must read as a question.
- `options` — 2–4 candidate answers, best first. End **exactly one** label with `(Recommended)` — or `（推荐）` in a Chinese conversation — and the card turns it into a badge. Give each option a one-sentence `description` covering its tradeoff.
- `multi_select: true` only when several answers can hold at once ("which risks matter"); otherwise omit it.

Never add an "Other" option: every card already accepts a typed answer ("输入你的答案"). Omit `options` altogether only when the answer space genuinely is not enumerable — that costs you your recommendation, so use it sparingly.

Do not restate the options in prose; the card carries them. Keep your message to a single line of framing, or nothing at all. The call blocks until the user answers — that wait **is** the round boundary. Answers return as `{answers: [{id, selected: [...], custom?}]}`; a non-empty `custom` is the user's own words and outranks `selected`.

If the host has no `ask_user_question` tool, fall back to numbered prose rounds with your recommended answer under each question.

## Facts are yours; decisions are theirs

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment — filesystem, documents, specs, config, git history, the web — check it yourself **before** you ask, and dispatch a sub-agent for slow exploration (a sub-agent cannot ask the human, so it must return facts). Anything you could look up is a question that must never reach a card.

Keep that document check as a standing habit, not a one-off: re-read the documents and code a settled decision touches **before acting on it**, and report a contradiction rather than quietly building on a stale answer.

Don't block on exploration: a running lookup is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

Each round of answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round — a question whose answer depends on another question still open belongs to a _later_ round, not this one.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
