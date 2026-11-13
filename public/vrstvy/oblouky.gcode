; riplay.cz — ručně psaná ukázka oblouků G2/G3 pro náhled vrstev.
; Není to výřez ze sliceru ani z tisku: čísla jsou zapsaná tak, aby se dala zkontrolovat.
; Vše v milimetrech, rovina G17, dvě vrstvy po 0,30 mm.
;
; Vrstva 0 (Z 0,30)
;   půlkruh    r 10,  střed (10, 0),  od (20, 0) do (0, 0), proti směru hodin   → G3 I-10 J0
;   kružnice   r 5,   střed (40, 0),  plná, po směru hodin                      → G2 I-5 J0
;   čtvrtkruh  r 10,  střed (60, 10), od (60, 0) do (70, 10), zápisem R         → G3 R10
;
; Vrstva 1 (Z 0,60) — tytéž tvary o 0,5 mm menší
;   půlkruh    r 9,5, střed (10, 0),  od (19,5, 0) do (0,5, 0)                 → G3 I-9,5 J0
;   kružnice   r 4,5, střed (40, 0),  plná                                      → G2 I-4,5 J0
;   čtvrtkruh  r 9,5, střed (60, 10), od (60, 0,5) do (69,5, 10)               → G3 R9,5
;
; Filament je zapsaný po 0,05 mm na milimetr dráhy (1,75mm struna, 0,4mm tryska),
; takže extruze sedí na délku oblouků. Proti skutečnému tisku tomu chybí všechno ostatní:
; žádný lem, výplň ani retrakce.

;LAYER 0
;Shell
G0 X20 Y0 Z0.3
G3 X0 Y0 I-10 J0 E1.571
G0 X45 Y0
G2 I-5 J0 E3.142
G0 X60 Y0
G3 X70 Y10 R10 E3.927

;LAYER 1
;Shell
G0 X19.5 Y0 Z0.6
G3 X0.5 Y0 I-9.5 J0 E5.419
G0 X44.5 Y0
G2 I-4.5 J0 E6.833
G0 X60 Y0.5
G3 X69.5 Y10 R9.5 E7.579
