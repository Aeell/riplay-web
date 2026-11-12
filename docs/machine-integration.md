# riplay-machine — the integration layer (design)

**Status:** design, 2026-11-12. Companion to `docs/5axis-print-solution.md` (the
architecture) and `docs/research-slicer-fork.md` (the planner side). This document is
the spec for the *machine side* of the 5-axis 3D printing solution: the software that
makes one machine be a CNC mill and a 5-axis printer on one brain.

The post-processor (`~/Projects/riplay-slicer/post_linuxcnc.py`) is the last inch of
the planner. This is the rest of the software.

---

## 1. Principle: one brain, dumb controller, smart planner

The machine runs **one LinuxCNC instance** on the Pi 5 (Flexi-HAL + Remora stepping —
proven on the bench router). The controller never parses schedules or knows about
"slicing"; the gcode + M-codes are the entire interface between planner and machine.
Intelligence stays in `riplay-slicer` (planner, post, schedule) — the machine executes.

**The machine (owner facts, 2026-11-12):** Wattsan 0404-mini router, 2.2 kW spindle.
The stock RichAuto A11E DSP controller is removed — **LinuxCNC runs the machine through
the Pi 5 + Flexi-HAL today.** This router is the base the 4th/5th-axis retrofit and the
swappable print head grow from. Working envelope and achieved tolerance remain unknown
(`doplní se` on the site until measured).

## 2. What LinuxCNC already provides (verified facts, not wishes)

| Mechanism | Fact | Role here |
|---|---|---|
| **Switchable kinematics** (2.9, `switchkins`) | `motion.switchkins-type` HAL pin selects between kinematics types at runtime; `xyzbc-trt-kins` ships with type0=5-axis XYZBC + type1=identity; switching is done from G-code via M-codes (sim configs use M128/M129) followed by `M66 E0 L0` sync. Newer master deprecates the pin in favour of G12.1/G13.1 | **The CNC ↔ 5-axis seam already exists.** One INI: identity/trivkins for mill mode, xyzbc-trt for print/5-axis mode, switched by our M-code |
| **User M-codes M100–M199** | Any executable file named `M1nn` (bash/python) in `PROGRAM_PREFIX` or `[RS274NGC]USER_M_PATH`; P/Q passed as argv; program **blocks** until it exits | The whole process layer: temps, fan, chamber, head state — as blocking M-codes |
| **Tool table + M6** | Per-tool offsets, remappable M6 | Head swap: each head = a tool with its own offset |
| **HAL** | Realtime + userspace components (`halcompile`), PID, PWM, ADC | Heater/chamber/fan loops as components |
| **Sim configs** | `sim/axis/vismach/5axis/table-rotary-tilting/` and friends run without hardware | **CI and bench-less testing of the whole integration** |

## 3. What we build (ours — the actual integration)

**Repo: `riplay-machine`** (next to `riplay-slicer`; same license GPL-3.0):

```
riplay-machine/
  configs/          INI + HAL files (mill mode, print mode, sim variants)
  mcodes/           M1nn executables (python/bash), the process layer
  comps/            halcompile component sources (heater PID, chamber, head-detect)
  tests/            sim-mode runs asserted by script (no hardware needed)
  README.md         honest status line, GPL-3.0, bench prerequisites
```

### 3.1 Head state model

- **T1 = mill head** (spindle, spindle encoder on Flexi-HAL), **T2 = print head**
  (nozzle, heater, thermistor, fan, extruder = U joint).
- `M6 T1|T2` remap flow: park → dock swap (manual for now; dock signal later) →
  re-verify with probe/toolsetter → set tool offset → set switchkins type (mill:
  identity/trivkins; print: xyzbc-trt) → enable/disable the head's process loops →
  update HAL status pins for the GUI.

### 3.2 M-code map (all blocking executables)

| Code | Function | Notes |
|---|---|---|
| M104 / M109 | nozzle set / set+wait | reads `riplay-machine` state file; drives heater PID pins |
| M140 / M190 | bed set / set+wait | same |
| M106 / M107 | fan on/off | |
| M191 | chamber set+wait | ours (owner's fast-change requirement) |
| M128 / M129 | kins type 0 / 1 | follows the sim-config convention; revisit G12.1/G13.1 on newer LinuxCNC |
| M199 | report head + process state | consumed by the site's telemetry later (PLAN D20) |

### 3.3 Process loop components

- heater PID (`halcompile`), thermistor linearisation (userspace), chamber heater +
  vent fan PWM, head-present interlock (dock input — heating enabled only with head
  mounted).
- Extruder = U joint (stepper via Remora), exactly as the post already emits.
- Open bench item unchanged: Flexi-HAL analog I/O for thermistor/heater; RS485
  companion MCU is the fallback and would plug in as a HAL module behind the same pins.

## 4. Development order — sim first, bench second

1. **Sim harness (no hardware):** take the in-tree sim config, add our M-codes as
   no-op-with-log executables, assert in a script that M6/M104/M191/M128 sequences
   execute and kins switches. Runs on any Linux box — CI-able.
2. **Bench 1 (existing router):** mill mode unchanged — proves no regression on the
   stack that already works.
3. **Bench 2 (print head rig):** M6 swap flow, M109 wait, U extrusion, chamber loop.
4. **Bench 3:** full 5-axis print mode (xyzbc-trt) with a schedule from `riplay-slicer`.

## 5. Interface contract with riplay-slicer

- Planner → machine: **gcode only** (LinuxCNC dialect, extrusion on U, our M-codes).
- Planner → viewer: **schedule JSON** (D17/D18).
- Machine → world: M199 state + M66-readable status pins (D20 telemetry later).

## 6. What must be checked on the bench (nothing decided here)

- LinuxCNC version in the Flexi-Pi image (switchkins needs 2.9+; G12.1/G13.1 only in newer master).
- Flexi-HAL analog I/O (thermistor/heater) — RS485 companion fallback.
- Dock design and head-detect input — owner's domain.
