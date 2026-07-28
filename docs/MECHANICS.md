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
attention: what he can properly attend to. **How many he has is his health**
(§10) — fourteen when he is well, eleven when he is not.

### Costs

| Act | Days | Note |
|---|---|---|
| Dispose of a paper with a stamp | **1** | the floor: any paper, any stamp |
| Hear a case, receive a deputation | **2** | offered by some papers |
| Sit with the accounts, do the work | **2** | the papers that want real work (§9) |
| Ride out to a village | **4** | once a fortnight only |
| Close a file unread | **1** | you still have to find it and bin it |
| Delegate a stack | **0** | costs control, not time |
| Tour, planned on the map | **6–11** | as routed |

### Supply

**Many cheap papers, not few expensive ones.** The pressure is volume: you
cannot touch them all, and choosing what to ignore is the decision. It also
keeps every paper short and the tape readable at a glance.

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
> tape should cost **70–100 % of the available days** in the cold weather and
> **95–115 % in the monsoon**. Anything below 70 % and the game is a to-do list.

Note "available", not fourteen. A worn officer has eleven, and the same tape
becomes unclearable — which is the intended shape, and also the compounding
risk named in §10.

### The clock

The fortnight ends **automatically when the days run out**. There is no closing
it early: the calendar is simply true, and the last day is spent on something.

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

**Escalation** is the point. At age 3 the paper leaves the tape and comes back
as an **interrupting telegram** (§8): the Division has noticed. It takes the
blotter mid-fortnight, cannot be put back, and names the delay — the Sirsa
petition becomes a deputation already at the gate; the revenue return becomes an
audit ordered; the anonymous letter becomes a formal complaint referred down for
explanation.

Bad news arriving suddenly and from above is how bad news actually arrives, and
it means neglect cannot simply be deferred a second time. The player can trace
the chain back and see that it was his — which is the difference between a
consequence and a punishment.

**Ceiling.** The tape holds **18**. Beyond that, arriving papers displace the
oldest, which escalate immediately. The pile cannot grow without limit, and
falling behind has a floor as well as a cost.

---

## 4. Delegation

Costs nothing in days. **You choose which three papers go**, and to whom.

That pairing is the whole of it: handing the Deoganj papers to the man from
Deoganj is a different act from handing him the Club's letter. You are deciding
what is safe to lose sight of, and in whose hands.

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

## 6. Money — the district fund

A real balance, refilled each season. Sanctioning draws on it.

Without it `SANCTIONED` costs a day like anything else and is strictly better
than refusing, which makes half the rack a dominant strategy and the well at
Sirsa free. With it, approving the well is a choice against the road that also
needs metalling.

- The fund is **stated on the paper** that asks for money, so the price is
  known before the stamp comes down.
- It does **not** carry between seasons: an unspent fund is a district that went
  without, and the Division notices that too.
- Running it dry does not end the chapter; it removes an option, which is worse.

## 7. The meters are Simla's opinion

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

## 8. Interrupts

Telegrams do not hang on the tape.

- **0–2 a fortnight**, likelier as the district's true state worsens.
- They arrive between disposals, take the blotter, and cannot be put back.
- They cost 1 day like anything else, but the choice is made on what is known
  *now*.

> **Constraint:** an interrupt must never be the only route to a good outcome.
> It raises the price of not knowing; it does not punish the player for not
> having ridden out.

---

## 9. Papers that want work

Perhaps one in eight. A column that will not add, an account with a sum hidden
in it, two reports of the same night that cannot both be true. Costs 2 days.

**The rule, restated because it is the easiest one to lose:** the work is
genuine and the finding is real, but **finding it never settles the question.**
You learn there is 400 rupees unaccounted for. Whether that is theft,
incompetence or a clerk copying badly is still yours to judge, and the paper
will not tell you. It buys a better guess, never an answer.

---

## 10. Health, and the days it buys

Health is not a threshold. **It is how many days you get.**

| Health | Days a fortnight |
|---|---|
| Sound | 14 |
| Worn | 13 |
| Poor | 12 |
| Bad | 11 |

Riding out, touring, the hot weather and the monsoon wear it down. The hill
station, a quiet fortnight and the cold weather restore it.

This makes it the resource behind the resource, and the breakdown ending arrives
as a slow squeeze rather than a line crossed. It also creates the **compounding
risk the simulation must watch**: poor health gives fewer days, fewer days mean
more decay, more decay means more interrupts and less time still. The `dugOut`
probe has to be run against a *worn* officer, not a sound one, or it proves
nothing.

## 11. The reckoning: the despatch you sent

At the fortnight's close the player reads **the fortnightly return as Simla
receives it** — collections reported, order reported, the district as his own
paperwork describes it. The meters move from that and from nothing else.

He is reading his own account of himself. Where it differs from what he saw on
tour, he is the only man who knows.

No summary of what was left hanging, and no scoring of his choices: the
consequences arrive as papers, and the ledger is opinion rather than a verdict.

## 12. Belief, pencilled on the map

The officer's belief about each tehsil is written on his own map: a figure, a
date, and a hand that fades. Where he has been recently it is firm; where he has
not, it greys and the date recedes.

Belief is set by what the papers report, and **replaced by the truth for any
tehsil he tours**. It then decays back toward the reported figures over the
following fortnights.

This is the fog of war made legible: the player can see which corner of his
district he is guessing about, which is what makes the decision to ride out
concrete rather than abstract.

## 13. Endings

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

## 14. What the simulation must prove

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

## 15. Still to decide

- **Carry between chapters.** What a Commissioner inherits from his district
  year beyond the honour — standing with particular men, a reputation for
  touring, the state he left the district in.
- **How many tehsils.** Four in the prototype, six on the engraved plate. Six
  gives the map more to say and the hidden model more to do; four is easier to
  hold in the head.
- **Whether the fund is one number or several heads.** A single district fund is
  legible; separate heads for works, relief and establishment are period-exact
  and turn allocation into its own decision.
