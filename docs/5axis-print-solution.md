# The 5-axis 3D printing solution — architecture and position

**Status:** position paper, 2026-11-12. Companion to `docs/research-slicer-fork.md`
(fork choice) and concept §3 (the word "slicer"). This is the source the D15 README
architecture note is written from. Public-facing draft at the end (EP 01 / D14).

---

## 1. The constraint: 2D slicing

Every production slicer is built on one construction: the model is cut into **planar
2D polygons along Z**, and **Z is time**. Each layer is a short, bounded, pause-able
unit with a fixed deposition direction (up) and fixed bead geometry (width/height set
by layer height). That construction is why desktop FDM exists at all: it collapses the
entire process — cooling, bonding, sag, overhang — into a handful of per-layer
constants (fan speed, minimum layer time, bridge heuristics). No process planner
needed. The whole stack inherits it: Slic3r → Cura → PrusaSlicer → Orca, every firmware
motion planner, every G-code convention.

## 2. Why the 2D path turns 5-axis into an automation chase — and abandons the hobbyist

Give a slicer architecture a fifth axis and the construction breaks: orientation
becomes a free variable, layers become unbounded continuous streams that cannot be
stopped cleanly, Z stops being time, and the bead cross-section starts varying along
the path. Everything the per-layer trick collapsed comes back as a coupled global
problem — so the research answer is **autonomy**: optimize a support-free orientation
field over the whole volume (S³-Slicer, SIGGRAPH Asia 2022), demo propellers, publish
demo-grade code.

That is a game for deep pockets: industrial R&D, simulation, whole teams. What the
hobbyist and open-source zone inherit is nothing usable: research repos hardcoded to
their own machine kinematics (S4 → Core R-Theta, Open5x → its own gantry), no
post-processor, no controller path, no material model, no tests. The gap between paper
and bench is unfunded — and it is exactly the gap a one-person workshop lives in.

**Conclusion: the constraint is architectural, not mathematical.** Solving 5-axis
*within* the slicer shape is the automation chase. Solving it *around* the machine —
the way 5-axis milling has been solved for forty years — is workshop-sized work.

## 3. The approach: control loops, not layers

The owner's picture: the nozzle held in 3D space by "tentacles", each touching one
quantity in real time. Formalised, the solution is a stack of **coupled control
loops**, and the "slicer" is demoted to what it really is — the thing that writes the
schedule those loops execute.

**Fast loop — the five motion tentacles** (position + orientation, interpolated at a
fixed servo rate):

- X, Y, Z + two rotary axes = a LinuxCNC kinematics module; the motion controller
  (RTAPI) interpolates all five together.
- Realtime step generation is offloaded to the board: **Flexi-HAL** (Expatria
  Technologies, STM32F446) running **Remora**, with the Pi mounted on its GPIO header.
- The **Pi 5 runs LinuxCNC on an RT-patched kernel** — the Flexi-Pi image builds
  exactly that (bcm2712, ARM64; Pi 5 recommended by the Remora Flexi-HAL port).
- This stack is not hypothetical: it is already the workshop's machine platform
  (PLAN D13). The realtime layer the 5-axis printer needs is the realtime layer the
  5-axis mill retrofit needs. One bench, one architecture.

**Process loops — the rest of the tentacles** (slower loops supervising the fast one):

- nozzle and bed temperature, extrusion flow and speed, cooling, heat accumulation
  between passes — HAL components / userspace processes driving and constraining the
  motion schedule.

**The planner** (offline, human-in-the-loop CAM — this replaces the "slicer"):

- The machinist picks the setup and the strategy; the software checks overhang and
  collision, computes paths, inverse kinematics and gcode, and emits a **schedule**:
  path, chosen orientation, feed/flow plan, timing between passes.
- No global optimizer is required to make parts. Autonomy can come later; parts come
  first. Checker rules (overhang angle, max time between passes, min region length)
  play the same role margins play in milling.

**The model** (calibration — the deposition equivalent of feeds-and-speeds):

- Bead width/height vs flow, speed, temperature (and later orientation) measured from
  a few single-wall prints on the bench. The bead is a tool whose diameter varies with
  feed; the table is the material model. Machinist knowledge, tabulated.

**The viewer** (Replay — verification before material is wasted):

- Scrubs the schedule: layers, perimeters, tool orientation, flagged violations. One
  component with the site's Replay (PLAN D17/D18).

## 4. Why this stays hobbyist- and open-source-sized

Every part is a maintainable open artifact on a bench a person can own: LinuxCNC +
Remora + open-hardware Flexi-HAL, a forked ~300 KB Python engine
(`docs/research-slicer-fork.md`), a CLI that writes JSON schedules, a Three.js viewer.
The knowledge gap that makes commercial 5-axis CAM expensive is closed by bench
calibration, which a machinist can do alone. The public word stays "slicer" — it is
the search term and the taunt — but the product is the solution above.

## 5. Falsifiable milestone

**M2: reproduce, automatically, a toolpath the owner already programmed by hand in
5-axis.** When the generator matches the hand output, the process knowledge is in the
software. Build order: M0 spine (done 2026-11-12, `~/Projects/riplay-slicer`) →
M1 rotary on the bench → M2 → M3 viewer (D17/D18) → D21 episode.

---

## 6. Public reflection — draft (EP 01 "Slicer, který neexistuje", for the D14 episode)

> Každej slicer na světě stojí na jednom triku: tiskne se po rovných vrstvách a osa Z
> je zároveň čas. Ten trik vyřešil fyziku za nás — chladnutí, přilnavost i převisy se
> zredukovaly na pár konstant za vrstvu. Proto existuje levnej desktopovej 3D tisk.
>
> Jenže přesně ten trik pětioskej tisk zabíjí. Jakmile se tryska může otáčet,
> orientace je proměnná, vrstvy se stanou jeden dlouhej proud, kterej se nedá bez
> úhony zastavit, a Z přestává být čas. To, co slicer dělal zadarmo, je najednou
> procesní plánování — a to je důvod, proč pořádný open-source pětiosý slicer není.
> Výzkumníci to berou jako autonomii: optimalizace orientace přes celej objem, papíry,
> vrtulka na ukázku. To je hra do hlubokejch kapes. Hobby svět z toho nemá co vzít —
> kód je demo, kinematika je napevno na cizí mašinu, postprocesor není.
>
> Já to obracím. Pětioskej tisk je pro mě to samý, co pětiosý frézování: vyberu, jak
> kus upnu, a strategii. Software počítá dráhy, kontroluje převis a kolize a počítá,
> co člověk počítá blbě — kinematiku, časy, tok materiálu. Řídicí vrstva už na ponku
> je: Pi 5 s realtime jádrem, LinuxCNC, Remora na FlexiHAL — stejná architektura, na
> který pojede pětiosý frézování. Materiál si kalibruju na stole: šířka dráhy proti
> toku, rychlosti a teplotě. Pár jednostěnnejch výtisků a mám tabulku — to samý, co
> řezný podmínky u frézky.
>
> Slovo "slicer" nechávám ve jménu, protože to hledáte v prohlížeči. Stavím řešení,
> ne slicer.

Publish path: the homepage teaser (EP 01, "připravujeme") already carries the angle;
this text becomes the episode page in the D14 session, once the owner confirms the
retrofit control facts are safe to state (Pi 5 + FlexiHAL + LinuxCNC/Remora is
verified from the Flexi-Pi and Remora repos; the machine envelope is still
`doplní se`).
