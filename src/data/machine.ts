/**
 * The machine, as data.
 *
 * Every row carries the thing that proves it. Today the only proof that exists is the owner's
 * statement — there are no photos and no machine log yet — so `src` says exactly that. When D5
 * photography and D20 telemetry land, the source changes to a photo or a log line and nothing
 * else on the page has to move.
 *
 * `null` means unknown. It renders as `doplní se`; it is never guessed.
 */

export type State = 'stock' | 'retrofit' | 'removed' | 'planned' | 'broken' | 'unknown';

export type Fact = {
  k: string;
  v: string | null;
  state: State;
  /** what proves this row today */
  src: string;
};

export type Change = {
  area: string;
  before: string;
  after: string | null;
  state: State;
  src: string;
  note: string | null;
};

const OWNER = 'údaj majitele, 2026-11-12';
const HANDBOOK = 'zápis v docs/02-handoff.md, 2026-11-12';

export const machine = {
  name: 'Wattsan 0404-mini',
  kind: 'stolní CNC frézka',
  /** one sentence, no adjectives */
  lead:
    'Malá frézka, na které stojí celá dílna. Původní řízení je venku, místo něj LinuxCNC na Raspberry Pi 5 — a z toho má vzniknout mašina, která frézuje i tiskne.',

  facts: [
    { k: 'stroj', v: 'Wattsan 0404-mini', state: 'stock', src: OWNER },
    { k: 'vřeteno', v: '2,2 kW', state: 'stock', src: OWNER },
    { k: 'řízení', v: 'LinuxCNC (Pi 5 + Flexi-HAL)', state: 'retrofit', src: OWNER },
    { k: 'původní řízení', v: 'RichAuto A11E — odstraněno', state: 'removed', src: OWNER },
    { k: 'pracovní prostor', v: null, state: 'unknown', src: 'změřit, pak doplnit' },
    { k: 'dosažitelná tolerance', v: null, state: 'unknown', src: 'změřit na zkušebním kusu' },
    { k: 'materiály', v: null, state: 'unknown', src: 'doplnit podle toho, co se reálně řeže' },
    { k: '4. a 5. osa', v: 'rozestavěno', state: 'planned', src: HANDBOOK },
    { k: 'tisková hlava', v: 'záměr, ne hotová věc', state: 'planned', src: HANDBOOK },
  ] satisfies Fact[],

  changes: [
    {
      area: 'Řízení',
      before: 'RichAuto A11E (DSP, uzavřený)',
      after: 'LinuxCNC na Pi 5 + Flexi-HAL',
      state: 'retrofit',
      src: OWNER,
      note: 'RT stack je na ponku ověřený v provozu, ne papírový.',
    },
    {
      area: 'Kinematika',
      before: '3 osy',
      after: null,
      state: 'planned',
      src: HANDBOOK,
      note: 'Čtvrtá a pátá osa jsou rozestavěné; hotové budou, až se s nimi pohne na stroji.',
    },
    {
      area: 'Tisk',
      before: 'žádný',
      after: 'hlava na výměnu, extruze jako osa U',
      state: 'planned',
      src: HANDBOOK,
      note: 'LinuxCNC nemá E, takže extruze jede na U. Jeden postprocesor pak obslouží frézu i tisk.',
    },
    {
      area: 'Komora',
      before: 'žádná',
      after: 'řízená teplota komory',
      state: 'planned',
      src: HANDBOOK,
      note: 'Zatím jen směr; čidlo a topení jsou otevřená položka níž.',
    },
  ] satisfies Change[],

  /** what is genuinely not settled — listed, because hiding it would be the lie */
  open: [
    {
      what: 'Analogový vstup na Flexi-HAL pro termistor a topení',
      status: 'neověřeno',
      src: HANDBOOK,
    },
    {
      what: 'Fotky stroje',
      status: 'chybí — tabulka stojí na slově majitele',
      src: 'D5 (fotografie)',
    },
    {
      what: 'Log ze stroje, ze kterého by šel čas a stav číst',
      status: 'neexistuje',
      src: 'D20 (telemetrie)',
    },
  ],

  /** how to read the chips on the page */
  legend: [
    { state: 'stock', label: 'originál' },
    { state: 'retrofit', label: 'retrofit' },
    { state: 'removed', label: 'odstraněno' },
    { state: 'planned', label: 'v plánu' },
    { state: 'unknown', label: 'neví se' },
  ] as { state: State; label: string }[],
} as const;
