import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Simple time state for lighting
let currentTime = 0; // 0-1 representing full day cycle

// Game state
const gameState = {
    day: 1,
    hour: 8,
    weather: 'Sunny',
    grassHeight: 0.1,
    grassHealth: 100,
    grassMoisture: 50,
    timeSpeed: 1, // 1 = normal, 2 = 2x speed, etc.
    paused: false
};

// Audio setup
let audioListener;
let ambientSound;
let waterSound;

function setupAudio() {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    // Ambient nature sound
    ambientSound = new THREE.Audio(audioListener);
    const ambientAudioLoader = new THREE.AudioLoader();
    ambientAudioLoader.load('ambient-nature.wav', function(buffer) {
        ambientSound.setBuffer(buffer);
        ambientSound.setLoop(true);
        ambientSound.setVolume(0.5);
        ambientSound.play();
    });

    // Water sound effect
    waterSound = new THREE.Audio(audioListener);
    const waterAudioLoader = new THREE.AudioLoader();
    waterAudioLoader.load('water-sound.wav', function(buffer) {
        waterSound.setBuffer(buffer);
        waterSound.setLoop(false);
        waterSound.setVolume(0.7);
    });
}

// Constants
const LAWN_SIZE = 20;
const GRASS_DENSITY = 30000;
const GRASS_GROWTH_RATE = 0.0001;
const MOISTURE_LOSS_RATE = 0.05;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

// Camera position
camera.position.set(5, 3, 5);
camera.lookAt(0, 0, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2 - 0.1;
controls.minPolarAngle = Math.PI / 6;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 15, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Sky
const sky = new Sky();
sky.scale.setScalar(450);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 10;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

const sun = new THREE.Vector3();

// Ground
const groundGeometry = new THREE.PlaneGeometry(LAWN_SIZE, LAWN_SIZE, 32, 32);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x553311, // Soil color
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grass instanced mesh
function createGrassBladeGeometry() {
    const geometry = new THREE.BufferGeometry();
    
    // Create a tapered grass blade shape
    const width = 0.02;
    const height = 0.4;
    const segments = 4;
    
    const vertices = [];
    const indices = [];
    const uvs = [];
    
    // Create vertices for a tapered blade
    for (let i = 0; i <= segments; i++) {
        const y = (i / segments) * height;
        const widthAtHeight = width * (1 - (i / segments) * 0.8); // Taper towards tip
        const curve = Math.sin((i / segments) * Math.PI * 0.3) * 0.02; // Slight curve
        
        // Left vertex
        vertices.push(-widthAtHeight / 2, y, curve);
        uvs.push(0, i / segments);
        
        // Right vertex  
        vertices.push(widthAtHeight / 2, y, curve);
        uvs.push(1, i / segments);
    }
    
    // Create triangles
    for (let i = 0; i < segments; i++) {
        const bottom = i * 2;
        const top = (i + 1) * 2;
        
        // Two triangles per segment
        indices.push(bottom, bottom + 1, top);
        indices.push(bottom + 1, top + 1, top);
    }
    
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    
    return geometry;
}

const instancedGrassGeometry = createGrassBladeGeometry();
const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x33aa33,
    side: THREE.DoubleSide,
    alphaTest: 0.5
});

const grassInstancedMesh = new THREE.InstancedMesh(
    instancedGrassGeometry,
    grassMaterial,
    GRASS_DENSITY
);
grassInstancedMesh.castShadow = true;
grassInstancedMesh.receiveShadow = true;
scene.add(grassInstancedMesh);

// Create grass instances
const dummy = new THREE.Object3D();
const grassPositions = [];

for (let i = 0; i < GRASS_DENSITY; i++) {
    // Random position within the lawn area
    const x = (Math.random() - 0.5) * LAWN_SIZE;
    const z = (Math.random() - 0.5) * LAWN_SIZE;

    // Store position for later updates
    grassPositions.push({
        x: x,
        z: z,
        height: 0.05 + Math.random() * 0.03, // Smaller initial height variation
        swayOffset: Math.random() * Math.PI * 2, // Random sway phase offset
        swayAmount: 0.02 + Math.random() * 0.03  // Reduced sway amount for realism
    });

    // Set position
    dummy.position.set(x, 0, z);

    // Random rotation around Y axis
    dummy.rotation.y = Math.random() * Math.PI;
    
    // Slight random tilt for natural look
    dummy.rotation.x = (Math.random() - 0.5) * 0.1;
    dummy.rotation.z = (Math.random() - 0.5) * 0.1;

    // Apply to instanced mesh
    dummy.updateMatrix();
    grassInstancedMesh.setMatrixAt(i, dummy.matrix);
}

grassInstancedMesh.instanceMatrix.needsUpdate = true;

// UI functions
function updateUI() {
    // Update time display
    const hourString = gameState.hour.toString().padStart(2, '0');
    document.getElementById('time-display').textContent = `Day ${gameState.day}, ${hourString}:00`;

    // Update weather display
    document.getElementById('weather-display').textContent = gameState.weather;

    // Update stat bars
    document.getElementById('growth-bar').style.width = `${Math.min(100, (gameState.grassHeight / 1) * 100)}%`;
    document.getElementById('health-bar').style.width = `${gameState.grassHealth}%`;
    document.getElementById('moisture-bar').style.width = `${gameState.grassMoisture}%`;
}

// Game logic functions
function updateGrassAppearance() {
    // Update grass blade heights and colors based on game state
    const healthFactor = gameState.grassHealth / 100;
    const moistureFactor = gameState.grassMoisture / 100;

    // Calculate grass color based on health and moisture - more realistic green tones
    const baseHue = 120; // Pure green
    const hue = baseHue - (20 * (1 - healthFactor)); // 120 (green) to 100 (yellow-green)
    const saturation = 40 + (30 * healthFactor * moistureFactor); // More muted, realistic colors
    const lightness = 25 + (15 * moistureFactor); // Darker, more natural grass color

    grassMaterial.color.setHSL(hue/360, saturation/100, lightness/100);

    // Update each grass blade
    for (let i = 0; i < GRASS_DENSITY; i++) {
        const grass = grassPositions[i];

        // Calculate current grass height based on growth and health
        const maxHeight = 0.3; // Maximum realistic grass height (about 12 inches)
        const targetHeight = Math.min(gameState.grassHeight, maxHeight) * (0.7 + Math.random() * 0.6) * healthFactor;
        grass.height = grass.height * 0.98 + targetHeight * 0.02; // Slower, more realistic transition

        // Add subtle wind sway effect
        const time = performance.now() * 0.0005; // Slower sway
        const windStrength = 0.3;
        const swayX = Math.sin(time * 2 + grass.swayOffset) * grass.swayAmount * grass.height * windStrength;
        const swayZ = Math.cos(time * 1.5 + grass.swayOffset) * grass.swayAmount * 0.5 * grass.height * windStrength;

        // Apply transformations
        dummy.position.set(grass.x, 0, grass.z);
        dummy.scale.set(0.8 + Math.random() * 0.4, grass.height / 0.4, 0.8 + Math.random() * 0.4); // More height variation
        dummy.rotation.set(swayX, Math.random() * Math.PI * 2, swayZ);

        dummy.updateMatrix();
        grassInstancedMesh.setMatrixAt(i, dummy.matrix);
    }

    grassInstancedMesh.instanceMatrix.needsUpdate = true;
}

function updateSunPosition() {
    // Very slow progression - full day cycle takes much longer
    currentTime += 0.00005; // Much slower rate
    if (currentTime > 1) currentTime = 0;

    // Calculate sun position based on time
    const phi = THREE.MathUtils.degToRad(90 - ((1 - Math.cos(currentTime * Math.PI * 2)) * 45));
    const theta = THREE.MathUtils.degToRad(currentTime * 360 + 180);

    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);

    // Update directional light to match sun position
    directionalLight.position.set(sun.x * 15, sun.y * 15, sun.z * 15);

    // Adjust light intensity based on time of day
    const dayIntensity = Math.sin(currentTime * Math.PI);
    directionalLight.intensity = Math.max(0.1, dayIntensity);
    ambientLight.intensity = 0.2 + (dayIntensity * 0.3);

    // Night time - adjust sky parameters
    const isNight = currentTime < 0.25 || currentTime > 0.75;
    if (isNight) {
        skyUniforms['turbidity'].value = 5;
        skyUniforms['rayleigh'].value = 1;
    } else {
        skyUniforms['turbidity'].value = 10;
        skyUniforms['rayleigh'].value = 2;
    }
}

function updateGameTime() {
    if (gameState.paused) return;

    // Update game time - slower for more realistic observation
    gameState.hour += 0.5 * gameState.timeSpeed / 60; // Slower time progression

    if (gameState.hour >= 24) {
        gameState.hour = 0;
        gameState.day++;
    }

    // Update sun position
    updateSunPosition();

    // Handle grass growth and health
    if (gameState.hour >= 6 && gameState.hour <= 18) { // Only grow during daylight
        // Growth is affected by health and moisture
        const growthFactor = (gameState.grassHealth / 100) * (gameState.grassMoisture / 100);
        const seasonalFactor = 0.8 + 0.4 * Math.sin((gameState.day / 365) * Math.PI * 2); // Seasonal growth variation
        gameState.grassHeight += GRASS_GROWTH_RATE * growthFactor * seasonalFactor * gameState.timeSpeed / 60;

        // Cap maximum grass height to realistic levels
        if (gameState.grassHeight > 0.25) { // About 10 inches maximum
            gameState.grassHeight = 0.25;
        }
    }

    // Decrease moisture over time
    gameState.grassMoisture -= MOISTURE_LOSS_RATE * gameState.timeSpeed / 60;
    if (gameState.grassMoisture < 0) gameState.grassMoisture = 0;

    // Health is affected by moisture
    if (gameState.grassMoisture < 20) {
        gameState.grassHealth -= 0.2 * gameState.timeSpeed / 60;
        if (gameState.grassHealth < 0) gameState.grassHealth = 0;
    } else if (gameState.grassHealth < 100 && gameState.grassMoisture > 40) {
        gameState.grassHealth += 0.1 * gameState.timeSpeed / 60;
        if (gameState.grassHealth > 100) gameState.grassHealth = 100;
    }

    // Update UI
    updateUI();
}

// Initialize tool buttons
function initializeButtons() {
    document.getElementById('water-btn').addEventListener('click', () => {
        gameState.grassMoisture += 30;
        if (gameState.grassMoisture > 100) gameState.grassMoisture = 100;
        updateUI();

        // Play water sound
        if (waterSound && waterSound.buffer) {
            waterSound.play();
        }
    });

    document.getElementById('fertilize-btn').addEventListener('click', () => {
        gameState.grassHealth += 15;
        if (gameState.grassHealth > 100) gameState.grassHealth = 100;
        updateUI();
    });

    document.getElementById('mow-btn').addEventListener('click', () => {
        if (gameState.grassHeight > 0.3) {
            gameState.grassHeight = 0.3;
            updateGrassAppearance();
            updateUI();
        }
    });

    document.getElementById('seed-btn').addEventListener('click', () => {
        // Add more grass density (not implemented in this version)
        gameState.grassHealth += 10;
        if (gameState.grassHealth > 100) gameState.grassHealth = 100;
        updateUI();
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    updateGameTime();
    updateGrassAppearance();

    controls.update();

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation
setupAudio();
animate();