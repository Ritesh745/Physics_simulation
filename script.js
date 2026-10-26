
/* =========================================================
   PHYSICS LAB — script.js
   Experiments:
   1. Projectile Motion
   2. Simple Pendulum
   3. Electric Field

   Save this file as: script.js
   ========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------------------------------------
  // 1. GET HTML ELEMENTS
  // -------------------------------------------------------

  const canvas =
    document.getElementById("physics-canvas") ||
    document.getElementById("simulationCanvas");

  if (!canvas) {
    console.error(
      "Physics Lab: Canvas not found. Check your HTML canvas ID."
    );
    return;
  }

  const ctx = canvas.getContext("2d");

  const startButton =
    document.getElementById("start-button") ||
    document.getElementById("startButton");

  const pauseButton =
    document.getElementById("pause-button") ||
    document.getElementById("pauseButton");

  const resetButton =
    document.getElementById("reset-button") ||
    document.getElementById("resetButton");

  const experimentCards = document.querySelectorAll(
    "[data-experiment], [data-simulation]"
  );

  const panels = {
    projectile:
      document.getElementById("projectile-controls") ||
      document.getElementById("projectileControls"),
    pendulum:
      document.getElementById("pendulum-controls") ||
      document.getElementById("pendulumControls"),
    electric:
      document.getElementById("electric-controls") ||
      document.getElementById("electricControls")
  };

  // Supports both naming styles used by the HTML versions.
  function getElement(...ids) {
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }
    return null;
  }

  function getNumber(ids, fallback) {
    const element = getElement(...ids);
    if (!element) return fallback;

    const value = Number(element.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function updateText(ids, value) {
    const element = getElement(...ids);
    if (element) element.textContent = value;
  }

  function readControl(ids, fallback) {
    return getNumber(ids, fallback);
  }

  // -------------------------------------------------------
  // 2. SIMULATION STATE
  // -------------------------------------------------------

  let activeExperiment = "projectile";
  let isRunning = false;
  let animationFrame = null;
  let previousTimestamp = 0;
  let elapsedTime = 0;
  let lastWidth = 0;
  let lastHeight = 0;

  // Simulation speed multiplier.
  const timeScale = 1;

  // Projectile path is stored in physical coordinates.
  let projectilePath = [];
  let projectileFinished = false;

  // Electric charge positions, in canvas coordinates.
  let charges = [];

  // -------------------------------------------------------
  // 3. COLORS AND HELPERS
  // -------------------------------------------------------

  const COLORS = {
    background: "#07111f",
    grid: "rgba(100, 160, 210, 0.12)",
    cyan: "#38e8ff",
    blue: "#4e8cff",
    purple: "#b18cff",
    orange: "#ffad66",
    green: "#5df2ad",
    red: "#ff657a",
    white: "#eef7ff",
    muted: "#8ba4bd"
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function format(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";
    return value.toFixed(digits);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    const width = Math.max(300, rect.width || 800);
    const height = Math.max(280, rect.height || 480);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    lastWidth = width;
    lastHeight = height;

    drawCurrentExperiment();
  }

  function canvasSize() {
    const rect = canvas.getBoundingClientRect();

    return {
      width: rect.width || lastWidth || 800,
      height: rect.height || lastHeight || 480
    };
  }

  function clearCanvas() {
    const { width, height } = canvasSize();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    drawGrid(width, height);
  }

  function drawGrid(width, height) {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    const spacing = 30;

    for (let x = 0; x <= width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawText(text, x, y, color = COLORS.white, size = 13) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawCircle(x, y, radius, color, glow = true) {
    ctx.save();

    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  function drawLine(x1, y1, x2, y2, color, width = 2, dash = []) {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();

    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2, color, width = 2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 9;

    drawLine(x1, y1, x2, y2, color, width);

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // -------------------------------------------------------
  // 4. INPUT CONTROLS
  // -------------------------------------------------------

  function projectileSettings() {
    return {
      speed: Math.max(
        0,
        readControl(
          ["projectile-speed", "speed"],
          25
        )
      ),
      angle: clamp(
        readControl(
          ["projectile-angle", "angle"],
          45
        ),
        0,
        90
      ),
      gravity: Math.max(
        0.01,
        readControl(
          ["projectile-gravity", "gravity"],
          9.8
        )
      )
    };
  }

  function pendulumSettings() {
    return {
      length: clamp(
        readControl(
          ["pendulum-length", "length"],
          1
        ),
        0.1,
        10
      ),
      gravity: Math.max(
        0.01,
        readControl(
          ["pendulum-gravity", "pendulumGravity"],
          9.8
        )
      ),
      angle: clamp(
        readControl(
          ["pendulum-angle", "amplitude"],
          25
        ),
        -80,
        80
      )
    };
  }

  function electricSettings() {
    return {
      charge: readControl(
        ["electric-charge", "charge"],
        1
      ),
      distance: Math.max(
        0.1,
        readControl(
          ["electric-distance", "distance"],
          2
        )
      ),
      testCharge: readControl(
        ["electric-test-charge", "test-charge"],
        1
      )
    };
  }

  // -------------------------------------------------------
  // 5. SELECT AN EXPERIMENT
  // -------------------------------------------------------

  function selectExperiment(name) {
    if (!["projectile", "pendulum", "electric"].includes(name)) {
      return;
    }

    activeExperiment = name;
    isRunning = false;
    elapsedTime = 0;
    previousTimestamp = 0;
    projectileFinished = false;
    projectilePath = [];

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    // Show the correct control panel.
    Object.entries(panels).forEach(([key, panel]) => {
      if (panel) {
        panel.hidden = key !== name;
        panel.style.display = key === name ? "" : "none";
      }
    });

    // Highlight the selected experiment card or tab.
    experimentCards.forEach((card) => {
      const cardName =
        card.dataset.experiment ||
        card.dataset.simulation;

      const selected = cardName === name;

      card.classList.toggle("active", selected);
      card.classList.toggle("selected", selected);

      if (selected) {
        card.setAttribute("aria-pressed", "true");
      } else {
        card.setAttribute("aria-pressed", "false");
      }
    });

    updateTheory();
    updateControlValues();
    updateResults();
    drawCurrentExperiment();
    updateButtonState();
  }

  experimentCards.forEach((card) => {
    card.addEventListener("click", () => {
      const name =
        card.dataset.experiment ||
        card.dataset.simulation;

      if (name) selectExperiment(name);
    });
  });

  // -------------------------------------------------------
  // 6. UPDATE SLIDER LABELS
  // -------------------------------------------------------

  function updateControlValues() {
    const p = projectileSettings();
    const pend = pendulumSettings();
    const e = electricSettings();

    updateText(
      ["projectile-speed-value", "speedValue"],
      `${format(p.speed, 1)} m/s`
    );

    updateText(
      ["projectile-angle-value", "angleValue"],
      `${format(p.angle, 0)}°`
    );

    updateText(
      ["projectile-gravity-value", "gravityValue"],
      `${format(p.gravity, 2)} m/s²`
    );

    updateText(
      ["pendulum-length-value", "lengthValue"],
      `${format(pend.length, 2)} m`
    );

    updateText(
      ["pendulum-gravity-value", "pendulumGravityValue"],
      `${format(pend.gravity, 2)} m/s²`
    );

    updateText(
      ["pendulum-angle-value", "amplitudeValue"],
      `${format(pend.angle, 0)}°`
    );

    updateText(
      ["electric-charge-value", "chargeValue"],
      `${format(e.charge, 2)} μC`
    );

    updateText(
      ["electric-distance-value", "distanceValue"],
      `${format(e.distance, 2)} m`
    );

    updateText(
      ["electric-test-charge-value", "testChargeValue"],
      `${format(e.testCharge, 2)} μC`
    );
  }

  const controlIds = [
    "projectile-speed",
    "projectile-angle",
    "projectile-gravity",
    "pendulum-length",
    "pendulum-gravity",
    "pendulum-angle",
    "electric-charge",
    "electric-distance",
    "electric-test-charge",

    // Alternate IDs used by the earlier HTML.
    "speed",
    "angle",
    "gravity",
    "length",
    "amplitude",
    "pendulumGravity",
    "charge",
    "distance",
    "test-charge"
  ];

  controlIds.forEach((id) => {
    const control = document.getElementById(id);

    if (control) {
      control.addEventListener("input", () => {
        updateControlValues();
        updateResults();

        // Update the picture immediately when paused.
        if (!isRunning) {
          drawCurrentExperiment();
        }
      });
    }
  });

  // -------------------------------------------------------
  // 7. PROJECTILE MOTION
  // -------------------------------------------------------

  function projectileCalculations() {
    const { speed, angle, gravity } = projectileSettings();
    const radians = angle * Math.PI / 180;

    const vx = speed * Math.cos(radians);
    const vy = speed * Math.sin(radians);

    const flightTime = (2 * vy) / gravity;
    const range = vx * flightTime;
    const maxHeight = (vy * vy) / (2 * gravity);

    const t = Math.min(elapsedTime, Math.max(0, flightTime));

    const x = vx * t;
    const y = vy * t - 0.5 * gravity * t * t;
    const verticalVelocity = vy - gravity * t;

    return {
      speed,
      angle,
      gravity,
      vx,
      vy,
      flightTime,
      range,
      maxHeight,
      x,
      y: Math.max(0, y),
      verticalVelocity,
      time: t
    };
  }

  function drawProjectile() {
    clearCanvas();

    const { width, height } = canvasSize();
    const data = projectileCalculations();

    const marginLeft = 55;
    const marginRight = 35;
    const marginTop = 35;
    const groundY = height - 55;

    const availableWidth = width - marginLeft - marginRight;
    const availableHeight = groundY - marginTop;

    const displayRange = Math.max(data.range, 1);
    const displayHeight = Math.max(data.maxHeight, 1);

    // Scale the trajectory to fit the canvas.
    const scaleX = availableWidth / (displayRange * 1.15);
    const scaleY = availableHeight / (displayHeight * 1.35);
    const scale = Math.min(scaleX, scaleY);

    const originX = marginLeft;
    const originY = groundY;

    // Ground.
    drawLine(
      originX,
      groundY,
      width - marginRight,
      groundY,
      COLORS.muted,
      2
    );

    // Horizontal and vertical axes.
    drawArrow(
      originX,
      originY,
      width - 18,
      originY,
      COLORS.muted,
      1.5
    );

    drawArrow(
      originX,
      originY,
      originX,
      18,
      COLORS.muted,
      1.5
    );

    drawText("x (m)", width - 48, groundY + 28, COLORS.muted, 11);
    drawText("y (m)", originX - 35, 20, COLORS.muted, 11);

    // Draw the theoretical trajectory.
    const trajectoryPoints = [];
    const steps = 100;

    for (let i = 0; i <= steps; i++) {
      const t = data.flightTime * i / steps;
      const x = data.vx * t;
      const y = data.vy * t - 0.5 * data.gravity * t * t;

      trajectoryPoints.push({
        x: originX + x * scale,
        y: originY - Math.max(0, y) * scale
      });
    }

    ctx.save();
    ctx.beginPath();

    trajectoryPoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.strokeStyle = "rgba(56, 232, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.restore();

    // Draw the path travelled so far.
    const actualTime = data.flightTime > 0
      ? Math.min(elapsedTime, data.flightTime)
      : 0;

    ctx.save();
    ctx.beginPath();

    const actualSteps = Math.max(
      2,
      Math.ceil(100 * actualTime / Math.max(data.flightTime, 0.001))
    );

    for (let i = 0; i <= actualSteps; i++) {
      const t = actualTime * i / actualSteps;
      const x = data.vx * t;
      const y = Math.max(
        0,
        data.vy * t - 0.5 * data.gravity * t * t
      );

      const px = originX + x * scale;
      const py = originY - y * scale;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Initial velocity vector.
    const launchRadians = data.angle * Math.PI / 180;
    const arrowLength = 48;

    drawArrow(
      originX,
      originY,
      originX + arrowLength * Math.cos(launchRadians),
      originY - arrowLength * Math.sin(launchRadians),
      COLORS.orange,
      2
    );

    drawText(
      `Launch: ${format(data.speed, 1)} m/s`,
      originX + 12,
      originY - 45,
      COLORS.orange,
      12
    );

    // Current projectile position.
    const ballX = originX + data.x * scale;
    const ballY = originY - data.y * scale;

    drawCircle(ballX, ballY, 7, COLORS.cyan);

    // Height marker.
    if (data.y > 0.1) {
      drawLine(
        ballX,
        ballY,
        ballX,
        groundY,
        "rgba(177, 140, 255, 0.6)",
        1,
        [4, 4]
      );
    }

    // Apex marker.
    const apexX = originX + (data.range / 2) * scale;
    const apexY = originY - data.maxHeight * scale;

    drawCircle(apexX, apexY, 4, COLORS.purple, false);

    drawText(
      `Max height: ${format(data.maxHeight)} m`,
      Math.min(apexX + 12, width - 185),
      Math.max(18, apexY - 12),
      COLORS.purple,
      11
    );

    drawText(
      `Range: ${format(data.range)} m`,
      Math.min(originX + data.range * scale - 100, width - 150),
      groundY - 10,
      COLORS.green,
      11
    );

    drawText(
      `t = ${format(data.time)} s`,
      16,
      25,
      COLORS.white,
      13
    );
  }

  // -------------------------------------------------------
  // 8. SIMPLE PENDULUM
  // -------------------------------------------------------

  function pendulumCalculations() {
    const { length, gravity, angle } = pendulumSettings();

    // Small-angle approximation for the time period.
    const period = 2 * Math.PI * Math.sqrt(length / gravity);
    const frequency = 1 / period;

    const initialAngle = angle * Math.PI / 180;

    // Ideal simple harmonic approximation.
    const currentAngle = initialAngle *
      Math.cos(2 * Math.PI * elapsedTime / period);

    const angularVelocity = -initialAngle *
      (2 * Math.PI / period) *
      Math.sin(2 * Math.PI * elapsedTime / period);

    const potentialEnergyFactor =
      1 - Math.cos(currentAngle);

    return {
      length,
      gravity,
      initialAngle,
      currentAngle,
      period,
      frequency,
      angularVelocity,
      potentialEnergyFactor
    };
  }

  function drawPendulum() {
    clearCanvas();

    const { width, height } = canvasSize();
    const data = pendulumCalculations();

    const pivotX = width / 2;
    const pivotY = Math.max(55, height * 0.17);

    const rodLength = Math.min(
      height * 0.58,
      width * 0.38,
      data.length * 100
    );

    const angle = data.currentAngle;

    const bobX = pivotX + rodLength * Math.sin(angle);
    const bobY = pivotY + rodLength * Math.cos(angle);

    // Pivot support.
    drawLine(
      pivotX - 70,
      pivotY - 12,
      pivotX + 70,
      pivotY - 12,
      COLORS.muted,
      3
    );

    drawLine(
      pivotX,
      pivotY - 12,
      pivotX,
      pivotY,
      COLORS.muted,
      3
    );

    drawCircle(pivotX, pivotY, 5, COLORS.orange);

    // Vertical equilibrium line.
    drawLine(
      pivotX,
      pivotY,
      pivotX,
      pivotY + rodLength + 15,
      "rgba(139, 164, 189, 0.4)",
      1,
      [5, 6]
    );

    // Maximum angle guide.
    const maxX = pivotX + rodLength * Math.sin(data.initialAngle);
    const maxY = pivotY + rodLength * Math.cos(data.initialAngle);

    drawLine(
      pivotX,
      pivotY,
      maxX,
      maxY,
      "rgba(177, 140, 255, 0.35)",
      1,
      [4, 5]
    );

    // Rod.
    drawLine(
      pivotX,
      pivotY,
      bobX,
      bobY,
      COLORS.cyan,
      3
    );

    // Pendulum bob.
    drawCircle(bobX, bobY, 17, COLORS.purple);

    // Draw the angle arc.
    ctx.save();
    ctx.beginPath();

    const arcRadius = 40;
    const startAngle = Math.PI / 2;
    const endAngle = Math.PI / 2 - angle;

    ctx.arc(
      pivotX,
      pivotY,
      arcRadius,
      Math.min(startAngle, endAngle),
      Math.max(startAngle, endAngle)
    );

    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    drawText(
      `θ = ${format(angle * 180 / Math.PI, 1)}°`,
      pivotX + 45,
      pivotY + 38,
      COLORS.orange,
      12
    );

    drawText(
      `L = ${format(data.length)} m`,
      pivotX + 12,
      pivotY + rodLength * 0.48,
      COLORS.cyan,
      12
    );

    drawText(
      `Time: ${format(elapsedTime)} s`,
      16,
      25,
      COLORS.white,
      13
    );

    drawText(
      `Period: ${format(data.period)} s`,
      16,
      46,
      COLORS.green,
      12
    );
  }

  // -------------------------------------------------------
  // 9. ELECTRIC FIELD
  // -------------------