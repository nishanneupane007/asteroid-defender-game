// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 1000;
canvas.height = 700;

// Game State
let gameRunning = false;
let paused = false;
let score = 0;
let highScore = localStorage.getItem('asteroidHighScore') || 0;
let level = 1;
let lives = 3;
let difficulty = 'normal';

// Player Object
const player = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 30,
    height: 30,
    speed: 7,
    shootCooldown: 0,
    invincibleFrames: 0,
    powerupActive: false,
    powerupTimer: 0
};

// Game Objects
let bullets = [];
let asteroids = [];
let particles = [];
let powerups = [];

// Difficulty Settings
const difficultySettings = {
    easy: { asteroidSpeed: 2, spawnRate: 60, maxAsteroids: 5, bulletSpeed: 8 },
    normal: { asteroidSpeed: 3.5, spawnRate: 45, maxAsteroids: 8, bulletSpeed: 10 },
    hard: { asteroidSpeed: 5, spawnRate: 30, maxAsteroids: 12, bulletSpeed: 12 }
};

// Input Handling
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    KeyP: false
};

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
    }
    
    if (e.code === 'Space' && gameRunning && !paused && player.shootCooldown <= 0) {
        shoot();
    }
    
    if (e.code === 'KeyP' && gameRunning) {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('quitBtn').addEventListener('click', () => {
    gameRunning = false;
    showMenu();
});
document.getElementById('difficulty').addEventListener('change', (e) => {
    difficulty = e.target.value;
});

// Shooting Function
function shoot() {
    bullets.push({
        x: player.x + player.width / 2 - 2,
        y: player.y,
        width: 4,
        height: 10,
        speed: difficultySettings[difficulty].bulletSpeed
    });
    
    player.shootCooldown = 10;
    
    // Add shooting effect
    canvas.style.animation = 'shoot-effect 0.1s ease-out';
    setTimeout(() => canvas.style.animation = '', 100);
}

// Spawn Asteroid
function spawnAsteroid() {
    if (!gameRunning || paused) return;
    
    const size = Math.random() * 40 + 20;
    asteroids.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speed: difficultySettings[difficulty].asteroidSpeed + Math.random() * 2,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        points: Math.floor(100 / (size / 20))
    });
}

// Spawn Powerup
function spawnPowerup(x, y) {
    const types = ['rapidFire', 'shield', 'multiShot'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerups.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        type: type,
        speed: 3
    });
}

// Create Particle Effect
function createParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: color,
            size: Math.random() * 3 + 2
        });
    }
}

// Update Player
function updatePlayer() {
    if (player.invincibleFrames > 0) {
        player.invincibleFrames--;
    }
    
    if (player.powerupActive) {
        player.powerupTimer--;
        if (player.powerupTimer <= 0) {
            player.powerupActive = false;
            document.getElementById('powerupIndicator').style.opacity = '0';
        } else {
            document.getElementById('powerupIndicator').textContent = 
                `🔥 POWERUP: ${Math.ceil(player.powerupTimer / 60)}s`;
            document.getElementById('powerupIndicator').style.opacity = '1';
        }
    }
    
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    
    // Movement
    let moveLeft = keys.ArrowLeft || keys.KeyA;
    let moveRight = keys.ArrowRight || keys.KeyD;
    
    if (moveLeft) player.x -= player.speed;
    if (moveRight) player.x += player.speed;
    
    // Boundaries
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

// Update Bullets
function updateBullets() {
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].y -= bullets[i].speed;
        
        if (bullets[i].y + bullets[i].height < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
            i--;
        }
    }
}

// Update Asteroids - FIXED: Now asteroids actually fall!
function updateAsteroids() {
    for (let i = 0; i < asteroids.length; i++) {
        // Move asteroid downward
        asteroids[i].y += asteroids[i].speed;
        asteroids[i].rotation += asteroids[i].rotationSpeed;
        
        // Remove if off screen (below canvas)
        if (asteroids[i].y > canvas.height + asteroids[i].height) {
            asteroids.splice(i, 1);
            i--;
            continue;
        }
        
        // Remove if off screen (above canvas - shouldn't happen but just in case)
        if (asteroids[i].y + asteroids[i].height < 0) {
            asteroids.splice(i, 1);
            i--;
            continue;
        }
        
        // Collision with player
        if (player.invincibleFrames <= 0 && !paused) {
            if (collision(player, asteroids[i])) {
                lives--;
                updateLivesDisplay();
                player.invincibleFrames = 60;
                createParticles(player.x + player.width/2, player.y + player.height/2, '#ff0000');
                
                if (lives <= 0) {
                    gameOver();
                    return;
                }
                
                asteroids.splice(i, 1);
                i--;
            }
        }
    }
}

// Update Powerups
function updatePowerups() {
    for (let i = 0; i < powerups.length; i++) {
        powerups[i].y += powerups[i].speed;
        
        if (powerups[i].y > canvas.height) {
            powerups.splice(i, 1);
            i--;
            continue;
        }
        
        if (collision(player, powerups[i])) {
            applyPowerup(powerups[i].type);
            powerups.splice(i, 1);
            i--;
        }
    }
}

// Apply Powerup
function applyPowerup(type) {
    switch(type) {
        case 'rapidFire':
            player.shootCooldown = 0;
            player.powerupActive = true;
            player.powerupTimer = 300;
            break;
        case 'shield':
            player.invincibleFrames = 180;
            player.powerupActive = true;
            player.powerupTimer = 180;
            break;
        case 'multiShot':
            player.powerupActive = true;
            player.powerupTimer = 300;
            break;
    }
}

// Collision Detection
function collision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Check Bullet-Asteroid Collisions
function checkCollisions() {
    for (let i = 0; i < bullets.length; i++) {
        for (let j = 0; j < asteroids.length; j++) {
            if (collision(bullets[i], asteroids[j])) {
                // Remove the bullet
                bullets.splice(i, 1);
                
                // Calculate points based on asteroid size
                let pointsEarned = Math.floor(100 / (asteroids[j].width / 20));
                if (pointsEarned < 10) pointsEarned = 10;
                if (pointsEarned > 100) pointsEarned = 100;
                
                // Add to score
                score += pointsEarned;
                updateScore();
                
                // Create explosion effect at asteroid position
                createParticles(asteroids[j].x + asteroids[j].width/2, 
                              asteroids[j].y + asteroids[j].height/2, '#ffaa00');
                
                // Chance to spawn powerup (15%)
                if (Math.random() < 0.15) {
                    spawnPowerup(asteroids[j].x + asteroids[j].width/2, 
                               asteroids[j].y + asteroids[j].height/2);
                }
                
                // Remove the asteroid
                asteroids.splice(j, 1);
                
                // Break out of inner loop since bullet is gone
                break;
            }
        }
    }
}

// Update Particles
function updateParticles() {
    for (let i = 0; i < particles.length; i++) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life -= 0.02;
        
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
}

// Drawing Functions
function drawPlayer() {
    if (player.invincibleFrames > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    // Draw player ship (triangle)
    ctx.beginPath();
    ctx.moveTo(player.x + player.width/2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    
    ctx.fillStyle = '#0ff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    
    // Engine glow
    ctx.beginPath();
    ctx.moveTo(player.x + player.width/2 - 5, player.y + player.height);
    ctx.lineTo(player.x + player.width/2, player.y + player.height + 10);
    ctx.lineTo(player.x + player.width/2 + 5, player.y + player.height);
    ctx.fillStyle = '#ff6600';
    ctx.fill();
    
    ctx.globalAlpha = 1;
}

function drawBullets() {
    ctx.fillStyle = '#ffff00';
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

function drawAsteroids() {
    asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x + asteroid.width/2, asteroid.y + asteroid.height/2);
        ctx.rotate(asteroid.rotation);
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(-asteroid.width/2, -asteroid.height/2, asteroid.width, asteroid.height);
        
        // Add craters
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(-asteroid.width/4, -asteroid.height/4, asteroid.width/2, asteroid.height/2);
        ctx.fillStyle = '#4a2e12';
        ctx.fillRect(-asteroid.width/3, asteroid.height/6, asteroid.width/3, asteroid.height/4);
        ctx.restore();
    });
}

function drawPowerups() {
    powerups.forEach(powerup => {
        ctx.fillStyle = powerup.type === 'rapidFire' ? '#ff00ff' : 
                       powerup.type === 'shield' ? '#00ffff' : '#ffff00';
        ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(powerup.type === 'rapidFire' ? '⚡' : 
                    powerup.type === 'shield' ? '🛡️' : '🔫', 
                    powerup.x + 5, powerup.y + 15);
    });
}

function drawParticles() {
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
}

function drawStars() {
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
        ctx.fillRect((i * 131) % canvas.width, (Date.now() * 0.1 + i * 50) % canvas.height, 2, 2);
    }
}

// UI Updates
function updateScore() {
    document.getElementById('score').textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    // Level progression
    const newLevel = Math.floor(score / 500) + 1;
    if (newLevel > level) {
        level = newLevel;
        document.getElementById('level').textContent = level;
        createParticles(canvas.width/2, canvas.height/2, '#00ff00');
    }
}

function updateLivesDisplay() {
    const livesSpan = document.getElementById('lives');
    livesSpan.textContent = '❤️'.repeat(lives);
}

// Game Loop
let lastSpawnTime = 0;
let frameCount = 0;

function gameLoop() {
    if (!gameRunning || paused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background stars
    drawStars();
    
    // Update game objects
    updatePlayer();
    updateBullets();
    updateAsteroids();  // This makes asteroids fall
    updatePowerups();
    updateParticles();
    checkCollisions();
    
    // Spawn asteroids based on level and difficulty
    frameCount++;
    
    // Spawn new asteroids periodically
    if (frameCount % 30 === 0) {  // Spawn every 30 frames
        if (asteroids.length < difficultySettings[difficulty].maxAsteroids + Math.floor(level / 2)) {
            spawnAsteroid();
        }
    }
    
    // Additional random spawning
    if (Math.random() < 0.03 && asteroids.length < difficultySettings[difficulty].maxAsteroids + Math.floor(level / 2)) {
        spawnAsteroid();
    }
    
    // Rapid fire and multi-shot powerup effect
    if (player.powerupActive && player.powerupTimer > 0) {
        if (player.powerupTimer % 5 === 0 && player.shootCooldown === 0) {
            shoot();
            // Multi-shot effect
            if (player.powerupTimer > 0 && player.powerupActive && player.powerupTimer % 10 === 0) {
                setTimeout(() => {
                    if (gameRunning && !paused && player.powerupActive) {
                        bullets.push({
                            x: player.x + player.width/2 - 12,
                            y: player.y,
                            width: 4,
                            height: 10,
                            speed: difficultySettings[difficulty].bulletSpeed
                        });
                        bullets.push({
                            x: player.x + player.width/2 + 8,
                            y: player.y,
                            width: 4,
                            height: 10,
                            speed: difficultySettings[difficulty].bulletSpeed
                        });
                    }
                }, 50);
            }
        }
    }
    
    // Draw everything
    drawPlayer();
    drawBullets();
    drawAsteroids();
    drawPowerups();
    drawParticles();
    
    requestAnimationFrame(gameLoop);
}

// Game Control Functions
function startGame() {
    // Reset game state
    gameRunning = true;
    paused = false;
    score = 0;
    level = 1;
    lives = 3;
    bullets = [];
    asteroids = [];
    particles = [];
    powerups = [];
    frameCount = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height - 50;
    player.shootCooldown = 0;
    player.invincibleFrames = 60;
    player.powerupActive = false;
    player.powerupTimer = 0;
    
    // Update UI
    updateScore();
    updateLivesDisplay();
    document.getElementById('level').textContent = '1';
    document.getElementById('highScore').textContent = highScore;
    
    // Hide menus
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('powerupIndicator').style.opacity = '0';
    
    // Spawn initial asteroids
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            if (gameRunning) spawnAsteroid();
        }, i * 300);
    }
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

function togglePause() {
    if (!gameRunning) return;
    paused = !paused;
    document.getElementById('pauseMenu').style.display = paused ? 'block' : 'none';
}

function showMenu() {
    gameRunning = false;
    document.getElementById('menu').style.display = 'block';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';
}

// Initialize Game
function init() {
    updateLivesDisplay();
    document.getElementById('highScore').textContent = highScore;
    showMenu();
    gameLoop();
}

// Start the game
init();