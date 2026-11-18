import type { PointerGesture } from "./gesture";

export type TouchControlMode = "stick" | "drag";
export const STICK_DEAD_ZONE = 8;
export const STICK_RADIUS = 36;
const GROUND_VERTICAL_PROJECTION = 7.6 / Math.hypot(7.6, 6.8);

export function stickInput(gesture: PointerGesture) {
  const dx = gesture.x - gesture.startX;
  const dy = gesture.y - gesture.startY;
  const distance = Math.hypot(dx, dy);
  const strength = gesture.dragging
    ? Math.max(
        0,
        Math.min(
          1,
          (distance - STICK_DEAD_ZONE) / (STICK_RADIUS - STICK_DEAD_ZONE),
        ),
      )
    : 0;
  const z = dy / GROUND_VERTICAL_PROJECTION;
  const length = Math.hypot(dx, z) || 1;
  const knobScale = Math.min(1, STICK_RADIUS / (distance || 1));
  return {
    x: (dx / length) * strength,
    z: (z / length) * strength,
    strength,
    knobX: dx * knobScale,
    knobY: dy * knobScale,
  };
}

export class TouchStickVisual {
  private element = document.createElement("div");
  private knob = document.createElement("span");

  constructor(canvas: HTMLCanvasElement) {
    this.element.className = "touch-stick";
    this.element.setAttribute("aria-hidden", "true");
    this.element.hidden = true;
    this.element.append(this.knob);
    canvas.insertAdjacentElement("afterend", this.element);
  }

  update(gesture: PointerGesture) {
    this.element.hidden = !gesture.dragging;
    if (!gesture.dragging) return;
    const input = stickInput(gesture);
    this.element.style.left = `${gesture.startX}px`;
    this.element.style.top = `${gesture.startY}px`;
    this.knob.style.transform = `translate(${input.knobX}px, ${input.knobY}px)`;
    this.element.classList.toggle("at-full-speed", input.strength === 1);
  }

  hide() {
    this.element.hidden = true;
  }
  dispose() {
    this.element.remove();
  }
}
