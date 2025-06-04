import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

class ColorGUIHelper {
	constructor(object, prop) {
		this.object = object;
		this.prop = prop;
	}
	get value() {
		const color = this.object[this.prop];
		return `#${color.getHexString()}`;
	}
	set value(hexString) {
		this.object[this.prop].set(hexString);
	}
}

function makeXYZGUI(gui, vector3, name, onChangeFn) {
	const folder = gui.addFolder(name);
	folder.add(vector3, 'x', -10, 10).onChange(onChangeFn);
	folder.add(vector3, 'y', 0, 10).onChange(onChangeFn);
	folder.add(vector3, 'z', -10, 10).onChange(onChangeFn);
	folder.open();
}

const dayNightConfig = {
	cycleDuration: 60,
	autoPlay: true,
	currentTime: 0.5, // (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk, 1 = midnight)
	
	skyColors: {
		night: new THREE.Color(0x0a0a2a),
		dawn: new THREE.Color(0xff6b35),
		day: new THREE.Color(0x87ceeb),
		dusk: new THREE.Color(0xff4500)
	},
	
	ambientIntensity: {
		night: 0.1,
		dawn: 0.3,
		day: 0.8,
		dusk: 0.4
	},
	// sun and moon
	dirLightIntensity: {
		night: 0.05,
		dawn: 0.8,
		day: 2.5,
		dusk: 1.2
	},
	// moon light intensities
	moonLightIntensity: {
		night: 0.8,
		dawn: 0.3,
		day: 0.0,
		dusk: 0.4
	},
	// street light
	streetLightIntensity: {
		night: 15,
		dawn: 8,
		day: 2,
		dusk: 10
	}
};

function interpolateColor(color1, color2, factor) {
	const result = new THREE.Color();
	result.lerpColors(color1, color2, factor);
	return result;
}

function interpolateValue(value1, value2, factor) {
	return value1 + (value2 - value1) * factor;
}

function getSkyColor(timeOfDay) {
	const { skyColors } = dayNightConfig;
	
	if (timeOfDay < 0.25) {
		// night to dawn
		const factor = timeOfDay / 0.25;
		return interpolateColor(skyColors.night, skyColors.dawn, factor);
	} else if (timeOfDay < 0.5) {
		// dawn to day
		const factor = (timeOfDay - 0.25) / 0.25;
		return interpolateColor(skyColors.dawn, skyColors.day, factor);
	} else if (timeOfDay < 0.75) {
		// day to dusk
		const factor = (timeOfDay - 0.5) / 0.25;
		return interpolateColor(skyColors.day, skyColors.dusk, factor);
	} else {
		// dusk to night
		const factor = (timeOfDay - 0.75) / 0.25;
		return interpolateColor(skyColors.dusk, skyColors.night, factor);
	}
}

function getLightIntensity(timeOfDay, intensityConfig) {
	if (timeOfDay < 0.25) {
		const factor = timeOfDay / 0.25;
		return interpolateValue(intensityConfig.night, intensityConfig.dawn, factor);
	} else if (timeOfDay < 0.5) {
		const factor = (timeOfDay - 0.25) / 0.25;
		return interpolateValue(intensityConfig.dawn, intensityConfig.day, factor);
	} else if (timeOfDay < 0.75) {
		const factor = (timeOfDay - 0.5) / 0.25;
		return interpolateValue(intensityConfig.day, intensityConfig.dusk, factor);
	} else {
		const factor = (timeOfDay - 0.75) / 0.25;
		return interpolateValue(intensityConfig.dusk, intensityConfig.night, factor);
	}
}

function main() {
	const canvas = document.querySelector('#c');
	const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

	const loadManager = new THREE.LoadingManager();
	const loadingElem = document.querySelector('#loading');
	const progressBarElem = loadingElem.querySelector('.progressbar');

	loadManager.onLoad = () => {
		loadingElem.style.display = 'none';
		console.log('loaded');
	};

	loadManager.onProgress = (urlOfLastItemLoaded, itemsLoaded, itemsTotal) => {
		const progress = itemsLoaded / itemsTotal;
		progressBarElem.style.transform = `scaleX(${progress})`;
		console.log(`Progress: ${progress * 100}%`);
	};

	const fov = 75;
	const aspect = 2;
	const near = 0.1;
	const far = 100;
	const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
	camera.position.z = 10;
	camera.position.y = 5;
	camera.lookAt(0, 0, 0);

	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.minDistance = 3;
	controls.maxDistance = 20;
	controls.target.set(0, 0, 0);
	controls.update();

	const scene = new THREE.Scene();
	
	const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
	scene.add(ambientLight);

	// fin tower model
	{
		const objLoader = new OBJLoader(loadManager);
		const mtlLoader = new MTLLoader();

		mtlLoader.load('resources/models/fintower/obj.mtl', (mtl) => {
			mtl.preload();
			objLoader.setMaterials(mtl);
			objLoader.load('resources/models/fintower/tinker.obj', (root) => {
				root.scale.set(0.1, 0.1, 0.1);
				root.rotation.x = -Math.PI / 2;
				root.updateMatrixWorld(true);
				const bbox = new THREE.Box3().setFromObject(root);
				const minY = bbox.min.y;
				root.position.y = -minY;

				const towerMaterial = new THREE.MeshStandardMaterial({
					color: 0xA0AEC0,
					metalness: 0.8,
					roughness: 0.2
				});
				root.traverse((child) => {
					if (child.isMesh) {
						child.material = towerMaterial;
					}
				});
				scene.add(root);

				const pinkColor = 0xFF00FF;
				const pinkIntensity = 200;
				const pinkDistance = 50;
				const pinkLight = new THREE.PointLight(pinkColor, pinkIntensity, pinkDistance);
				pinkLight.position.set(.5, 35, 2);
				root.add(pinkLight);
				scene.add(pinkLight);
			});
		});
	}

	{
		const mtlLoader = new MTLLoader();
		mtlLoader.load( 'resources/models/windmill/windmill_001.mtl', ( mtl ) => {
			mtl.preload();
			const objLoader = new OBJLoader();
			mtl.materials.Material.side = THREE.DoubleSide;
			objLoader.setMaterials( mtl );
			objLoader.load( 'resources/models/windmill/windmill_001.obj', ( root ) => {
				root.position.set(-10, 0, -5);
				scene.add( root );
			} );
		} );
	}

	// Sun with enhanced glow
	const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
	const sunMaterial = new THREE.MeshBasicMaterial({
		color: 0xFFD700,
		emissive: 0xFFD700,
		emissiveIntensity: 1.2
	});
	const sun = new THREE.Mesh(sunGeometry, sunMaterial);
	scene.add(sun);

	// sun glow effect
	const sunGlowGeometry = new THREE.SphereGeometry(4.5, 32, 32);
	const sunGlowMaterial = new THREE.MeshBasicMaterial({
		color: 0xFFA500,
		transparent: true,
		opacity: 0.6,
		side: THREE.BackSide
	});
	const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
	sun.add(sunGlow);

	// Moon with blue glow
	const moonGeometry = new THREE.SphereGeometry(2, 32, 32);
	const moonMaterial = new THREE.MeshBasicMaterial({
		color: 0xE6E6FA,
		emissive: 0x4169E1,
		emissiveIntensity: 0.8
	});
	const moon = new THREE.Mesh(moonGeometry, moonMaterial);
	scene.add(moon);

	const moonGlowGeometry = new THREE.SphereGeometry(3, 32, 32);
	const moonGlowMaterial = new THREE.MeshBasicMaterial({
		color: 0x87CEEB,
		transparent: true,
		opacity: 0.5,
		side: THREE.BackSide
	});
	const moonGlow = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);
	moon.add(moonGlow);

	// DirectionalLight (sun)
	const dirColor = 0xFFD700;
	const dirIntensity = 0.1;
	const dirLight = new THREE.DirectionalLight(dirColor, dirIntensity);
	dirLight.position.set(0, 10, 0);
	dirLight.target.position.set(0, 0, 0);
	scene.add(dirLight);
	scene.add(dirLight.target);

	// moonlight
	const moonLightColor = 0x4169E1;
	const moonLightIntensity = 1;
	const moonLight = new THREE.DirectionalLight(moonLightColor, moonLightIntensity);
	moonLight.position.set(0, 10, 0);
	moonLight.target.position.set(5, 0, 0);
	scene.add(moonLight);
	scene.add(moonLight.target);

	// PointLight
	const pointColor = 0xFF8888;
	const pointIntensity = 5;
	const pointLight = new THREE.PointLight(pointColor, pointIntensity);
	pointLight.position.set(3, 3, -4);
	scene.add(pointLight);

	// SpotLight
	const spotColor = 0x88FF88;
	const spotIntensity = 15;
	const spotLight = new THREE.SpotLight(spotColor, spotIntensity);
	spotLight.position.set(-5, 8, 0);
	spotLight.target.position.set(-10, 0, -3);
	spotLight.angle = Math.PI / 6;
	spotLight.penumbra = 0.1;
	scene.add(spotLight);
	scene.add(spotLight.target);

	const dirHelper = new THREE.DirectionalLightHelper(dirLight);
	scene.add(dirHelper);
	const pointHelper = new THREE.PointLightHelper(pointLight);
	scene.add(pointHelper);
	const spotHelper = new THREE.SpotLightHelper(spotLight);
	scene.add(spotHelper);

	function updateLights() {
		dirLight.target.updateMatrixWorld();
		dirHelper.update();
		pointHelper.update();
		spotLight.target.updateMatrixWorld();
		spotHelper.update();
	}
	updateLights();

	const gui = new GUI();
	const dayNightFolder = gui.addFolder('Day-Night Cycle');
	dayNightFolder.add(dayNightConfig, 'autoPlay').name('Auto Play');
	dayNightFolder.add(dayNightConfig, 'currentTime', 0, 1, 0.01).name('Time of Day');
	dayNightFolder.add(dayNightConfig, 'cycleDuration', 10, 300, 1).name('Cycle Duration (s)');
	dayNightFolder.open();
	
	const dirFolder = gui.addFolder('Directional Light (sun)');
	dirFolder.addColor(new ColorGUIHelper(dirLight, 'color'), 'value').name('color');
	makeXYZGUI(dirFolder, dirLight.target.position, 'target', updateLights);

	const pointFolder = gui.addFolder('Point Light');
	pointFolder.addColor(new ColorGUIHelper(pointLight, 'color'), 'value').name('color');
	pointFolder.add(pointLight, 'intensity', 0, 5, 0.01);
	pointFolder.add(pointLight, 'distance', 0, 40).onChange(updateLights);
	makeXYZGUI(pointFolder, pointLight.position, 'position', updateLights);

	const spotFolder = gui.addFolder('Spot Light');
	spotFolder.addColor(new ColorGUIHelper(spotLight, 'color'), 'value').name('color');
	spotFolder.add(spotLight, 'intensity', 0, 30, 0.01);
	spotFolder.add(spotLight, 'angle', 0, Math.PI / 2).onChange(updateLights);
	spotFolder.add(spotLight, 'penumbra', 0, 1, 0.01);
	makeXYZGUI(spotFolder, spotLight.position, 'position', updateLights);
	makeXYZGUI(spotFolder, spotLight.target.position, 'target', updateLights);

	const loader = new THREE.TextureLoader(loadManager);

	// ground plane
	const planeSize = 40;
	const texture = loader.load('resources/images/grass.jpg');
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.magFilter = THREE.NearestFilter;
	const repeats = planeSize / 2;
	texture.repeat.set(repeats, repeats);

	const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
	const planeMat = new THREE.MeshPhongMaterial({
		map: texture,
		side: THREE.DoubleSide,
	});
	const mesh = new THREE.Mesh(planeGeo, planeMat);
	mesh.rotation.x = Math.PI * -.5;
	scene.add(mesh);

	// street lights for day-night cycle
	const streetLights = [];

	// city elements
	function createCity() {
		// buildings
		const buildingData = [
			[-12, -12,  4,    4,    12,   0xFF00FF, 0xFF00FF],
			[  0, -12,  3,    6,    15,   0xFF4500, 0xFF4500],
			[ 12, -12,  5,    5,    10,   0x00FF00, 0x00FF00],
			[-12,   0,  4,    3,    18,   0x0000FF, 0x0000FF],
			[ 12,   0,  3,    3,    14,   0x00FFFF, 0x00FFFF],
			[-12,  12,  6,    4,    20,   0xFFFF00, 0xFFFF00],
			[  0,  12,  5,    5,    16,   0xAAFF00, 0xAAFF00],
			[ 12,  12,  4,    4,    22,   0x00AAFF, 0x00AAFF],
		];

		const tilesTexture = loader.load('resources/images/tiles.jpg');
		tilesTexture.wrapS = THREE.RepeatWrapping;
		tilesTexture.wrapT = THREE.RepeatWrapping;
		tilesTexture.repeat.set(2, 4);

		for (const [x, z, w, d, h, color, lightColor] of buildingData) {
			const geo = new THREE.BoxGeometry(w, h, d);
			const mat = new THREE.MeshStandardMaterial({
				color: color,
				map: tilesTexture
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(x, h / 2, z);
			scene.add(mesh);

			const intensity  = 20;
			const distance   = 30;
			const decay      = 2;
			const rooftopLight = new THREE.PointLight(lightColor, intensity, distance, decay);
			rooftopLight.position.set(x, h + 5, z); 
			scene.add(rooftopLight);
		}

		// trees
		const treeData = [
			[-15, -15], [ -5, -15], [  5, -15], [ 15, -15],
			[-15,  -5], [ 15,  -5],
			[-15,   5], [ 15,   5],
			[-15,  15], [ -5,  15], [  5,  15], [ 15,  15],
		];

		const leavesTexture = loader.load('resources/images/leaves.jpg');
		leavesTexture.wrapS = THREE.RepeatWrapping;
		leavesTexture.wrapT = THREE.RepeatWrapping;
				
		for (const [x, z] of treeData) {
			const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
			const trunkMat = new THREE.MeshPhongMaterial({ color: 0x4A2F1B });
			const trunk = new THREE.Mesh(trunkGeo, trunkMat);
			
			const topGeo = new THREE.ConeGeometry(1.5, 3, 8);
			const topMat = new THREE.MeshPhongMaterial({ 
				color: 0x0F5F13,
				map: leavesTexture
			});
			const top = new THREE.Mesh(topGeo, topMat);
			top.position.y = 2.5;
			
			const treeGroup = new THREE.Group();
			treeGroup.add(trunk);
			treeGroup.add(top);
			treeGroup.position.set(x, 1, z);
			scene.add(treeGroup);
		}

		// street lamps
		const lampData = [
			[ -10,  5   ], [  -4,  3.7 ], [   5,  3.7 ], [  4.5, -9   ],
			[  -7, -9   ], [8.4, 10], [10,-3.5]
		];

		for (const [x, z] of lampData) {
			const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 8);
			const postMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
			const post = new THREE.Mesh(postGeo, postMat);
			
			const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
			const headMat = new THREE.MeshPhongMaterial({ 
				color: 0xFFD270,
				emissive: 0xFFFF00,
				emissiveIntensity: 0.5
			});
			const head = new THREE.Mesh(headGeo, headMat);
			head.position.y = 2.2;
			
			const lampLight = new THREE.PointLight(0xFFD270, 10, 10);
			lampLight.position.copy(head.position);
			
			// street light reference for day-night cycle
			streetLights.push(lampLight);
			
			const lampGroup = new THREE.Group();
			lampGroup.add(post);
			lampGroup.add(head);
			lampGroup.add(lampLight);
			lampGroup.position.set(x, 2, z);
			scene.add(lampGroup);
		}

		// benches
		const benchPositions = [
			[-10,  4], [ -4,  2.7], [  5,  2.7], [ 4.5, -10], [ -7, -10]
		];

		const benchTexture = loader.load('resources/images/wood.jpg');
		benchTexture.wrapS = THREE.RepeatWrapping;
		benchTexture.wrapT = THREE.RepeatWrapping;
		
		for (const [x, z] of benchPositions) {
			const benchGroup = new THREE.Group();
			const seatGeo = new THREE.BoxGeometry(2, 0.2, 0.8);
			const seatMat = new THREE.MeshPhongMaterial({ color: 0x614126, map: benchTexture });
			const seat = new THREE.Mesh(seatGeo, seatMat);
			seat.position.set(0, 0.6, 0);
			benchGroup.add(seat);

			for (let j = 0; j < 4; j++) {
				const legGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
				const legMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
				const leg = new THREE.Mesh(legGeo, legMat);
				const legX = (j < 2) ? -0.8 : 0.8;
				const legZ = (j % 2 === 0) ? -0.3 : 0.3;
				leg.position.set(legX, 0.3, legZ);
				benchGroup.add(leg);
			}

			benchGroup.position.set(x, 0, z);
			benchGroup.rotation.y = Math.random() * Math.PI * 2;
			scene.add(benchGroup);
		}

		// decorative spheres
		const sphereData = [
			[ -6,  -4,  0x8888FF ], [  7, -8.5,  0xC0C0C0 ],
			[ 10, 7.4, 0x2A2A2A ], [ -6, 10, 0xFFD700]
		];

		for (const [x, z, color] of sphereData) {
			const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
			const sphereMat = new THREE.MeshStandardMaterial({
				color,
				metalness: 0.8,
				roughness: 0.2
			});
			const sphere = new THREE.Mesh(sphereGeo, sphereMat);
			sphere.position.set(x, 1, z);
			scene.add(sphere);
		}
	}

	createCity();

	const torusGeo = new THREE.TorusGeometry(1.5, 0.4, 16, 100);
	const torusMat = new THREE.MeshStandardMaterial({
		color: 0xFF5500,
		metalness: 0.8,
		roughness: 0.2
	});
	const animatedTorus = new THREE.Mesh(torusGeo, torusMat);
	animatedTorus.position.set(3, 0, -4);
	scene.add(animatedTorus);

	camera.position.set(40, 30, 40);
	camera.lookAt(0, 15, 0);
	controls.target.set(0, 15, 0);
	controls.update();

	function resizeRendererToDisplaySize( renderer ) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {
			renderer.setSize( width, height, false );
		}
		return needResize;
	}

	function updateDayNightCycle(timeOfDay) {
		// sky color
		const skyColor = getSkyColor(timeOfDay);
		scene.background = skyColor;
		
		// ambient light
		const ambientIntensity = getLightIntensity(timeOfDay, dayNightConfig.ambientIntensity);
		ambientLight.intensity = ambientIntensity;
		
		// sun and moon positions
		const celestialDistance = 80;
		const sunAngle = timeOfDay * Math.PI * 2 - Math.PI / 2; // Start from east
		const moonAngle = sunAngle + Math.PI; // Moon is opposite to sun
		
		// sun position and lighting
		const sunX = Math.cos(sunAngle) * celestialDistance;
		const sunY = Math.sin(sunAngle) * celestialDistance + 10;
		const sunZ = 0;
		
		sun.position.set(sunX, sunY, sunZ);
		dirLight.position.copy(sun.position);
		
		// sun (visible during day)
		const sunVisibility = Math.max(0, Math.sin(sunAngle));
		sun.visible = sunVisibility > 0.1;
		const sunLightIntensity = getLightIntensity(timeOfDay, dayNightConfig.dirLightIntensity);
		dirLight.intensity = sunLightIntensity;
		if (sun.visible) {
			sunMaterial.emissiveIntensity = 1.2 + (0.8 * sunVisibility);
			sunGlowMaterial.opacity = 0.6 * sunVisibility;
		}
		
		const moonX = Math.cos(moonAngle) * celestialDistance;
		const moonY = Math.sin(moonAngle) * celestialDistance + 10;
		const moonZ = 0;
		moon.position.set(moonX, moonY, moonZ);
		moonLight.position.copy(moon.position);
		
		// moon (visible during night)
		const moonVisibility = Math.max(0, Math.sin(moonAngle));
		moon.visible = moonVisibility > 0.1;
		const moonLightIntensity = getLightIntensity(timeOfDay, dayNightConfig.moonLightIntensity);
		moonLight.intensity = moonLightIntensity;
		if (moon.visible) {
			moonMaterial.emissiveIntensity = 0.8 + (1.0 * moonVisibility);
			moonGlowMaterial.opacity = 0.5 * moonVisibility;
		}
		
		// update street lights
		const streetIntensity = getLightIntensity(timeOfDay, dayNightConfig.streetLightIntensity);
		streetLights.forEach(light => {
			light.intensity = streetIntensity;
		});
	}

	function render( time ) {
		time *= 0.001;

		if ( resizeRendererToDisplaySize( renderer ) ) {
			const canvas = renderer.domElement;
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
		}

		// update day-night cycle
		if (dayNightConfig.autoPlay) {
			dayNightConfig.currentTime = (time / dayNightConfig.cycleDuration) % 1;
		}
		updateDayNightCycle(dayNightConfig.currentTime);

		animatedTorus.rotation.y = time * 1.2; 
		animatedTorus.position.y = 3 + Math.sin(time * 2) * 0.5;
		controls.update();

		renderer.render( scene, camera );
		requestAnimationFrame( render );
	}

	requestAnimationFrame( render );
}

main();