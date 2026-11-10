export type Stage = {
  /** short label shown in the scrubber */
  k: string;
  /** what is happening at this stage, one sentence */
  n: string;
  /** time spent at this stage */
  t: string;
};

/**
 * The sample part that drives the homepage Replay until the first real
 * passport exists (D6 in PLAN.md). Numbers here are illustrative and the UI
 * says so; the component does not care whether they are real.
 */
export const replay = {
  part: 'Vložka středové konzoly',
  caption: 'telefon se nabíjí bezdrátově, dva USB-C, žádné kabely',
  material: 'Al 6061 + PETG',
  tolerance: '±0,05 mm',
  stages: [
    { k: 'Zadání', n: 'Dvě fotky rozbitého držáku a tři rozměry od zákazníka.', t: '0 min' },
    { k: 'CAD', n: 'Model v Onshape, tři revize, než sedl do konzoly.', t: '90 min' },
    { k: 'CAM', n: 'Adaptivní hrubování a dokončovací dráhy, Ø3 fréza.', t: '35 min' },
    { k: 'Fréza', n: 'Hliník 6061, čtyři upnutí, chlazení mlhou.', t: '52 min' },
    { k: 'Tisk', n: 'PETG, 0,16 mm, klipy a distanční vložky.', t: '74 min' },
    { k: 'Hotovo', n: 'Smontováno, zkušební montáž v autě, předáno.', t: '—' },
  ] satisfies Stage[],
};
