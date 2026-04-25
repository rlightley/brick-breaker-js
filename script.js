const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const overlayElement = document.getElementById("overlay");
const messageElement = document.getElementById("message");

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
    width: config.paddle.width,
    height: config.paddle.height,
  },
  ball: {
    x: canvas.width / 2,
    y: canvas.height - 56,
    dx: config.ball.speed,
    dy: -config.ball.speed,
    radius: config.ball.radius,
  },
  bricks: [],
};

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
      });
    }
  }
}

function resetBall(stickToPaddle = true) {
  state.ball.x = state.paddle.x + state.paddle.width / 2;
  state.ball.y = state.paddle.y - state.ball.radius - 2;
  state.ball.dx = config.ball.speed * (Math.random() > 0.5 ? 1 : -1);
  state.ball.dy = -config.ball.speed;

  if (stickToPaddle) {
    state.running = false;
    showOverlay("Press space to launch the ball.");
  }
}

function resetLevel() {
  state.paddle.width = Math.max(
    84,
    config.paddle.width - (state.level - 1) * 10,
  );
  state.paddle.x = (canvas.width - state.paddle.width) / 2;
  buildBricks();
  resetBall(true);
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
    resetBall(false);
  }
}

function collideWithWalls() {
  const nextX = state.ball.x + state.ball.dx;
  const nextY = state.ball.y + state.ball.dy;

  if (
    nextX + state.ball.radius >= canvas.width ||
    nextX - state.ball.radius <= 0
  ) {
    state.ball.dx *= -1;
  }

  if (nextY - state.ball.radius <= 0) {
    state.ball.dy *= -1;
  }
}

function collideWithPaddle() {
  const paddleTop = state.paddle.y;
  const paddleBottom = state.paddle.y + state.paddle.height;
  const paddleLeft = state.paddle.x;
  const paddleRight = state.paddle.x + state.paddle.width;

  const ballBottom = state.ball.y + state.ball.radius;

  if (
    ballBottom >= paddleTop &&
    ballBottom <= paddleBottom &&
    state.ball.x >= paddleLeft &&
    state.ball.x <= paddleRight &&
    state.ball.dy > 0
  ) {
    const hitPosition = (state.ball.x - paddleLeft) / state.paddle.width;
    const angle = (hitPosition - 0.5) * Math.PI * 0.75;
    const speed = config.ball.speed + (state.level - 1) * 0.35;

    state.ball.dx = Math.sin(angle) * speed;
    state.ball.dy = -Math.cos(angle) * speed;
    state.ball.y = paddleTop - state.ball.radius - 1;
  }
}

function collideWithBricks() {
  for (const brick of state.bricks) {
    if (brick.hitsLeft === 0) {
      continue;
    }

    const withinX =
      state.ball.x + state.ball.radius >= brick.x &&
      state.ball.x - state.ball.radius <= brick.x + brick.width;
    const withinY =
      state.ball.y + state.ball.radius >= brick.y &&
      state.ball.y - state.ball.radius <= brick.y + brick.height;

    if (!withinX || !withinY) {
      continue;
    }

    brick.hitsLeft = 0;
    state.score += 10;
    state.ball.dy *= -1;
    updateHud();

    if (state.bricks.every((item) => item.hitsLeft === 0)) {
      state.level += 1;
      showOverlay("Level cleared. Press space for the next round.");
      resetLevel();
    }

    return;
  }
}

function updateBall() {
  if (!state.running) {
    return;
  }

  collideWithWalls();
  collideWithPaddle();
  collideWithBricks();

  state.ball.x += state.ball.dx;
  state.ball.y += state.ball.dy;

  if (state.ball.y - state.ball.radius > canvas.height) {
    state.lives -= 1;
    updateHud();

    if (state.lives <= 0) {
      state.running = false;
      showOverlay("Game over. Press space to restart.");
      return;
    }

    resetBall(true);
  }
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

function drawBall() {
  ctx.fillStyle = "#ffbf69";
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
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
  }
}

function gameLoop() {
  movePaddle();
  updateBall();

  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();

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
    resetBall(false);
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
      resetBall(false);
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
