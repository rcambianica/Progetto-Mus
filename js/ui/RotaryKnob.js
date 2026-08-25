const knobControllers = new Map();

export function initializeRotaryKnobs() {
  const knobElements = document.querySelectorAll("[data-knob-for]");

  for (const knobElement of knobElements) {
    const inputId = knobElement.dataset.knobFor;

    const inputElement = document.getElementById(inputId);

    if (!inputElement) {
      console.warn(`Rotary knob input not found: ${inputId}`);

      continue;
    }

    if (knobControllers.has(inputId)) {
      continue;
    }

    const controller = createRotaryKnobController(knobElement, inputElement);

    knobControllers.set(inputId, controller);

    inputElement.addEventListener("input", controller.refresh);

    inputElement.addEventListener("change", controller.refresh);

    controller.refresh();
  }
}

export function refreshAllRotaryKnobs() {
  for (const controller of knobControllers.values()) {
    controller.refresh();
  }
}

function createRotaryKnobController(knobElement, inputElement) {
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let startValue = 0;

  function refresh() {
    const minimum = getMinimum(inputElement);

    const maximum = getMaximum(inputElement);

    const value = clamp(Number(inputElement.value), minimum, maximum);

    const ratio = maximum === minimum ? 0 : (value - minimum) / (maximum - minimum);

    const angle = -135 + ratio * 270;

    knobElement.style.setProperty("--knob-angle", `${angle}deg`);

    knobElement.style.setProperty("--knob-progress", `${ratio * 270}deg`);

    knobElement.classList.toggle("is-disabled", inputElement.disabled);

    knobElement.tabIndex = inputElement.disabled ? -1 : 0;
  }

  function setValue(requestedValue, commit = false) {
    if (inputElement.disabled) {
      return;
    }

    const minimum = getMinimum(inputElement);

    const maximum = getMaximum(inputElement);

    const step = getStep(inputElement);

    const clampedValue = clamp(requestedValue, minimum, maximum);

    const stepCount = Math.round((clampedValue - minimum) / step);

    const steppedValue = minimum + stepCount * step;

    const precision = getDecimalPrecision(step);

    inputElement.value = String(Number(steppedValue.toFixed(precision)));

    inputElement.dispatchEvent(
      new Event("input", {
        bubbles: true,
      }),
    );

    if (commit) {
      inputElement.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );
    }

    refresh();
  }

  function beginDrag(event) {
    if (inputElement.disabled) {
      return;
    }

    event.preventDefault();

    activePointerId = event.pointerId;

    startX = event.clientX;

    startY = event.clientY;

    startValue = Number(inputElement.value);

    knobElement.setPointerCapture(activePointerId);

    knobElement.classList.add("is-dragging");

    knobElement.focus();
  }

  function continueDrag(event) {
    if (activePointerId === null || event.pointerId !== activePointerId) {
      return;
    }

    const verticalMovement = startY - event.clientY;

    const horizontalMovement = event.clientX - startX;

    const movement = verticalMovement + horizontalMovement;

    const valueRange = getMaximum(inputElement) - getMinimum(inputElement);

    const requestedValue = startValue + movement * (valueRange / 240);

    setValue(requestedValue);
  }

  function endDrag(event) {
    if (activePointerId === null || event.pointerId !== activePointerId) {
      return;
    }

    if (knobElement.hasPointerCapture(activePointerId)) {
      knobElement.releasePointerCapture(activePointerId);
    }

    activePointerId = null;

    knobElement.classList.remove("is-dragging");

    inputElement.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }

  function handleKeyboard(event) {
    if (inputElement.disabled) {
      return;
    }

    const currentValue = Number(inputElement.value);

    const step = getStep(inputElement);

    let nextValue = null;

    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        nextValue = currentValue + step;
        break;

      case "ArrowDown":
      case "ArrowLeft":
        nextValue = currentValue - step;
        break;

      case "PageUp":
        nextValue = currentValue + step * 10;
        break;

      case "PageDown":
        nextValue = currentValue - step * 10;
        break;

      case "Home":
        nextValue = getMinimum(inputElement);
        break;

      case "End":
        nextValue = getMaximum(inputElement);
        break;

      default:
        return;
    }

    event.preventDefault();

    setValue(nextValue, true);
  }

  function resetToDefault() {
    if (inputElement.disabled) {
      return;
    }

    const defaultValue = Number(knobElement.dataset.default ?? inputElement.defaultValue);

    setValue(defaultValue, true);
  }

  knobElement.addEventListener("pointerdown", beginDrag);

  knobElement.addEventListener("pointermove", continueDrag);

  knobElement.addEventListener("pointerup", endDrag);

  knobElement.addEventListener("pointercancel", endDrag);

  knobElement.addEventListener("keydown", handleKeyboard);

  knobElement.addEventListener("dblclick", resetToDefault);

  return {
    refresh,
  };
}

function getMinimum(inputElement) {
  const minimum = Number(inputElement.min);

  return Number.isFinite(minimum) ? minimum : 0;
}

function getMaximum(inputElement) {
  const maximum = Number(inputElement.max);

  return Number.isFinite(maximum) ? maximum : 100;
}

function getStep(inputElement) {
  const step = Number(inputElement.step);

  return Number.isFinite(step) && step > 0 ? step : 1;
}

function getDecimalPrecision(value) {
  const valueString = String(value);

  if (valueString.includes("e-")) {
    return Number(valueString.split("e-")[1]);
  }

  const decimalPart = valueString.split(".")[1];

  return decimalPart ? decimalPart.length : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}
