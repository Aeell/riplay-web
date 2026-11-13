// <toolpath-viewer> — the canvas, the scrubber and the print animation, in one element.
//
// Two very different pages use it: the toolbox (`/nastroje/vrstvy`), where someone brings a file
// and steps through layers, and the Replay, where the print stage builds the sample up layer by
// layer. Both hand it the same thing — layers of paths in millimetres — so there is one drawing
// implementation, not two that drift.
//
// Attributes:
//   data-stack     paint layers 0…n cumulatively (a print in progress) instead of one at a time
//   data-interval  ms per layer when playing (default 120)
// The scrubber is markup: the component renders it only when `controls` is set.
//
// Methods: setLayers(layers, bounds?), show(i), play(), stop()
// Event:   layerchange  { index, layer, count }

import { fitTransform, paintLayer, paintStack, pathBounds, sizeCanvas } from './layer-draw.mjs';

export type ViewerPoint = { x: number; y: number };
export type ViewerPath = { kind: 'perimeter' | 'infill'; pts: ViewerPoint[] };
export type ViewerLayer = { z: number; paths: ViewerPath[] };
export type ViewerBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };

const DEFAULT_INTERVAL = 120;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export class ToolpathViewerElement extends HTMLElement {
  layers: ViewerLayer[] = [];
  index = 0;

  private bounds: ViewerBounds | null = null;
  private timer = 0;
  private observer: ResizeObserver | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private bar: HTMLElement | null = null;
  private rangeInput: HTMLInputElement | null = null;
  private layerLabel: HTMLElement | null = null;
  private zLabel: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private prev: HTMLButtonElement | null = null;
  private next: HTMLButtonElement | null = null;

  connectedCallback() {
    this.canvas = this.querySelector('canvas');
    this.bar = this.querySelector('[data-bar]');
    this.rangeInput = this.querySelector('[data-range]');
    this.layerLabel = this.querySelector('[data-layer]');
    this.zLabel = this.querySelector('[data-z]');
    this.hint = this.querySelector('[data-hint]');
    this.prev = this.querySelector('[data-prev]');
    this.next = this.querySelector('[data-next]');

    this.rangeInput?.addEventListener('input', () => this.show(Number(this.rangeInput?.value ?? 0)));
    this.prev?.addEventListener('click', () => this.show(this.index - 1));
    this.next?.addEventListener('click', () => this.show(this.index + 1));

    // Watch the element, not the window: it is sized by the layout around it (a grid column, a
    // drawing it is laid over), and that can change without anyone resizing the window.
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.draw());
      this.observer.observe(this);
    }
    this.draw();
  }

  disconnectedCallback() {
    this.stop();
    this.observer?.disconnect();
    this.observer = null;
  }

  get stack(): boolean {
    return this.hasAttribute('data-stack');
  }

  /** Hands the viewer a set of layers. An empty set clears it back to its empty state. */
  setLayers(layers: ViewerLayer[], bounds?: ViewerBounds | null) {
    if (!layers.length) {
      this.clear();
      return;
    }
    this.layers = layers;
    this.bounds = bounds ?? pathBounds(layers.flatMap((layer) => layer.paths));
    this.hint?.setAttribute('hidden', '');
    this.bar?.removeAttribute('hidden');
    if (this.rangeInput) this.rangeInput.max = String(layers.length - 1);
    this.show(0);
  }

  show(raw: number) {
    if (!this.layers.length) return;
    const wanted = Number.isFinite(raw) ? Math.round(raw) : 0;
    this.index = clamp(wanted, 0, this.layers.length - 1);
    const layer = this.layers[this.index];
    const label = `vrstva ${this.index + 1} / ${this.layers.length}`;
    if (this.rangeInput) {
      this.rangeInput.value = String(this.index);
      // Screen readers announce "3 of 13" instead of "3" for a slider clamped to 0…12.
      this.rangeInput.setAttribute('aria-valuetext', label);
    }
    if (this.layerLabel) this.layerLabel.textContent = label;
    // A button that would do nothing is not a target: at the ends of the range, say so.
    if (this.prev) this.prev.disabled = this.index === 0;
    if (this.next) this.next.disabled = this.index === this.layers.length - 1;
    if (this.zLabel) this.zLabel.textContent = `z ${Number.isFinite(layer.z) ? layer.z.toFixed(2) : '—'} mm`;
    this.draw();
    this.dispatchEvent(
      new CustomEvent('layerchange', {
        bubbles: true,
        detail: { index: this.index, layer, count: this.layers.length },
      }),
    );
  }

  /** Steps through the layers; with data-stack it reads as the part being built. */
  play() {
    if (!this.layers.length || this.timer) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.show(this.layers.length - 1);
      return;
    }
    this.show(0);
    const asked = Number(this.dataset.interval);
    const interval = Number.isFinite(asked) && asked > 0 ? Math.max(60, asked) : DEFAULT_INTERVAL;
    this.timer = window.setInterval(() => {
      if (this.index >= this.layers.length - 1) {
        this.stop();
        return;
      }
      this.show(this.index + 1);
    }, interval);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  private clear() {
    this.stop();
    this.layers = [];
    this.bounds = null;
    this.index = 0;
    if (this.canvas) this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.hint?.textContent) this.hint.removeAttribute('hidden');
    this.bar?.setAttribute('hidden', '');
    if (this.layerLabel) this.layerLabel.textContent = 'vrstva —';
    if (this.zLabel) this.zLabel.textContent = 'z — mm';
  }

  private draw() {
    if (!this.canvas || !this.layers.length || !this.bounds) return;
    const surface = sizeCanvas(this.canvas);
    if (!surface) return;
    const { ctx, width, height } = surface;
    ctx.clearRect(0, 0, width, height);
    const t = fitTransform(this.bounds, width, height, 12);
    if (!t) return;
    if (this.stack) paintStack(ctx, this.layers, this.index, t);
    else paintLayer(ctx, this.layers[this.index], t);
  }
}

// Guarded: this module is imported by a client script, but a tool that imports it from Node
// (a test, a future prerender) must not fall over on an API the server does not have.
if (typeof customElements !== 'undefined' && !customElements.get('toolpath-viewer')) {
  customElements.define('toolpath-viewer', ToolpathViewerElement);
}
