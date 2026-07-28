# Mechanics — the worked model

`docs/DESIGN-DESK.md` says what the game *is*. This says what the numbers are,
where every value comes from, and what the simulation must prove before any
more interface gets built.

Written because the prototype has no game in it. That is not a figure of
speech — see §1.

---

## 1. The hole: there is currently no triage

Measured off the prototype's own fortnight:

| | |
|---|---|
| Papers on the tape | 8 |
| Days to dispose of every one of them | **8** |
| Days available | **14** |
| Slack left over | **6** |
| Cheapest tour | 2 days |

You can clear the entire tape, ride out, tour, and still have days in hand.
**The central mechanic of the game does not exist.** Everything built so far —
the tape, the rack, the out-tray, the decay — is scaffolding around a decision
the player is never actually forced to make.

Triage only exists when **demand exceeds supply**. That is the first thing the
numbers have to fix, and everything below follows from it.

---

## 2. The day economy

A "day" is not literally a day at the desk. It is a unit of the officer's
attention: what he can properly attend to. Fourteen of them a fortnight.

### Costs

| Act | Days | Note |
|---|---|---|
| Dispose of a paper with a stamp | **1** | the floor: any paper, any stamp |
| Hear a case, receive a deputation | **2** | offered by some papers |
| Sit with the accounts, do the work | **2** | the papers that want real work (§8) |
| Ride out to a village | **4** | once a fortnight only |
| Close a file unread | **1** | you still have to find it and bin it |
| Delegate a stack | **0** | costs control, not time |
| Tour, planned on the map | **6–11** | as routed |

### Supply

**Papers per fortnight: 11 ± 2**, weighted by season:

| Season | Papers | Why |
|---|---|---|
| Cold weather | 9–11 | the year's business, and the road open |
| Hot weather | 11–14 | the courts sit, tempers rise, nobody moves |
| Monsoon | 12–16 | crisis arrives and cannot be reached |

### The arithmetic that makes it a game

Cold weather, 10 papers, all stamped at the floor cost: **10 of 14 days**, 4
left. Enough to hear one case and close one file, or ride out once — **not
both**. Take a tour and you spend 6–11 days, leaving 3–8 for the tape: **you
will leave half the fortnight's business hanging.**

Monsoon, 14 papers: **14 days for 14 papers with nothing left over**, and no
road to take. The season decides the shape of the squeeze.

> **The rule the numbers must satisfy:** the cheapest possible clearance of the
> tape should cost **70–100 % of the budget** in the cold weather and **95–115 %
> in the monsoon**. Anything below 70 % and the game is a to-do list.

**Everything in this section is an assertion until the simulation proves it.**

---

## 3. Decay

A paper left on the tape ages at the close of the fortnight.

| Age | State | Effect |
|---|---|---|
| 0 | fresh | — |
| 1 | yellowed | a small standing penalty while it hangs |
| 2 | curled | penalty doubles; the paper's outcomes worsen |
| 3 | rusted | it **escalates** and leaves the tape |

**Escalation** is the point. At age 3 the paper is removed and replaced by a new
one from the same thread, of a heavier form and from a higher authority: the
Sirsa petition becomes a deputation at the gate; the revenue return becomes an
audit from the Division; the anonymous letter becomes a formal complaint. The
new paper is **worse to answer and more expensive**, and it names the delay.

That is what makes deferral a decision rather than a punishment: the player can
trace the chain and see it was his.

**Ceiling.** The tape holds **18**. Beyond that, arriving papers displace the
oldest, which escalate immediately. The pile cannot grow without limit, and
falling behind has a floor as well as a cost.

---

## 4. Delegation

Costs nothing in days. Hands three papers to a named subordinate; what comes
back depends on standing.

| Standing | Disposal | Truth of what you are told |
|---|---|---|
| Good | as you would have | full |
| Fair | plausible | partial — you are not told how |
| Poor | self-serving | shaded; the district state moves the other way |

Standing is not a number to be farmed: it moves only on decisions that
**touched that man**. Backing a Tahsildar's remission, or overruling him.

> **Constraint:** delegation must never be the dominant strategy. If the
> simulation finds a delegate-everything policy scoring above skilled play, the
> poor-standing penalty is too soft.

---

## 5. The district underneath

Four numbers per tehsil, 0–100, never shown:

| | Moves down when | Moves up when |
|---|---|---|
| **Arrears** | remissions refused, collections forced | remitted, wells dug, works sanctioned |
| **Unrest** | police unchecked, petitions ignored, arrears high | grievances heard, the officer seen |
| **Sickness** | monsoon, standing water, crowding | works sanctioned, relief ordered |
| **Harvest** | drought, flood, sickness high | rain in season, canals maintained |

They drift each fortnight by their own logic, and they decide three things:

1. **What surfaces.** A tehsil with high unrest generates police reports and
   petitions; high arrears generates revenue papers; sickness generates the
   Civil Surgeon.
2. **Who writes it,** and therefore how far it is from the truth.
3. **What the officer finds** when he rides out or tours there.

**Distortion is the mechanism, not noise.** A report's figures are the true
value shifted by the writer's interest and standing. The player never sees the
true value; touring replaces the officer's *belief* with the truth for that
tehsil, and belief decays back toward the reported figures over the following
fortnights.

---

## 6. The meters are Simla's opinion

They are **derived, not awarded**. At the close of each fortnight:

| Meter | Is |
|---|---|
| **Revenue** | what you remitted upward — collections *reported*, not collected |
| **Order** | what the police reported, plus what the Division heard |
| **Prestige** | what the Club and the Division say: promptness, form, the right people |
| **Contentment** | what your own returns claim of the district |
| **Health** | yours. Days ridden, the season, the hours |

The gap between Revenue-as-reported and arrears-as-real is where the game
lives. **A meter must never be moved by a hand-authored delta**; it moves
because something was reported. That is the difference between this and the old
game, and it is what makes the honours ironic rather than merely narrated.

The honours ladder, its weights (`prestige 0.45, revenue 0.2, order 0.2,
contentment 0.15`) and the endings carry over from `src/content.js` unchanged.

---

## 7. Interrupts

Telegrams do not hang on the tape.

- **0–2 a fortnight**, likelier as the district's true state worsens.
- They arrive between disposals, take the blotter, and cannot be put back.
- They cost 1 day like anything else, but the choice is made on what is known
  *now*.

> **Constraint:** an interrupt must never be the only route to a good outcome.
> It raises the price of not knowing; it does not punish the player for not
> having ridden out.

---

## 8. Papers that want work

Perhaps one in eight. A column that will not add, an account with a sum hidden
in it, two reports of the same night that cannot both be true. Costs 2 days.

**The rule, restated because it is the easiest one to lose:** the work is
genuine and the finding is real, but **finding it never settles the question.**
You learn there is 400 rupees unaccounted for. Whether that is theft,
incompetence or a clerk copying badly is still yours to judge, and the paper
will not tell you. It buys a better guess, never an answer.

---

## 9. Endings

Unchanged in kind. At the chapter's close the ladder is scored from the meters
and the honour follows. The collapse endings — scandal, breakdown, riot,
bankruptcy, gone native, transfer — now arise from the model rather than from
authored thresholds:

| Ending | Arises when |
|---|---|
| Riot | unrest passes its ceiling in any tehsil |
| Scandal | Prestige floor, or a delegated fraud surfacing |
| Breakdown | Health floor — riding and hours |
| Bankruptcy | sanctioned works beyond the district fund |
| Transfer | the plain middle: nothing won, nothing lost |

---

## 10. What the simulation must prove

None of the above is settled until the harness says so. Before any more
interface, build the loop headless and assert:

1. **Triage exists** — the cheapest clearance costs 70–100 % of the budget in
   the cold weather, 95–115 % in the monsoon. *This is the one that has already
   failed once.*
2. **The spiral is escapable** — a player two fortnights behind at the end of
   the hot weather can still finish respectably. The `dugOut` probe.
3. **The spiral is real** — an inattentive player does collapse, and not by
   fortnight four.
4. **Delegation is not dominant** — a delegate-everything policy scores below
   skilled play.
5. **Touring pays, but not always** — a tour-heavy policy beats a desk-only one
   on Contentment and loses on Prestige.
6. **No stamp is globally correct** — no single stamp, applied to everything,
   reaches the honours.
7. **The bands hold** — skilled ≥ 50 % honours; random within [2 %, 50 %];
   every ending reachable.

Assertions 1 and 6 are new and they are the ones that decide whether this is a
game. **Build the model, run it, and bring the numbers back before drawing
anything else.**

---

## 11. Still to decide

- **Money.** The old chapter had a treasury and a debt ceiling; this model has
  works being sanctioned with no stated fund. Either the district fund comes
  back as a real constraint, or sanctioning is limited some other way.
- **Whether belief is shown.** The officer's *belief* about a tehsil is modelled
  (§5). Is it ever displayed — as annotations on the map, going stale — or is it
  only ever implicit in what the papers say?
- **How the fortnight ends.** Automatically at day fourteen, or when the player
  declares it done and forfeits the rest?
- **Carry between chapters.** What a Commissioner inherits from his district
  year beyond the honour.
