# riplay-slicer — fork research, and why there is no real 5-axis slicer

**Status:** research note, 2026-11-12. Input for PLAN D15; nothing here is shipped.
**Owner context:** CNC specialist who hand-writes 5-axis G-code; the bottleneck is the
software side, not the process side. The note is written from that direction.

---

## 1. What the slicer must become (already decided in the PLAN)

| Session | Done test |
|---|---|
| D15 | `riplay-slicer` repo public, CI green, README does not overclaim |
| D16 | `riplay-slicer slice model.stl` produces gcode for a real print (mesh import + 2.5D spine, CLI, tests) |
| D17 | A real sliced model is scrubbable in the browser (Three.js layer preview) |
| D18 | The homepage Replay and the slicer preview share the viewer component |
| D21 | CAM for a genuinely 5-axis part; toolpath replay published |

Concept §3: the preview renders layers, perimeters, supports, 5-axis tool orientation —
one codebase with the site's Replay. Concept §10 leaves GPL-3.0 vs AGPL-3.0 open. **A fork
answers that question by inheritance** (§4), so the choice is part of picking the fork.

## 2. Why there is no real 5-axis slicer

The geometry is not the missing piece. Five-axis toolpath generation is 40-year-old
milling technology, hand-provable (the owner programs it by hand), and the additive
versions exist in research: S³-Slicer (SIGGRAPH Asia 2022 best paper), S4 (its clean
Python reimplementation), Fractal Cortex (from-scratch, GPL-3.0), Open5x (CHI 2022).
Nobody has turned them into a product for three reasons:

1. **Every production slicer dodges the physics with one architectural trick.** Planar
   slicing makes each layer a short, bounded, pause-able unit with a fixed deposition
   direction and fixed bead geometry. That collapses the process (heat, bonding, sag,
   overhang) into a handful of per-layer constants — fan, min layer time, bridges. The
   entire stack is built on it: Slic3r → Cura → PrusaSlicer → Orca lineage, the firmware
   motion planners, the G-code conventions. Five-axis removes the trick: orientation
   becomes a free variable, layers become unbounded streams, Z stops being time, and the
   bead cross-section starts varying along the path. What remains is the real process
   planner that nobody ever had to build.
2. **Nobody owns both halves.** Process knowledge for 5-axis deposition lives in
   machinists' heads; software capability lives in slicer companies whose products are
   planar by construction and who have no market line to fund a rewrite — 5-axis FDM
   hardware barely exists (Fractal 5 Pro kit ≈ $1900, Open5x retrofit, university rigs).
   Research groups chase full autonomy (global orientation optimisation), demo propeller
   shapes, and publish demo-grade code hardcoded to their own kinematics (S4 targets the
   Core R-Theta, Open5x targets its own gantry).
3. **The verification problem has no stock.** CAM verifies against rigid material that
   exists up front. A deposition workpiece is being created and is soft the whole time, so
   a slicer cannot cheaply "simulate the cut". Practical answer for a one-person shop:
   margins + first articles on the bench + a scrubbable toolpath viewer — which the site's
   Replay (D17/D18) already provides. The missing product is not an autonomous slicer; it
   is the **machinist's CAM loop for deposition**: human-in-the-loop, fast feedback,
   constraint checking. That quadrant is empty.

**Consequence for riplay-slicer:** do not fork the autonomy-research code's brains; fork
its bookkeeping (mesh → paths → gcode, kinematics, collision) and replace the orientation
strategy with the owner's process knowledge, encoded as rules and calibration tables. The
"deposition model" is tabulated the way a machinist tabulates feeds and speeds: a few
single-wall prints give bead width/height vs flow/speed/temperature. The bead is a tool
whose diameter varies with feed — everything else is standard CAM arithmetic.

### Naming and scope (owner decision, 2026-11-12)

- **Public word stays "slicer"** — riplay.cz already taunts with "Slicer, který
  neexistuje" and the workshop table lists `5osý slicer · open source · prototyp`. It is
  the term the maker audience searches for and the r/CNC hook at D22.
- **What is built is a 5-axis 3D printing solution**, not a slicer: machine retrofit +
  human-in-the-loop CAM for deposition + tabulated bead model + Replay viewer. Written
  into concept §3 ("The word slicer") so no future session drifts into the monolith.
- README (D15) must carry that definition — name `riplay-slicer`, first paragraph states
  the real scope, so the taunt never becomes an overclaim.

### M0 progress (2026-11-12)

- Fork cloned to `~/Projects/riplay-slicer` (upstream `fractalrobotics/Fractal-Cortex`,
  local branch `riplay-spine`).
- Headless driver `cli.py` written and working: a 40×40×20 box at 0.25 mm layers →
  79 layers, ~6.5k G1 moves, seconds, no GUI. Engine deps only (numpy, trimesh, shapely,
  scipy, networkx in `.venv`).
- Engine/API facts: `slice_in_3_axes(printSettings, meshData)` →
  `write_3_axis_gcode(outPath, outPath, printSettings, ...)`; `printSettings` is a
  positional list indexed in `all_calculations` (temps, infill %, shell, layer height,
  speeds, z-hop/retraction, supports, brim). GUI deps (pyglet/glooey) live only in
  `slicer_main.py`; 5-axis entry points are `slice_in_5_axes(printSettings, meshData,
  slicingDirections)` + `write_5_axis_gcode(...)`.
- Not done yet: post-processor swap (fork emits Fractal's Klipper dialect with
  `home_ab`), 5-axis path run, tests.

## 3. Candidates (verified via GitHub API, 2026-11-12)

**Purpose-built 5-axis / non-planar, small enough to fork:**

| Repo | License | Language | Size / state | Verdict |
|---|---|---|---|---|
| `fractalrobotics/Fractal-Cortex` | GPL-3.0 | Python | 206★, last push 2025-07; 4 files ≈ 310 KB — engine in `slicing_functions.py` (108 KB) + `slicer_main.py` (81 KB), GUI isolated in widget files | **Fork target.** From-scratch multidirectional 5-axis FDM slicer, backwards-compatible 3-axis, pure Python (numpy/trimesh/shapely). Author released it as he stepped back |
| `txf0101/5AxisSlicer` | MIT | Python | 11★, active (2026-10) | Rotary-bed 5-axis: planar/rotary/curve/tube/freeform workbenches, STEP import, G-code preview. Windows desktop, research quality; MIT keeps the license question open |
| `jyjblrd/S4_Slicer` | GPL-3.0 | Python | 978★, 2025-04, Jupyter notebook | Best algorithm reference (deformation-based support-free slicing); not a shippable app |
| `zhangty019/S3_DeformFDM` | BSD-3 | C++/Qt | 178★ | Original research code, VS2019/Windows, hard build |
| `FreddieHong19/Open5x` | MIT | — | 1199★ | Hardware repo is valuable (Duet2 configs); its slicer is Grasshopper definitions locked to commercial Rhino — not forkable |
| `compas-dev/compas_slicer` | MIT | Python | 49★, active (2026-04) | Planar + curved slicing, CGAL backend, JSON + gcode output — JSON suits the Replay viewer |

**Production engines — wrong shape for this project:**

| Repo | License | Verdict |
|---|---|---|
| `Ultimaker/CuraEngine` | AGPL-3.0 | Headless CLI engine, excellent architecture wiki — but AGPL-3.0 by inheritance and a large C++ codebase |
| `SoftFever/OrcaSlicer`, `prusa3d/PrusaSlicer`, Bambu Studio | AGPL-3.0 | Slic3r lineage, hundreds of kLOC; forking is a maintenance trap for one person |
| `oozebot/preFlight` | AGPL-3.0 | New C++20 engine (Luminary), young |

**CAM side (the router retrofit, D21):** `aewallin/opencamlib` (LGPL-2.1, C++/Python,
active) — use as a library for milling toolpaths, not a fork. No viable open-source
5-axis milling CAM exists to fork; the owner's hand G-code is the reference until then.

## 4. Decision

**Fork `Fractal-Cortex` as the spine.** Reasons: only open-source 5-axis FDM slicer small
enough for one person to own; GUI/engine split makes the D16 headless CLI a deletion task,
not a rewrite; 3-axis mode already ≈ the D16 spine; GPL-3.0.

**License consequence (closes concept §10 toward GPL-3.0):** forking GPL-3.0 code makes
`riplay-slicer` GPL-3.0-or-later; the AGPL-3.0 option is gone. MIT alternatives
(`5AxisSlicer`, `compas_slicer`) preserve the choice but need a heavier headless refactor
and none of them is as complete on the 3-axis spine. Accepted, unless reversed before D15.

Non-goals until D21: milling CAM, thermal simulation, autonomy. The orientation strategy
stays human (owner picks setups, software checks overhang/collision and flags violations).

## 5. Build order

- **M0 — spine (≈ D15/D16):** clone fork, strip the GUI, CLI slices a box to gcode; tests on a known model.
- **M1 — rotary on the bench:** cylindrical part around the retrofit axis; post-processor for the controller that runs the 5 axes (RichAuto DSP11 will not take XYZBC — if the retrofit rides FlexiHAL/LinuxCNC, the post is standard).
- **M2 — the real milestone:** reproduce, automatically, a toolpath the owner already programmed by hand for a real part. When the generator matches the hand output, the process knowledge is in the software.
- **M3 — D17/D18:** Three.js viewer scrubs the toolpath (orientation, overhang flags) on the site; D21 episode films a genuinely 5-axis part.
