const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const overlayElement = document.getElementById("overlay");
const messageElement = document.getElementById("message");
const powerStatusElement = document.getElementById("powerStatus");

const config = {
  paddle: {
    width: 132,
    height: 16,
    speed: 8,
  },
  ball: {
    radius: 9,
    speed: 5.5,
  },
  powerups: {
    size: 28,
    speed: 2.7,
    dropChance: 0.22,
    widePaddleDuration: 12000,
    widePaddleBonus: 64,
  },
  bricks: {
    rows: 6,
    cols: 10,
    width: 70,
    height: 24,
    padding: 10,
    offsetTop: 72,
    offsetLeft: 25,
  },
};

const brickPalette = [
  "#f0b429",
  "#ef6f6c",
  "#51d0de",
  "#7bd389",
  "#9b5de5",
  "#ff9f1c",
];

const powerupTypes = {
  tripleBall: {
    label: "3x",
    color: "#51d0de",
    message: "Triple ball collected.",
  },
  widePaddle: {
    label: "Wide",
    color: "#7bd389",
    message: "Paddle widened.",
  },
};

const state = {
  running: false,
  level: 1,
  score: 0,
  lives: 3,
  keys: {
    left: false,
    right: false,
  },
  paddle: {
    x: (canvas.width - config.paddle.width) / 2,
    y: canvas.height - 42,
    baseWidth: config.paddle.width,
    width: config.paddle.width,
    height: config.paddle.height,
  },
  balls: [
    {
      x: canvas.width / 2,
      y: canvas.height - 56,
      dx: config.ball.speed,
      dy: -config.ball.speed,
      radius: config.ball.radius,
    },
  ],
  powerups: [],
  effects: {
    widePaddleUntil: 0,
  },
  bricks: [],
};

function createBall(x, y, dx, dy) {
  return {
    x,
    y,
    dx,
    dy,
    radius: config.ball.radius,
  };
}

function buildBricks() {
  state.bricks = [];

  for (let row = 0; row < config.bricks.rows; row += 1) {
    for (let col = 0; col < config.bricks.cols; col += 1) {
      const x =
        config.bricks.offsetLeft +
        col * (config.bricks.width + config.bricks.padding);
      const y =
        config.bricks.offsetTop +
        row * (config.bricks.height + config.bricks.padding);

      state.bricks.push({
        x,
        y,
        width: config.bricks.width,
        height: config.bricks.height,
        hitsLeft: 1,
        color: brickPalette[(row + col) % brickPalette.length],
        powerupType:
          Math.random() < config.powerups.dropChance
            ? Math.random() > 0.5
              ? "tripleBall"
              : "widePaddle"
            : null,
      });
    }
  }
}

function resetBalls(stickToPaddle = true) {
  state.balls = [
    createBall(
      state.paddle.x + state.paddle.width / 2,
      state.paddle.y - config.ball.radius - 2,
      config.ball.speed * (Math.random() > 0.5 ? 1 : -1),
      -config.ball.speed,
    ),
  ];

  if (stickToPaddle) {
    state.running = false;
    showOverlay("Press space to launch the ball.");
  }
}

function syncParkedBall() {
  const parkedBall = state.balls[0];

  if (!parkedBall) {
    return;
  }

  parkedBall.x = state.paddle.x + state.paddle.width / 2;
  parkedBall.y = state.paddle.y - parkedBall.radius - 2;
}

function updatePowerStatus(message = "") {
  const remainingWidePaddleMs = Math.max(
    0,
    state.effects.widePaddleUntil - performance.now(),
  );

  if (remainingWidePaddleMs > 0) {
    powerStatusElement.textContent = `${message ? `${message} ` : ""}Wide paddle active for ${Math.ceil(remainingWidePaddleMs / 1000)}s.`;
    return;
  }

  powerStatusElement.textContent =
    message || "Break glowing bricks to drop collectible power-ups.";
}

function refreshPaddleWidth() {
  const widePaddleActive = performance.now() < state.effects.widePaddleUntil;
  state.paddle.width =
    state.paddle.baseWidth +
    (widePaddleActive ? config.powerups.widePaddleBonus : 0);
  clampPaddle();
}

function spawnPowerup(brick) {
  if (!brick.powerupType) {
    return;
  }

  state.powerups.push({
    type: brick.powerupType,
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height / 2,
    size: config.powerups.size,
    speed: config.powerups.speed,
  });
}

function applyTripleBall(sourceBall) {
  const baseSpeed =
    Math.hypot(sourceBall.dx, sourceBall.dy) || config.ball.speed;
  const directionY = sourceBall.dy <= 0 ? -1 : 1;
  const newVelocities = [-0.85, 0, 0.85].map((offset) => ({
    dx: baseSpeed * offset,
    dy:
      -Math.sqrt(Math.max(baseSpeed ** 2 - (baseSpeed * offset) ** 2, 1)) *
      directionY,
  }));

  state.balls = newVelocities.map((velocity) =>
    createBall(sourceBall.x, sourceBall.y, velocity.dx, velocity.dy),
  );
}

function applyPowerup(powerup) {
  if (powerup.type === "tripleBall") {
    applyTripleBall(state.balls[0]);
  }

  if (powerup.type === "widePaddle") {
    state.effects.widePaddleUntil =
      performance.now() + config.powerups.widePaddleDuration;
    refreshPaddleWidth();
  }

  updatePowerStatus(powerupTypes[powerup.type].message);
}

function resetLevel() {
  state.paddle.baseWidth = Math.max(
    84,
    config.paddle.width - (state.level - 1) * 10,
  );
  state.effects.widePaddleUntil = 0;
  refreshPaddleWidth();
  state.paddle.x = (canvas.width - state.paddle.width) / 2;
  state.powerups = [];
  buildBricks();
  resetBalls(true);
  updatePowerStatus();
  updateHud();
}

function restartGame() {
  state.level = 1;
  state.score = 0;
  state.lives = 3;
  resetLevel();
}

function showOverlay(message) {
  messageElement.textContent = message;
  overlayElement.classList.remove("hidden");
}

function hideOverlay() {
  overlayElement.classList.add("hidden");
}

function updateHud() {
  scoreElement.textContent = String(state.score);
  livesElement.textContent = String(state.lives);
  levelElement.textContent = String(state.level);
}

function launchBall() {
  if (state.lives <= 0) {
    restartGame();
  }

  if (!state.running) {
    state.running = true;
    hideOverlay();
  }
}

function clampPaddle() {
  if (state.paddle.x < 0) {
    state.paddle.x = 0;
  }

  const maxX = canvas.width - state.paddle.width;
  if (state.paddle.x > maxX) {
    state.paddle.x = maxX;
  }
}

function movePaddle() {
  if (state.keys.left) {
    state.paddle.x -= config.paddle.speed;
  }

  if (state.keys.right) {
    state.paddle.x += config.paddle.speed;
  }

  clampPaddle();

  if (!state.running) {
    syncParkedBall();
  }
}

function collideWithWalls(ball) {
  const nextX = ball.x + ball.dx;
  const nextY = ball.y + ball.dy;

  if (nextX + ball.radius >= canvas.width || nextX - ball.radius <= 0) {
    ball.dx *= -1;
  }

  if (nextY - ball.radius <= 0) {
    ball.dy *= -1;
  }
}

function collideWithPaddle(ball) {
  const paddleTop = state.paddle.y;
  const paddleBottom = state.paddle.y + state.paddle.height;
  const paddleLeft = state.paddle.x;
  const paddleRight = state.paddle.x + state.paddle.width;

  const ballBottom = ball.y + ball.radius;

  if (
    ballBottom >= paddleTop &&
    ballBottom <= paddleBottom &&
    ball.x >= paddleLeft &&
    ball.x <= paddleRight &&
    ball.dy > 0
  ) {
    const hitPosition = (ball.x - paddleLeft) / state.paddle.width;
    const angle = (hitPosition - 0.5) * Math.PI * 0.75;
    const speed = config.ball.speed + (state.level - 1) * 0.35;

    ball.dx = Math.sin(angle) * speed;
    ball.dy = -Math.cos(angle) * speed;
    ball.y = paddleTop - ball.radius - 1;
  }
}

function collideWithBricks(ball) {
  for (const brick of state.bricks) {
    if (brick.hitsLeft === 0) {
      continue;
    }

    const withinX =
      ball.x + ball.radius >= brick.x &&
      ball.x - ball.radius <= brick.x + brick.width;
    const withinY =
      ball.y + ball.radius >= brick.y &&
      ball.y - ball.radius <= brick.y + brick.height;

    if (!withinX || !withinY) {
      continue;
    }

    brick.hitsLeft = 0;
    state.score += 10;
    ball.dy *= -1;
    spawnPowerup(brick);
    updateHud();

    if (state.bricks.every((item) => item.hitsLeft === 0)) {
      state.level += 1;
      showOverlay("Level cleared. Press space for the next round.");
      resetLevel();
      return "levelCleared";
    }

    return "brickHit";
  }

  return "none";
}

function updatePowerups() {
  const nextPowerups = [];

  for (const powerup of state.powerups) {
    powerup.y += powerup.speed;

    const intersectsPaddle =
      powerup.y + powerup.size / 2 >= state.paddle.y &&
      powerup.x >= state.paddle.x &&
      powerup.x <= state.paddle.x + state.paddle.width &&
      powerup.y - powerup.size / 2 <= state.paddle.y + state.paddle.height;

    if (intersectsPaddle) {
      applyPowerup(powerup);
      continue;
    }

    if (powerup.y - powerup.size / 2 <= canvas.height) {
      nextPowerups.push(powerup);
    }
  }

  state.powerups = nextPowerups;
}

function updateBalls() {
  if (!state.running) {
    return;
  }

  const activeBalls = [];

  for (const ball of state.balls) {
    collideWithWalls(ball);
    collideWithPaddle(ball);
    const collisionResult = collideWithBricks(ball);

    if (collisionResult === "levelCleared") {
      return;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.y - ball.radius <= canvas.height) {
      activeBalls.push(ball);
    }
  }

  state.balls = activeBalls;

  if (state.balls.length > 0) {
    return;
  }

  state.lives -= 1;
  updateHud();

  if (state.lives <= 0) {
    state.running = false;
    showOverlay("Game over. Press space to restart.");
    updatePowerStatus("All balls lost.");
    return;
  }

  resetBalls(true);
  updatePowerStatus("Ball lost.");
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 12; index += 1) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + index * 0.006})`;
    ctx.arc(70 * index, 40 + index * 18, 2 + index, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPaddle() {
  ctx.fillStyle = "#f8f5f1";
  ctx.beginPath();
  ctx.roundRect(
    state.paddle.x,
    state.paddle.y,
    state.paddle.width,
    state.paddle.height,
    10,
  );
  ctx.fill();
}

function drawBalls() {
  for (const ball of state.balls) {
    ctx.fillStyle = "#ffbf69";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBricks() {
  for (const brick of state.bricks) {
    if (brick.hitsLeft === 0) {
      continue;
    }

    ctx.fillStyle = brick.color;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 8);
    ctx.fill();

    if (brick.powerupType) {
      ctx.strokeStyle = "rgba(255, 252, 246, 0.88)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(brick.x + 6, brick.y + 5, brick.width - 12, 4);
    }
  }
}

function drawPowerups() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 12px "Space Grotesk", sans-serif';

  for (const powerup of state.powerups) {
    const type = powerupTypes[powerup.type];

    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.roundRect(
      powerup.x - powerup.size / 2,
      powerup.y - powerup.size / 2,
      powerup.size,
      powerup.size,
      8,
    );
    ctx.fill();

    ctx.fillStyle = "#132238";
    ctx.fillText(type.label, powerup.x, powerup.y + 1);
  }
}

function gameLoop() {
  refreshPaddleWidth();
  movePaddle();
  updateBalls();
  updatePowerups();
  updatePowerStatus();

  drawBackground();
  drawBricks();
  drawPowerups();
  drawPaddle();
  drawBalls();

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    state.keys.left = true;
  }

  if (event.key === "ArrowRight") {
    state.keys.right = true;
  }

  if (event.key === " ") {
    launchBall();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") {
    state.keys.left = false;
  }

  if (event.key === "ArrowRight") {
    state.keys.right = false;
  }
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const relativeX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  state.paddle.x = relativeX - state.paddle.width / 2;
  clampPaddle();

  if (!state.running) {
    syncParkedBall();
  }
});

canvas.addEventListener(
  "touchmove",
  (event) => {
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    const relativeX = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    state.paddle.x = relativeX - state.paddle.width / 2;
    clampPaddle();

    if (!state.running) {
      syncParkedBall();
    }

    event.preventDefault();
  },
  { passive: false },
);

canvas.addEventListener("click", () => {
  launchBall();
});

restartGame();
gameLoop();
