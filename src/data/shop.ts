export type Fact = { k: string; v: string | null };

export type Service = {
  n: string;
  title: string;
  text: string;
  facts: Fact[];
};

/**
 * Capability claims. `null` renders as a visible gap on purpose — the site
 * must never invent a number. Fill these in on D26 (see PLAN.md).
 */
export const shop = {
  services: [
    {
      n: '01',
      title: 'CAD a díl na míru',
      text:
        'Návrh dílu, který neexistuje nebo se nedá koupit. Od měření v autě přes model až po výkres, podle kterého se dá vyrábět.',
      facts: [
        { k: 'výstupy', v: 'STEP · STL · DXF · výkres' },
        { k: 'měření', v: 'posuvka + sken' },
      ],
    },
    {
      n: '02',
      title: 'CNC frézování',
      text:
        'Přesné díly z hliníku, plastu a dřeva. Kusové zakázky i malé série, včetně upnutí a dokončení.',
      facts: [
        { k: 'pracovní prostor', v: null },
        { k: 'dosažitelná tolerance', v: null },
        { k: 'materiály', v: null },
      ],
    },
    {
      n: '03',
      title: '3D tisk a sestavy',
      text:
        'Vytištěné díly, které drží pohromadě s kovem: klipy, vložky, držáky, celé sestavy do interiéru.',
      facts: [
        { k: 'materiály', v: 'PETG · ASA · TPU' },
        { k: 'max. rozměr', v: null },
      ],
    },
  ] satisfies Service[],

  bench: [
    { n: '5osá frézka', s: 'retrofit', state: 'rozestavěno', tone: 'warn' },
    { n: 'Pi 5 + FlexiHAL', s: 'řízení', state: 'běží', tone: 'ok' },
    { n: '5osý slicer', s: 'open source', state: 'prototyp', tone: 'warn' },
    { n: 'dílna', s: 'kapacita', state: 'volná', tone: 'ok' },
  ],

  // Shown in the footer. `null` is rendered as a visible gap, never as a guess.
  legal: {
    name: 'Stanimir Stankov',
    ico: null,
    address: 'Mokrá 68, 460 01 Liberec – Machnín',
    email: 'info@riplay.cz',
    phone: null,
  },
} as const;
