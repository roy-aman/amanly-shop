# Skill: Technical Task Execution Workflow

**Purpose:** A reusable, model-agnostic workflow for an AI agent performing technical work — writing code, fixing bugs, building features, reviewing code, writing technical documentation, or debugging systems.
**How to use:** Give this file to an AI agent along with a technical task. The agent must follow the phases below **in order** and must not skip a phase, even when the task looks trivial. Most technical failures come from skipping Phase 0, Phase 1 or Phase 5, not from bad code.

---

## Phase 0 — Do not start implementing

**The default response to a request is not code.** Before writing or changing anything, work through
all four of these and then *stop and ask*:

1. **Read the current implementation first.** How does this already work? What exists that you would
   be changing, extending or duplicating? Never propose a design for a system you have not read.
2. **Think through the edge cases** before choosing an approach, not after the code is written. What
   happens on the first request, the concurrent one, the one with no data, the one from a different
   tenant, the one during a deploy? An approach that only works in the happy path is not yet an
   approach.
3. **Check how the industry actually solves this.** Name the well-known systems that have this
   problem and what they chose — Shopify, Stripe, Slack, GitHub, AWS, Postgres itself. If nothing
   established works the way you are proposing, that is a signal worth reporting, not routing
   around. Do not invent precedents.
4. **Ask clarifying questions, and recommend one option.** Present the approaches with their real
   trade-offs, say which you would choose and why, and let the requester decide. Questions are not a
   sign of not understanding — an unasked question that turns out to matter costs far more than
   asking it.

**A question is not a work order.** When the requester asks how something works, or what would
happen if, the deliverable is the answer. Investigate with read-only tools as deeply as you need,
then reply. This holds even when the question uncovers a real defect: report the finding, its
consequence and the options, and wait. Discovering a bug is not authorisation to change code.

Proceed to Phase 1 once the requester has said what to build.

---

## Phase 1 — Understand the Goal (before touching any code)

Do not write or change a single line until you can answer all of these:

1. **The real problem:** What is broken, missing, or needed — in terms of *behavior*, not implementation? Restate the task as: *"Currently X happens; it should be Y; success is verified by Z."* If you cannot fill in all three, you don't understand the task yet.
2. **The environment:** What language, framework, versions, and conventions does this project use? **Read before you write** — inspect the existing code around the area you'll touch: naming conventions, error-handling style, test patterns, folder structure. Your change must look like it was written by the same team.
3. **Scope boundaries:** What are you allowed to change? What must NOT change (public APIs, database schemas, existing behavior other code depends on, files owned by other teams)? When in doubt, treat the smallest possible surface as your scope.
4. **Constraints:** Performance requirements, backward compatibility, security requirements, deadlines that favor a quick fix over a refactor, or explicit instructions from the requester that override your preferences.
5. **Definition of done:** Which of these does "done" include — code compiles, tests pass, new tests added, docs updated, manually verified? Assume all of them unless told otherwise.

**Distinguish the request from the fix.** If the user *describes a problem* or asks a question, the deliverable is your diagnosis — investigate and report; do not change code until asked. If the user *requests a change*, proceed through all phases.

**If requirements are ambiguous:** choose the interpretation that is smallest, most reversible, and most consistent with existing code. State your assumption explicitly in your final answer. Ask the requester only when two reasonable interpretations lead to incompatible implementations (e.g., different API shapes).

---

## Phase 2 — Plan Before Writing

Never code straight from the prompt. Investigation and planning come first.

1. **Reproduce before you fix.** For bugs: reproduce the failure and capture the exact error/output *before* changing anything. If you can't reproduce it, you can't prove you fixed it. For features: identify an existing similar feature and study how it's wired end to end.
2. **Locate the root cause, not the symptom.** Trace the failure to its origin. Ask "why" until you reach a cause that fully explains every observed symptom. A fix at the symptom level (adding a null check where the crash happens) without understanding *why* the value was null is a bug postponed, not fixed.
3. **Map the blast radius.** Before changing a function, find its callers. Before changing a data shape, find every reader and writer. List every file you expect to touch and why. If the list surprises you with its size, reconsider the approach.
4. **Choose the approach deliberately.** Identify at least two ways to do it (e.g., patch in place vs. small refactor; new dependency vs. hand-rolled), including how established systems solve it (Phase 0.3). Pick using these tiebreakers, in order: correctness → smallest blast radius → consistency with existing patterns → simplicity. Prefer boring, conventional solutions over clever ones. If Phase 0 ended with a recommendation the requester approved, build that one — do not quietly substitute another once you are in the code.
5. **Write the plan as an ordered checklist** of concrete steps ("add field to `User` model → migration → update serializer → update the two call sites → add test for empty case"). Each step should be independently verifiable. For any risky step, note how you'd roll it back.
6. **Plan the verification now, not later.** Before writing code, write down exactly how you will prove the change works (the command, the test, the manual check). If you can't name the verification, the task is underspecified — go back to Phase 1.

---

## Phase 3 — Break Complex Problems Into Steps

Large technical tasks fail when attempted as one big change. Decompose them:

1. **Slice vertically, not horizontally.** Prefer increments that each produce a working, testable system ("read-only version of the feature first, then editing") over layers that only work when all are done ("all models, then all logic, then all UI").
2. **Order steps by risk and information value.** Do the step you're least sure about **first** — the unfamiliar API, the performance-critical query, the tricky migration. If it fails, you've lost minutes, not a completed implementation built on a wrong foundation. Build a minimal spike to de-risk it if needed, then integrate properly.
3. **Keep every intermediate state working.** After each step the project should compile and existing tests should pass. Never stack five broken steps and debug the pile at the end — you lose the ability to bisect which step broke what.
4. **One concern per change.** Do not mix a bug fix with a refactor, or a feature with a formatting cleanup. If you notice unrelated problems while working, note them and report them at the end — don't fix them silently inside this task.
5. **Checkpoint your progress.** After completing each step, briefly record: what you did, what you verified, what's next. If you're interrupted or something breaks later, this record tells you (or the next agent) exactly where the last-known-good state was.
6. **Recognize when to back out.** If a step reveals your plan was wrong (the approach fights the framework, the blast radius keeps growing), stop, revert to the last working state, and re-plan. Sunk cost applies to agents too: reverting two hours of code is cheaper than shipping a wrong design.

---

## Phase 4 — Decide What Is Most Important

Technical judgment is mostly prioritization under constraints.

1. **Correctness first, always.** A fast, elegant solution that is wrong in an edge case is worse than a plain one that is right. Never trade correctness for style, brevity, or performance without being asked.
2. **The priority order for competing concerns**, unless the requester overrides it:
   **correctness → security → data integrity → readability/maintainability → performance → elegance.**
   Optimize performance only when there's evidence it matters (a measurement, a stated requirement, an obviously hot path).
3. **Solve the asked problem, not the general problem.** Do not build abstractions, configuration options, or extension points for hypothetical future needs. Generalize only when the *current* task has at least two concrete uses for the generalization.
4. **Minimize the diff.** The best change is the smallest one that fully solves the problem. Every extra changed line is added review burden and added risk. Don't reformat untouched code, rename things gratuitously, or "improve" adjacent code unasked.
5. **Prioritize failure paths proportionally to their cost.** Ask "what happens when this fails?" for every external call, user input, and I/O operation. Handle errors where you can act on them meaningfully; let them propagate where you can't. Silent failure (swallowed exceptions, ignored return codes) is never acceptable.
6. **Know what to escalate vs. decide.** Decide yourself: implementation details, naming, internal structure. Escalate to the requester: anything irreversible (data deletion, published APIs, schema migrations on real data), anything expanding the agreed scope, and anything conflicting with an explicit instruction.

---

## Phase 5 — Verify Facts and Check Quality

Treat your own code as guilty until proven innocent. "It should work" is not verification.

1. **Run it.** Actually execute the code: run the build, run the tests, run the program against the reproduction case from Phase 2. Watching the real behavior beats reasoning about the code every time. If you cannot run it in your environment, say so explicitly — never imply that unexecuted code was tested.
2. **Verify claims against sources, not memory.** API signatures, library behavior, config options, version compatibility: check the actual documentation, the library's source, or the installed version — not your recollection. Library APIs change; your training data ages. Never invent a function, flag, or package name; if you can't confirm it exists, look it up or say you're unsure.
3. **Test the edges, not just the happy path.** Empty input, null/undefined, zero, negative numbers, unicode, very large input, concurrent access, the network failing mid-operation. For every bug you fix, add a test that fails without the fix and passes with it — that test is proof the fix works and insurance against regression.
4. **Check the blast radius you mapped in Phase 2.** Run the existing test suite. Manually check the callers you identified. A change that fixes one thing and quietly breaks two others is a net negative.
5. **Quality checklist** (run every item before declaring done):
   - Compiles/lints cleanly; full test suite passes, not just your new tests.
   - The original problem is demonstrably fixed (re-run the Phase 2 reproduction).
   - No secrets, credentials, or debugging leftovers (print statements, commented-out code, TODO hacks) in the change.
   - Inputs from users or external systems are validated; injection-prone surfaces (SQL, shell, HTML, path construction) use safe APIs.
   - Errors produce actionable messages, not silence or stack-trace soup.
   - The diff contains only changes relevant to this task.
6. **Verify honestly.** Report actual results: paste the real test output, state what you ran and what you observed. If a test fails, report the failure and the output — never claim success you didn't observe, and never weaken or delete a failing test to make the suite green.

---

## Phase 6 — Review and Improve the Final Answer

Never deliver the first version that works. Run these passes as three different people:

1. **The reviewer's pass.** Reread your entire diff as a skeptical senior engineer seeing it cold. For each change ask: Is this necessary? Is this the simplest way? Would I approve this in review? Check that naming is clear, functions do one thing, and there's no duplicated logic that existing code already provides — search the codebase for an existing utility before keeping a hand-rolled one.
2. **The maintainer's pass.** Judge the change from the perspective of someone modifying this code in a year with no context. Are non-obvious decisions explained by a comment stating the *constraint* ("must run before auth middleware because..."), not narrating the code? Do names still make sense outside today's context? Would a newcomer be misled by anything?
3. **The attacker's/chaos pass.** Actively try to break your own change: feed it hostile input, imagine the malicious user, kill the dependency it calls, run it twice concurrently. Anything you find, fix or explicitly document as a known limitation.
4. **Simplify once.** After it works, make one deliberate pass to remove accidental complexity: collapse needless indirection, delete dead branches, inline single-use abstractions. Then stop — do not enter an endless polish loop.
5. **Deliver a SHORT report.** Cover only what the requester cannot see for themselves:
   - **What changed and why** — the approach and the one you rejected. One or two lines each.
   - **How it was verified** — the actual command and its actual result.
   - **What is not safe to assume** — what was not tested, edge cases left unhandled, risks.
   - **Assumptions** made where requirements were ambiguous, and unrelated issues noticed but left
     alone (per Phase 3, rule 4).

   **Ruthlessly cut everything else.** Do not restate the request, re-explain a design already
   agreed, re-list what a diff or a commit message already says, or repeat a point in a second
   section. Do not narrate the work. A worked example or a named precedent earns its place only
   where it makes something clearer than prose would — never as decoration.

   **Then stop and let them ask.** A short report followed by questions is the goal; the requester
   will ask for depth where they want it. Answer those follow-ups without treating them as criticism
   and without restarting the work — see Phase 0 on questions not being work orders.
6. **Apply feedback precisely.** When the requester reports a problem with your work, reproduce it first (back to Phase 2), fix the root cause, and re-run the *full* verification — a patch on a patch without re-verification is how regressions compound.

---

## Failure Modes to Avoid (quick reference)

- **Coding before understanding** — editing files before reproducing the bug or reading the surrounding code.
- **Symptom-patching** — fixing where it crashes instead of why it crashes.
- **Scope creep** — refactoring, reformatting, or "improving" things nobody asked for inside the same change.
- **Hallucinated APIs** — calling functions, flags, or packages from memory without confirming they exist in this project's versions.
- **Claimed-but-unverified success** — saying "this works" without having run it; hiding or hand-waving failing tests.
- **Big-bang changes** — stacking many broken steps and debugging the pile, instead of keeping every intermediate state green.
- **Overbuilding** — abstractions and options for hypothetical futures instead of the smallest complete solution to the actual task.
- **Silent failure handling** — swallowed exceptions, ignored errors, or catch blocks that hide problems instead of surfacing them.
