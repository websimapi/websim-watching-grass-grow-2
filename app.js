import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Simple time state for lighting
let currentTime = 0; // 0-1 representing full day cycle

// Constants
const LAWN_SIZE = 20;

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

function updateSunPosition() {
    // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1.0 = midnight
    const elevation = Math.sin(currentTime * Math.PI * 2 - Math.PI / 2) * 90;
    const azimuth = 180; // Sun in the south

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms['sunPosition'].value.copy(sun);
    
    directionalLight.position.copy(sun).multiplyScalar(50);

    if (sun.y > 0) { // Daytime
        directionalLight.intensity = 1;
        ambientLight.intensity = 0.4;
        directionalLight.castShadow = true;
    } else { // Nighttime
        directionalLight.intensity = 0;
        ambientLight.intensity = 0.1;
        directionalLight.castShadow = false;
    }
}

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

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    currentTime += 0.0001;
    if (currentTime >= 1.0) {
        currentTime = 0;
    }

    updateSunPosition();

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
animate();