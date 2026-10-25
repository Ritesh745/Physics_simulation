
// ============================================
// PHYSICS SIMULATION LAB
// Main JavaScript: script.js
// ============================================

"use strict";

// ---------- 1. Get HTML Elements ----------

const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");

const simulationTabs = document.querySelectorAll(".simulation-tab");

const simulationTitle = document.getElementById("simulationTitle");
const simulationDescription = document.getElementById("simulationDescription");

const startButton = document.getElementById("startBtn");
const pauseButton = document.getElementById("pauseBtn");
const resetButton = document.getElementById("resetBtn");

const controlsContainer = document.getElementById("controlsContainer");

const resultsContainer = document.getElementById("resultsContainer");
const equationContainer = document.getElementById("equationContainer");


// ---------- 2. Simulation State ----------

let currentSimulation = "projectile";
let animationId = null;
let isRunning = false;
let elapsedTime = 0;
let lastFrameTime = 0;

const GRAVITY = 9.8;

const simulationState = {
    projectile: {
        speed: 25,
        angle: 45,
        height: 0
    },

    pendulum: {
        length: 2,
        angle: 30,
        gravity: 9.8
    },

    electric: {
        charge: 1,
        separation: 2
    }
};


// ---------- 3. Utility Functions ----------

function formatNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) {
        return "—";
    }

    return value.toFixed(decimals);
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground() {
    clearCanvas();

    ctx.fillStyle = "#080f20";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.09)";
    ctx.lineWidth = 1;

    const gridSize = 40;

    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawText(text, x, y, color = "#f1f5f9", size = 14) {
    ctx.fillStyle = color;
    ctx.font = `${size}px Arial`;
    ctx.fillText(text, x, y);
}

function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(x1, y1, x2, y2, color, width = 2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

function drawArrow(x1, y1, x2, y2, color, width = 2) {
    drawLine(x1, y1, x2, y2, color, width);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 9;

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
    ctx.fillStyle = color;
    ctx.fill();
}

function updateResultCards(results) {
    resultsContainer.innerHTML = "";

    results.forEach(result => {
        const card = document.createElement("div");
        card.className = "result-card";

        const label = document.createElement("p");
        label.textContent = result.label;

        const value = document.createElement("h4");
        value.textContent = result.value;

        const unit = document.createElement("span");
        unit.textContent = result.unit || "";

        card.append(label, value, unit);
        resultsContainer.appendChild(card);
    });
}

function updateEquations(equations) {
    equationContainer.innerHTML = "";

    equations.forEach(item => {
        const equation = document.createElement("div");
        equation.className = "equation";
        equation.textContent = item.formula;

        const description = document.createElement("p");
        description.className = "equation-description";
        description.textContent = item.description;

        equationContainer.append(equation, description);
    });
}

function updateControlValue(id, value) {
    const output = document.getElementById(id);

    if (output) {
        output.textContent = value;
    }
}

function updateStatus(text) {
    const status = document.querySelector(".status-badge");

    if (status) {
        status.textContent = text;
    }
}


// ---------- 4. Responsive Canvas ----------

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);

    // Draw using CSS pixel coordinates
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    renderSimulation();
}

function getCanvasSize() {
    const rect = canvas.getBoundingClientRect();

    return {
        width: rect.width,
        height: rect.height
    };
}


// ---------- 5. Projectile Motion ----------

function calculateProjectile() {
    const { speed, angle, height } = simulationState.projectile;

    const theta = degreesToRadians(angle);

    const horizontalVelocity = speed * Math.cos(theta);
    const verticalVelocity = speed * Math.sin(theta);

    // Solve height + vy*t - 0.5*g*t^2 = 0
    const flightTime = (
        verticalVelocity +
        Math.sqrt(
            verticalVelocity * verticalVelocity +
            2 * GRAVITY * height
        )
    ) / GRAVITY;

    const range = horizontalVelocity * flightTime;

    const maximumHeight =
        height +
        (verticalVelocity * verticalVelocity) / (2 * GRAVITY);

    return {
        horizontalVelocity,
        verticalVelocity,
        flightTime,
        range,
        maximumHeight
    };
}

function drawProjectile() {
    drawBackground();

    const { width, height } = getCanvasSize();
    const p = simulationState.projectile;
    const result = calculateProjectile();

    const marginLeft = 45;
    const marginRight = 30;
    const marginTop = 35;
    const groundY = height - 45;

    const availableWidth = width - marginLeft - marginRight;
    const availableHeight = groundY - marginTop;

    // Scale the drawing to fit the canvas
    const scaleX = availableWidth / Math.max(result.range, 1);
    const scaleY = availableHeight / Math.max(result.maximumHeight, 1);

    const scale = Math.min(scaleX, scaleY);

    const originX = marginLeft;
    const originY = groundY - p.height * scale;

    // Ground
    drawLine(
        15, groundY,
        width - 15, groundY,
        "#64748b", 2
    );

    drawText("Ground", width - 75, groundY + 25, "#94a3b8", 11);

    // Axes
    drawArrow(
        originX, groundY,
        width - 15, groundY,
        "#64748b", 1.5
    );

    drawArrow(
        originX, groundY,
        originX, 15,
        "#64748b", 1.5
    );

    drawText("x", width - 23, groundY - 10, "#94a3b8", 12);
    drawText("y", originX + 10, 20, "#94a3b8", 12);

    // Draw trajectory
    ctx.beginPath();

    const steps = 100;

    for (let i = 0; i <= steps; i++) {
        const t = result.flightTime * i / steps;

        const x = result.horizontalVelocity * t;
        const y =
            p.height +
            result.verticalVelocity * t -
            0.5 * GRAVITY * t * t;

        const canvasX = originX + x * scale;
        const canvasY = groundY - y * scale;

        if (i === 0) {
            ctx.moveTo(canvasX, canvasY);
        } else {
            ctx.lineTo(canvasX, canvasY);
        }
    }

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Launch point
    drawCircle(originX, originY, 5, "#34d399");

    // Current projectile position
    const t = Math.min(elapsedTime, result.flightTime);

    const x = result.horizontalVelocity * t;

    const y =
        p.height +
        result.verticalVelocity * t -
        0.5 * GRAVITY * t * t;

    const ballX = originX + x * scale;
    const ballY = groundY - Math.max(y, 0) * scale;

    // Velocity components at current time
    const currentVerticalVelocity =
        result.verticalVelocity - GRAVITY * t;

    drawCircle(ballX, ballY, 8, "#fb7185");

    // Velocity vector
    const vectorScale = 0.65;

    drawArrow(
        ballX,
        ballY,
        ballX + result.horizontalVelocity * vectorScale,
        ballY - currentVerticalVelocity * vectorScale,
        "#fbbf24",
        2
    );

    drawText("Velocity", ballX + 12, ballY - 12, "#fbbf24", 11);

    // Landing point
    const landingX = originX + result.range * scale;

    drawCircle(landingX, groundY, 4, "#818cf8");

    drawText(
        "Range",
        Math.min(landingX - 20, width - 70),
        groundY - 12,
        "#818cf8",
        11
    );

    // Display time
    drawText(
        `Time: ${formatNumber(t)} s`,
        15, 25, "#f1f5f9", 13
    );

    // Results
    updateResultCards([
        {
            label: "Horizontal Range",
            value: formatNumber(result.range),
            unit: "metres"
        },
        {
            label: "Maximum Height",
            value: formatNumber(result.maximumHeight),
            unit: "metres"
        },
        {
            label: "Flight Time",
            value: formatNumber(result.flightTime),
            unit: "seconds"
        }
    ]);

    updateEquations([
        {
            formula: "uₓ = u cos θ",
            description: "Horizontal velocity remains constant when air resistance is neglected."
        },
        {
            formula: "uᵧ = u sin θ",
            description: "Initial vertical velocity determines the vertical motion."
        },
        {
            formula: "y = h + uᵧt − ½gt²",
            description: "Vertical position as a function of time."
        },
        {
            formula: "R = uₓ × T",
            description: "Horizontal range equals horizontal velocity multiplied by flight time."
        }
    ]);
}


// ---------- 6. Simple Pendulum ----------

function calculatePendulum() {
    const { length, angle, gravity } = simulationState.pendulum;

    // Small-angle approximation
    const period = 2 * Math.PI * Math.sqrt(length / gravity);

    const amplitude = degreesToRadians(angle);

    return {
        period,
        frequency: 1 / period,
        amplitude
    };
}

function drawPendulum() {
    drawBackground();

    const { width, height } = getCanvasSize();
    const p = simulationState.pendulum;
    const result = calculatePendulum();

    const pivotX = width / 2;
    const pivotY = Math.max(50, height * 0.18);

    // Scale rod length for visual display
    const rodLength = Math.min(
        height * 0.56,
        width * 0.42,
        220
    );

    // Angular position
    const angularFrequency = Math.sqrt(p.gravity / p.length);

    const theta =
        result.amplitude *
        Math.cos(angularFrequency * elapsedTime);

    const bobX = pivotX + rodLength * Math.sin(theta);
    const bobY = pivotY + rodLength * Math.cos(theta);

    // Support
    drawLine(
        pivotX - 45, pivotY,
        pivotX + 45, pivotY,
        "#94a3b8", 4
    );

    // Ceiling hatch marks
    for (let i = -35; i <= 35; i += 10) {
        drawLine(
            pivotX + i, pivotY,
            pivotX + i - 8, pivotY - 8,
            "#64748b", 1
        );
    }

    // Vertical reference line
    ctx.save();
    ctx.setLineDash([5, 6]);

    drawLine(
        pivotX, pivotY,
        pivotX, pivotY + rodLength,
        "#475569", 1
    );

    ctx.restore();

    // Pendulum rod
    drawLine(
        pivotX, pivotY,
        bobX, bobY,
        "#38bdf8", 3
    );

    // Pivot
    drawCircle(pivotX, pivotY, 6, "#f1f5f9");

    // Bob
    drawCircle(bobX, bobY, 18, "#818cf8");

    // Bob highlight
    drawCircle(
        bobX - 5,
        bobY - 6,
        5,
        "#c7d2fe"
    );

    // Angle indicator
    drawText(
        `θ = ${formatNumber(theta * 180 / Math.PI, 1)}°`,
        pivotX + 15,
        pivotY + 35,
        "#fbbf24",
        13
    );

    // Length label
    drawText(
        `L = ${formatNumber(p.length)} m`,
        pivotX + 12,
        (pivotY + bobY) / 2,
        "#38bdf8",
        12
    );

    // Gravity arrow
    drawArrow(
        bobX + 30, bobY + 5,
        bobX + 30, bobY + 45,
        "#fb7185", 2
    );

    drawText(
        "g",
        bobX + 38,
        bobY + 32,
        "#fb7185",
        13
    );

    drawText(
        `Time: ${formatNumber(elapsedTime)} s`,
        15, 25,
        "#f1f5f9",
        13
    );

    updateResultCards([
        {
            label: "Time Period",
            value: formatNumber(result.period),
            unit: "seconds"
        },
        {
            label: "Frequency",
            value: formatNumber(result.frequency),
            unit: "hertz"
        },
        {
            label: "Angular Frequency",
            value: formatNumber(angularFrequency),
            unit: "rad/s"
        }
    ]);

    updateEquations([
        {
            formula: "T = 2π√(L/g)",
            description: "Time period of a simple pendulum for small oscillations."
        },
        {
            formula: "f = 1/T",
            description: "Frequency is the reciprocal of the time period."
        },
        {
            formula: "ω = √(g/L)",
            description: "Angular frequency in the small-angle approximation."
        },
        {
            formula: "θ(t) ≈ θ₀ cos(ωt)",
            description: "Approximate angular displacement during simple harmonic motion."
        }
    ]);
}


// ---------- 7. Electric Field ----------

function drawElectricField() {
    drawBackground();

    const { width, height } = getCanvasSize();
    const p = simulationState.electric;

    const centerX = width / 2;
    const centerY = height / 2;

    const separationPixels = Math.min(
        p.separation * 45,
        width * 0.3
    );

    const chargeRadius = 18;

    const leftX = centerX - separationPixels / 2;
    const rightX = centerX + separationPixels / 2;

    const chargeColor = p.charge >= 0 ? "#fb7185" : "#38bdf8";

    // Draw schematic field lines for a dipole.
    // This is a qualitative illustration, not a numerical field solver.

    const lineCount = 12;

    for (let i = 0; i < lineCount; i++) {
        const fraction = (i + 1) / (lineCount + 1);

        const startY = centerY - (height * 0.38) +
            fraction * (height * 0.76);

        const endY = centerY +
            (fraction - 0.5) * height * 0.5;

        ctx.beginPath();
        ctx.moveTo(leftX, centerY);

        const controlX = centerX;
        const controlY = startY;

        ctx.quadraticCurveTo(
            controlX,
            controlY,
            rightX,
            endY
        );

        ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrowhead along the curve, pointing toward the right charge
        const t = 0.72;

        const arrowX =
            (1 - t) * (1 - t) * leftX +
            2 * (1 - t) * t * controlX +
            t * t * rightX;

        const arrowY =
            (1 - t) * (1 - t) * centerY +
            2 * (1 - t) * t * controlY +
            t * t * endY;

        const derivativeX =
            2 * (1 - t) * (controlX - leftX) +
            2 * t * (rightX - controlX);

        const derivativeY =
            2 * (1 - t) * (controlY - centerY) +
            2 * t * (endY - controlY);

        const arrowAngle = Math.atan2(derivativeY, derivativeX);
        const head = 7;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);

        ctx.lineTo(
            arrowX - head * Math.cos(arrowAngle - Math.PI / 6),
            arrowY - head * Math.sin(arrowAngle - Math.PI / 6)
        );

        ctx.lineTo(
            arrowX - head * Math.cos(arrowAngle + Math.PI / 6),
            arrowY - head * Math.sin(arrowAngle + Math.PI / 6)
        );

        ctx.closePath();
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
    }

    // Charges
    drawCircle(leftX, centerY, chargeRadius, chargeColor);
    drawCircle(rightX, centerY, chargeRadius, "#38bdf8");

    // Charge labels
    drawText(
        p.charge >= 0 ? "+" : "−",
        leftX - 5,
        centerY + 6,
        "#ffffff",
        20
    );

    drawText(
        p.charge >= 0 ? "−" : "+",
        rightX - 5,
        centerY + 6,
        "#ffffff",
        20
    );

    // Separation label
    drawLine(
        leftX, centerY + 40,
        rightX, centerY + 40,
        "#94a3b8", 1
    );

    drawLine(
        leftX, centerY + 33,
        leftX, centerY + 47,
        "#94a3b8", 1
    );

    drawLine(
        rightX, centerY + 33,
        rightX, centerY + 47,
        "#94a3b8", 1
    );

    drawText(
        `d = ${formatNumber(p.separation)} m`,
        centerX - 40,
        centerY + 62,
        "#f1f5f9",
        12
    );

    drawText(
        "Schematic electric field illustration",
        15,
        25,
        "#94a3b8",
        12
    );

    // Ideal point-charge field magnitude at distance r
    // E = k|q|/r², using the charge magnitude in microcoulombs.
    const k = 8.99e9;
    const chargeCoulombs = Math.abs(p.charge) * 1e-6;
    const distance = Math.max(p.separation, 0.01);

    const fieldMagnitude =
        k * chargeCoulombs / (distance * distance);

    updateResultCards([
        {
            label: "Charge Magnitude",
            value: formatNumber(Math.abs(p.charge), 2),
            unit: "microcoulombs (μC)"
        },
        {
            label: "Separation",
            value: formatNumber(p.separation),
            unit: "metres"
        },
        {
            label: "Field Scale",
            value: fieldMagnitude.toExponential(2),
            unit: "N/C at distance d"
        }
    ]);

    updateEquations([
        {
            formula: "E = k|q|/r²",
            description: "Electric field magnitude of an isolated point charge at distance r."
        },
        {
            formula: "k ≈ 8.99 × 10⁹ N·m²/C²",
            description: "Coulomb's constant in vacuum."
        },
        {
            formula: "E⃗total = E⃗₁ + E⃗₂",
            description: "Electric fields add vectorially according to the superposition principle."
        },
        {
            formula: "F⃗ = qE⃗",
            description: "Electric force on a charge placed in an electric field."
        }
    ]);
}


// ---------- 8. Render Selected Simulation ----------

function renderSimulation() {
    if (!canvas || !ctx) {
        return;
    }

    if (currentSimulation === "projectile") {
        drawProjectile();
    } else if (currentSimulation === "pendulum") {
        drawPendulum();
    } else if (currentSimulation === "electric") {
        drawElectricField();
    }
}


// ---------- 9. Animation Loop ----------

function animate(timestamp) {
    if (!isRunning) {
        return;
    }

    if (!lastFrameTime) {
        lastFrameTime = timestamp;
    }

    // Prevent large jumps when a browser tab becomes inactive
    const deltaTime = Math.min(
        (timestamp - lastFrameTime) / 1000,
        0.05
    );

    lastFrameTime = timestamp;

    elapsedTime += deltaTime;

    // Stop projectile animation after it lands
    if (currentSimulation === "projectile") {
        const result = calculateProjectile();

        if (elapsedTime >= result.flightTime) {
            elapsedTime = result.flightTime;
            isRunning = false;
            updateStatus("Finished");
        }
   