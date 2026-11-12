"use strict";
// LifeGame · «Нить» — выбор награды за шаг (звезда A).
// Значения наград живут только в коде; на экране — подписи ступеней.
// Модуль ничего не пишет в состояние: форма читает value() и сохраняет через transact.
(function (root) {
  const REWARDS = Object.freeze([0, 25, 50, 100, 250, 500, 1000]);
  const LABELS = Object.freeze(["Без награды", "Маленький шаг", "Уверенный шаг",
    "Шаг к ориентиру", "За горизонтом", "Прорыв", "Максимум"]);
  const DEFAULT_REWARD = 25;
  const LAST = REWARDS.length - 1;

  // Ближайшая ступень для любого числа (старые награды вроде 15 или 300).
  function nearestIndex(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 0;
    let best = 0;
    for (let k = 1; k < REWARDS.length; k++) if (Math.abs(REWARDS[k] - v) < Math.abs(REWARDS[best] - v)) best = k;
    return best;
  }
  const isStep = value => REWARDS.includes(Number(value));

  // options: { value, title, id, onChange(value), onLevel(glow 0..1, index) }
  // Если value не совпадает со ступенью (старое задание), оно сохраняется как есть,
  // пока человек сам не сдвинет нить.
  function create(options = {}) {
    const doc = root.document;
    const initial = options.value ?? DEFAULT_REWARD;
    let index = nearestIndex(initial), legacy = isStep(initial) ? null : Number(initial), shown = -1;
    let lastValue = legacy ?? REWARDS[index];

    const el = (tag, cls) => { const e = doc.createElement(tag); if (cls) e.className = cls; return e; };
    const element = el("div", "lg-light-thread");
    const head = el("div", "lg-light-thread-head");
    const title = el("label", "lg-light-thread-title"); title.textContent = options.title || "Награда за шаг";
    const name = el("span", "lg-light-thread-name"); name.setAttribute("aria-hidden", "true");
    head.append(title, name);

    const track = el("div", "lg-light-thread-track");
    const hair = el("div", "lg-light-thread-hair"), lit = el("div", "lg-light-thread-lit");
    const dots = REWARDS.slice(0, LAST).map((_, k) => { const d = el("i", "lg-light-thread-dot"); d.style.setProperty("--x", k / LAST); return d; });
    const star = el("div", "lg-light-thread-star"); star.append(el("i"), el("b")); star.setAttribute("aria-hidden", "true");
    const flare = el("div", "lg-light-thread-flare"); flare.append(el("div", "lg-light-thread-core")); flare.setAttribute("aria-hidden", "true");
    const range = el("input", "lg-light-thread-range");
    range.type = "range"; range.min = "0"; range.max = String(LAST * 100); range.step = "1";
    range.id = options.id || "lg-light-thread-" + Math.random().toString(36).slice(2, 8);
    title.htmlFor = range.id;
    track.append(hair, lit, ...dots, star, flare, range);
    element.append(head, track);

    function paint(pos, snap) {
      const k = Math.round(Math.max(0, Math.min(1, pos)) * LAST);
      element.classList.toggle("is-snap", snap);
      element.style.setProperty("--p", snap ? k / LAST : pos);
      element.style.setProperty("--t", Math.pow(k / LAST, 1.4).toFixed(3));
      if (k !== shown) {
        const wasMax = shown === LAST; shown = k;
        element.classList.toggle("is-zero", k === 0);
        element.classList.toggle("is-max", k === LAST);
        if (k !== LAST) element.classList.remove("is-ignite");
        else if (!wasMax) { element.classList.remove("is-ignite"); void element.offsetWidth; element.classList.add("is-ignite"); }
        name.textContent = LABELS[k];
        dots.forEach((d, i) => d.classList.toggle("is-on", i <= k));
        range.setAttribute("aria-valuetext", LABELS[k]);
        // Уровень свечения 0..1 — форма может подсветить им окно и фон.
        if (typeof options.onLevel === "function") options.onLevel(Math.pow(k / LAST, 1.4), k);
      }
      if (snap) range.value = String(k * 100);
    }
    function notify() {
      const value = legacy ?? REWARDS[index];
      if (value !== lastValue && typeof options.onChange === "function") options.onChange(value);
      lastValue = value;
    }
    function commit() {
      index = Math.round(range.value / 100);
      paint(index / LAST, true);
      notify();
    }
    range.addEventListener("input", () => {
      legacy = null;
      index = Math.round(range.value / 100);
      paint(range.value / (LAST * 100), false);
      notify();
    });
    range.addEventListener("change", () => { if (Number(range.value) !== index * 100) legacy = null; commit(); });
    range.addEventListener("pointerup", commit);
    range.addEventListener("blur", commit);
    range.addEventListener("keydown", event => {
      const steps = {ArrowRight:1, ArrowUp:1, ArrowLeft:-1, ArrowDown:-1, PageUp:1, PageDown:-1};
      if (!(event.key in steps) && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const k = event.key === "Home" ? 0 : event.key === "End" ? LAST : Math.max(0,Math.min(LAST,index+steps[event.key]));
      legacy = null; range.value = String(k * 100);
      range.dispatchEvent(new Event("input",{bubbles:true}));
      commit();
    });

    const api = {
      element,
      input: range,
      value: () => legacy ?? REWARDS[index],
      set(value) { index = nearestIndex(value); legacy = isStep(value) ? null : Number(value); paint(index / LAST, true); lastValue = legacy ?? REWARDS[index]; }
    };
    paint(index / LAST, true);
    return api;
  }

  const LightThread = Object.freeze({ REWARDS, LABELS, DEFAULT_REWARD, nearestIndex, isStep, create });
  root.LifeGameLightThread = LightThread;
  if (typeof module === "object" && module.exports) module.exports = LightThread;
})(typeof window !== "undefined" ? window : globalThis);
