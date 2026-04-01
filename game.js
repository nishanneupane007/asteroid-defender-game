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

// ============ SOUND SYSTEM ============
let audioContext = null;
let sounds = {};

function initAudio() {
    if (audioContext) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        sounds = {
            shoot: function() {
                if (!audioContext) return;
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.type = 'sine';
                oscillator.frequency.value = 800;
                gain.gain.value = 0.2;
                oscillator.start();
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
                oscillator.stop(audioContext.currentTime + 0.3);
            },
            
            explosion: function() {
                if (!audioContext) return;
                const noise = audioContext.createBufferSource();
                const bufferSize = audioContext.sampleRate * 0.5;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                noise.buffer = buffer;
                
                const filter = audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 1000;
                
                const gain = audioContext.createGain();
                gain.gain.value = 0.3;
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioContext.destination);
                
                noise.start();
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.8);
            },
            
            powerup: function() {
                if (!audioContext) return;
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.type = 'sine';
                oscillator.frequency.value = 523.25;
                gain.gain.value = 0.2;
                oscillator.start();
                
                oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
                oscillator.stop(audioContext.currentTime + 0.3);
            },
            
            gameover: function() {
                if (!audioContext) return;
                const oscillator1 = audioContext.createOscillator();
                const oscillator2 = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                oscillator1.connect(gain);
                oscillator2.connect(gain);
                gain.connect(audioContext.destination);
                
                oscillator1.type = 'sawtooth';
                oscillator1.frequency.value = 220;
                oscillator2.type = 'sawtooth';
                oscillator2.frequency.value = 110;
                
                gain.gain.value = 0.3;
                
                oscillator1.start();
                oscillator2.start();
                
                oscillator1.frequency.exponentialRampToValueAtTime(55, audioContext.currentTime + 0.5);
                oscillator2.frequency.exponentialRampToValueAtTime(27.5, audioContext.currentTime + 0.5);
                gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.6);
                
                oscillator1.stop(audioContext.currentTime + 0.6);
                oscillator2.stop(audioContext.currentTime + 0.6);
            }
        };
    } catch(e) {
        console.log("Audio not supported:", e);
    }
}

function playSound(soundName) {
    if (audioContext && sounds[soundName]) {
        try {
            sounds[soundName]();
        } catch(e) {
            console.log("Error playing sound:", e);
        }
    }
}

// ============ LEADERBOARD SYSTEM ============
let leaderboard = [];
let currentScore = 0;

function loadLeaderboard() {
    const saved = localStorage.getItem('asteroidLeaderboard');
    if (saved) {
        leaderboard = JSON.parse(saved);
    } else {
        leaderboard = [
            { name: "🚀 MASTER", score: 5000 },
            { name: "⭐ STAR", score: 3000 },
            { name: "💪 NOOB", score: 1000 }
        ];
    }
    displayLeaderboard();
}

function saveLeaderboard() {
    localStorage.setItem('asteroidLeaderboard', JSON.stringify(leaderboard));
    displayLeaderboard();
}

function displayLeaderboard() {
    const listElement = document.getElementById('leaderboardList');
    if (!listElement) return;
    
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    
    listElement.innerHTML = '';
    leaderboard.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'score-entry';
        div.innerHTML = `
            <span class="score-rank">${index + 1}</span>
            <span class="score-name">${entry.name}</span>
            <span class="score-value">${entry.score}</span>
        `;
        listElement.appendChild(div);
    });
}

function checkHighScore(scoreValue) {
    currentScore = scoreValue;
    const lowestScore = leaderboard.length >= 10 ? leaderboard[9].score : 0;
    
    if (scoreValue > lowestScore || leaderboard.length < 10) {
        const inputDiv = document.getElementById('leaderboardInput');
        if (inputDiv) inputDiv.style.display = 'block';
        const nameInput = document.getElementById('playerName');
        if (nameInput) nameInput.focus();
    }
}

function saveScoreToLeaderboard(name) {
    if (!name.trim()) name = "ANONYMOUS";
    
    leaderboard.push({ name: name.toUpperCase().slice(0, 15), score: currentScore });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    saveLeaderboard();
    const inputDiv = document.getElementById('leaderboardInput');
    if (inputDiv) inputDiv.style.display = 'none';
}

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

// ============ MOBILE CONTROLS ============
if (canvas) {
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        
        player.x = touchX - player.width/2;
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        
        if (gameRunning && !paused && player.shootCooldown <= 0) {
            shoot();
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        
        player.x = touchX - player.width/2;
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    });

    canvas.addEventListener('mousemove', (e) => {
        if (gameRunning && !paused) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            player.x = mouseX - player.width/2;
            player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        }
    });

    canvas.addEventListener('click', (e) => {
        if (gameRunning && !paused && player.shootCooldown <= 0) {
            shoot();
        }
    });
}

// Button Event Listeners - with null checks
const startBtn = document.getElementById('startBtn');
if (startBtn) startBtn.addEventListener('click', startGame);

const restartBtn = document.getElementById('restartBtn');
if (restartBtn) restartBtn.addEventListener('click', startGame);

const resumeBtn = document.getElementById('resumeBtn');
if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

const quitBtn = document.getElementById('quitBtn');
if (quitBtn) quitBtn.addEventListener('click', () => {
    gameRunning = false;
    showMenu();
});

const difficultySelect = document.getElementById('difficulty');
if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
        difficulty = e.target.value;
    });
}

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
    playSound('shoot');
    
    if (canvas) {
        canvas.style.animation = 'shoot-effect 0.1s ease-out';
        setTimeout(() => { if (canvas) canvas.style.animation = ''; }, 100);
    }
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
        rotationSpeed: (Math.random() - 0.5) * 0.1
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
            const indicator = document.getElementById('powerupIndicator');
            if (indicator) indicator.style.opacity = '0';
        } else {
            const indicator = document.getElementById('powerupIndicator');
            if (indicator) {
                indicator.textContent = `🔥 POWERUP: ${Math.ceil(player.powerupTimer / 60)}s`;
                indicator.style.opacity = '1';
            }
        }
    }
    
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    
    let moveLeft = keys.ArrowLeft || keys.KeyA;
    let moveRight = keys.ArrowRight || keys.KeyD;
    
    if (moveLeft) player.x -= player.speed;
    if (moveRight) player.x += player.speed;
    
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

// Update Asteroids
function updateAsteroids() {
    for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].y += asteroids[i].speed;
        asteroids[i].rotation += asteroids[i].rotationSpeed;
        
        if (asteroids[i].y > canvas.height + asteroids[i].height) {
            asteroids.splice(i, 1);
            i--;
            continue;
        }
        
        if (player.invincibleFrames <= 0 && !paused) {
            if (collision(player, asteroids[i])) {
                lives--;
                updateLivesDisplay();
                player.invincibleFrames = 60;
                createParticles(player.x + player.width/2, player.y + player.height/2, '#ff0000');
                playSound('explosion');
                
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
    playSound('powerup');
    
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
                bullets.splice(i, 1);
                
                let pointsEarned = Math.floor(100 / (asteroids[j].width / 20));
                if (pointsEarned < 10) pointsEarned = 10;
                if (pointsEarned > 100) pointsEarned = 100;
                
                score += pointsEarned;
                updateScore();
                
                createParticles(asteroids[j].x + asteroids[j].width/2, 
                              asteroids[j].y + asteroids[j].height/2, '#ffaa00');
                playSound('explosion');
                
                if (Math.random() < 0.15) {
                    spawnPowerup(asteroids[j].x + asteroids[j].width/2, 
                               asteroids[j].y + asteroids[j].height/2);
                }
                
                asteroids.splice(j, 1);
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
    
    ctx.beginPath();
    ctx.moveTo(player.x + player.width/2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    
    ctx.fillStyle = '#0ff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    
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
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(-asteroid.width/4, -asteroid.height/4, asteroid.width/2, asteroid.height/2);
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
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.textContent = score;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidHighScore', highScore);
        const highScoreElement = document.getElementById('highScore');
        if (highScoreElement) highScoreElement.textContent = highScore;
    }
    
    const newLevel = Math.floor(score / 500) + 1;
    if (newLevel > level) {
        level = newLevel;
        const levelElement = document.getElementById('level');
        if (levelElement) levelElement.textContent = level;
        createParticles(canvas.width/2, canvas.height/2, '#00ff00');
    }
}

function updateLivesDisplay() {
    const livesSpan = document.getElementById('lives');
    if (livesSpan) livesSpan.textContent = '❤️'.repeat(lives);
}

// Game Loop
let frameCount = 0;

function gameLoop() {
    if (!gameRunning || paused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    
    updatePlayer();
    updateBullets();
    updateAsteroids();
    updatePowerups();
    updateParticles();
    checkCollisions();
    
    frameCount++;
    
    if (frameCount % 30 === 0) {
        if (asteroids.length < difficultySettings[difficulty].maxAsteroids + Math.floor(level / 2)) {
            spawnAsteroid();
        }
    }
    
    if (Math.random() < 0.03 && asteroids.length < difficultySettings[difficulty].maxAsteroids + Math.floor(level / 2)) {
        spawnAsteroid();
    }
    
    if (player.powerupActive && player.powerupTimer > 0) {
        if (player.powerupTimer % 5 === 0 && player.shootCooldown === 0) {
            shoot();
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
    
    drawPlayer();
    drawBullets();
    drawAsteroids();
    drawPowerups();
    drawParticles();
    
    requestAnimationFrame(gameLoop);
}

// Game Control Functions
function startGame() {
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
    
    updateScore();
    updateLivesDisplay();
    
    const levelElement = document.getElementById('level');
    if (levelElement) levelElement.textContent = '1';
    
    const highScoreElement = document.getElementById('highScore');
    if (highScoreElement) highScoreElement.textContent = highScore;
    
    const menu = document.getElementById('menu');
    const gameOver = document.getElementById('gameOver');
    const pauseMenu = document.getElementById('pauseMenu');
    const powerupIndicator = document.getElementById('powerupIndicator');
    
    if (menu) menu.style.display = 'none';
    if (gameOver) gameOver.style.display = 'none';
    if (pauseMenu) pauseMenu.style.display = 'none';
    if (powerupIndicator) powerupIndicator.style.opacity = '0';
    
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            if (gameRunning) spawnAsteroid();
        }, i * 300);
    }
}

function gameOver() {
    gameRunning = false;
    const finalScoreElement = document.getElementById('finalScore');
    if (finalScoreElement) finalScoreElement.textContent = score;
    
    const gameOverElement = document.getElementById('gameOver');
    if (gameOverElement) gameOverElement.style.display = 'block';
    
    playSound('gameover');
    checkHighScore(score);
}

function togglePause() {
    if (!gameRunning) return;
    paused = !paused;
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.style.display = paused ? 'block' : 'none';
}

function showMenu() {
    gameRunning = false;
    const menu = document.getElementById('menu');
    const gameOver = document.getElementById('gameOver');
    const pauseMenu = document.getElementById('pauseMenu');
    
    if (menu) menu.style.display = 'block';
    if (gameOver) gameOver.style.display = 'none';
    if (pauseMenu) pauseMenu.style.display = 'none';
}

// ============ INITIALIZATION ============
function initializeNewFeatures() {
    loadLeaderboard();
    
    // Show "How to Play" for first-time visitors
    if (!localStorage.getItem('hasSeenHowToPlay')) {
        setTimeout(() => {
            const howToPlay = document.getElementById('howToPlay');
            if (howToPlay) howToPlay.style.display = 'flex';
        }, 500);
        localStorage.setItem('hasSeenHowToPlay', 'true');
    }
    
    // Close popup handlers
    const closeHowToPlayBtn = document.getElementById('closeHowToPlay');
    if (closeHowToPlayBtn) {
        closeHowToPlayBtn.addEventListener('click', () => {
            const howToPlay = document.getElementById('howToPlay');
            if (howToPlay) howToPlay.style.display = 'none';
        });
    }
    
    const closePopupBtn = document.querySelector('.close-popup');
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', () => {
            const howToPlay = document.getElementById('howToPlay');
            if (howToPlay) howToPlay.style.display = 'none';
        });
    }
    
    // Mobile shoot button
    const mobileShootBtn = document.getElementById('mobileShootBtn');
    if (mobileShootBtn) {
        if ('ontouchstart' in window) {
            mobileShootBtn.style.display = 'block';
        }
        
        const shootButton = document.querySelector('.shoot-button');
        if (shootButton) {
            shootButton.addEventListener('click', () => {
                if (gameRunning && !paused && player.shootCooldown <= 0) {
                    shoot();
                }
            });
        }
    }
    
    // Leaderboard close button
    const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', () => {
            const leaderboard = document.getElementById('leaderboard');
            if (leaderboard) leaderboard.style.display = 'none';
        });
    }
    
    // Save score button
    const saveScoreBtn = document.getElementById('saveScore');
    if (saveScoreBtn) {
        saveScoreBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('playerName');
            const name = nameInput ? nameInput.value : '';
            saveScoreToLeaderboard(name);
        });
    }
    
    // Show leaderboard button
    const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
    if (showLeaderboardBtn) {
        showLeaderboardBtn.addEventListener('click', () => {
            const leaderboard = document.getElementById('leaderboard');
            if (leaderboard) {
                if (leaderboard.style.display === 'none' || !leaderboard.style.display) {
                    leaderboard.style.display = 'block';
                } else {
                    leaderboard.style.display = 'none';
                }
            }
        });
    }
    
    // Initialize audio on first interaction
    const initAudioOnClick = () => {
        initAudio();
        document.removeEventListener('click', initAudioOnClick);
        document.removeEventListener('touchstart', initAudioOnClick);
    };
    
    document.addEventListener('click', initAudioOnClick);
    document.addEventListener('touchstart', initAudioOnClick);
}

// Initialize Game
function init() {
    updateLivesDisplay();
    const highScoreElement = document.getElementById('highScore');
    if (highScoreElement) highScoreElement.textContent = highScore;
    showMenu();
    initializeNewFeatures();
    gameLoop();
}

// Start the game
init();
