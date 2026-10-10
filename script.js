let peer = null;
let playerName = "Player";
let serverName = "3D Room";
let shortId = "";
let isHost = false;

const connections = {};
const otherPlayers = {};
const bullets = [];

const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// Проверка мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Элементы UI
const menuEl = document.getElementById('menu');
const uiEl = document.getElementById('ui');
const nicknameInput = document.getElementById('nickname-input');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const createPanel = document.getElementById('create-panel');
const joinPanel = document.getElementById('join-panel');
const serverNameInput = document.getElementById('server-name-input');
const joinIdInput = document.getElementById('join-id-input');
const btnConfirmCreate = document.getElementById('btn-confirm-create');
const btnConfirmJoin = document.getElementById('btn-confirm-join');
const uiServerName = document.getElementById('ui-server-name');
const uiServerId = document.getElementById('ui-server-id');

// Чат элементов
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// Мобильные элементы
const mobileControls = document.getElementById('mobile-controls');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const btnMobileJump = document.getElementById('btn-mobile-jump');
const btnMobileShoot = document.getElementById('btn-mobile-shoot');

let joystickDir = { x: 0, y: 0 };

function generateShortId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

btnCreate.addEventListener('click', () => {
  createPanel.classList.remove('hidden');
  joinPanel.classList.add('hidden');
});

btnJoin.addEventListener('click', () => {
  joinPanel.classList.remove('hidden');
  createPanel.classList.add('hidden');
});

btnConfirmCreate.addEventListener('click', () => {
  playerName = nicknameInput.value.trim() || "Player_" + Math.floor(Math.random() * 100);
  serverName = serverNameInput.value.trim() || "Мой Сервер";
  shortId = generateShortId();
  isHost = true;
  initNetwork(shortId);
});

btnConfirmJoin.addEventListener('click', () => {
  playerName = nicknameInput.value.trim() || "Player_" + Math.floor(Math.random() * 100);
  shortId = joinIdInput.value.trim().toUpperCase();
  isHost = false;

  if (!shortId) {
    alert("Введите ID сервера!");
    return;
  }
  initNetwork('guest-' + generateShortId());
});

function initNetwork(myId) {
  peer = new Peer(myId);

  peer.on('open', () => {
    menuEl.classList.add('hidden');
    uiEl.classList.remove('hidden');
    chatContainer.classList.remove('hidden');

    if (isMobile) {
      mobileControls.classList.remove('hidden');
      document.getElementById('pc-controls').style.display = 'none';
      setupJoystick();
    }

    if (isHost) {
      uiServerName.innerText = `Сервер: ${serverName}`;
      uiServerId.innerText = `ID подключения: ${shortId}`;
    } else {
      uiServerName.innerText = `Подключение...`;
      uiServerId.innerText = `ID сервера: ${shortId}`;
      const conn = peer.connect(shortId);
      setupConnection(conn);
    }

    startGame();
  });

  peer.on('connection', (conn) => {
    setupConnection(conn);
  });
}

function setupConnection(conn) {
  conn.on('open', () => {
    connections[conn.peer] = conn;
    if (isHost) {
      conn.send({ type: 'init', serverName: serverName });
    }
  });

  conn.on('data', (data) => {
    if (data.type === 'init') {
      uiServerName.innerText = `Сервер: ${data.serverName}`;
    } else if (data.type === 'state') {
      updateOtherPlayer(data);
      if (isHost) broadcastData(data, conn.peer);
    } else if (data.type === 'shoot') {
      spawnBullet(data.x, data.y, data.z, data.dirX, data.dirY, data.dirZ, false);
      if (isHost) broadcastData(data, conn.peer);
    } else if (data.type === 'chat') {
      addChatMessage(data.sender, data.text);
      if (isHost) broadcastData(data, conn.peer);
    }
  });

  conn.on('close', () => {
    removeOtherPlayer(conn.peer);
    delete connections[conn.peer];
  });
}

function broadcastData(data, excludePeerId = null) {
  Object.keys(connections).forEach(peerId => {
    if (peerId !== excludePeerId && connections[peerId].open) {
      connections[peerId].send(data);
    }
  });
}

// --- Логика Чата ---
function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addChatMessage(playerName, text);
  broadcastData({ type: 'chat', sender: playerName, text: text });
  chatInput.value = '';
  chatInput.blur();
}

function addChatMessage(sender, text) {
  const msgEl = document.createElement('div');
  msgEl.innerHTML = `<b>${sender}:</b> ${text}`;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

// --- Джойстик управления ---
function setupJoystick() {
  let touchId = null;

  joystickBase.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    updateJoystick(touch);
  });

  window.addEventListener('touchmove', (e) => {
    if (touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        updateJoystick(e.changedTouches[i]);
        break;
      }
    }
  });

  const resetJoystick = (e) => {
    if (touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        touchId = null;
        joystickStick.style.top = '35px';
        joystickStick.style.left = '35px';
        joystickDir = { x: 0, y: 0 };
        break;
      }
    }
  };

  window.addEventListener('touchend', resetJoystick);
  window.addEventListener('touchcancel', resetJoystick);

  function updateJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    const maxDist = rect.width / 2;

    const dist = Math.hypot(deltaX, deltaY);
    if (dist > maxDist) {
      deltaX = (deltaX / dist) * maxDist;
      deltaY = (deltaY / dist) * maxDist;
    }

    joystickStick.style.left = `${35 + deltaX}px`;
    joystickStick.style.top = `${35 + deltaY}px`;

    joystickDir = {
      x: deltaX / maxDist,
      y: deltaY / maxDist
    };
  }

  btnMobileJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    doJump();
  });

  btnMobileShoot.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shoot();
  });
}

// --- Three.js Игра ---
let scene, camera, renderer, player;
const loader = new THREE.GLTFLoader();
let isLocked = false, yaw = 0, pitch = 0;
const keys = {};

let velocityY = 0;
const gravity = -0.015;
const jumpPower = 0.35;
let isGrounded = true;

function createNameCanvas(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#00fff5';
  ctx.font = 'Bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(4, 1, 1);
  sprite.position.y = 2.5;
  return sprite;
}

function createPlayerGroup(name) {
  const group = new THREE.Group();
  const placeholderGeo = new THREE.BoxGeometry(1, 2, 1);
  const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x00fff5, wireframe: true });
  const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
  placeholderMesh.position.y = 1;
  group.add(placeholderMesh);

  group.add(createNameCanvas(name));

  loader.load(MODEL_URL, (gltf) => {
    group.remove(placeholderMesh);
    const model = gltf.scene;
    model.scale.set(0.4, 0.4, 0.4);
    model.rotation.y = Math.PI;
    model.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    group.add(model);
  });

  return group;
}

function startGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.02);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x16213e })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(100, 40, 0x00fff5, 0x0f3460);
  grid.position.y = 0.01;
  scene.add(grid);

  player = createPlayerGroup(playerName);
  player.position.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
  scene.add(player);

  if (!isMobile) {
    document.body.addEventListener('click', (e) => {
      if (!menuEl.classList.contains('hidden') || document.activeElement === chatInput) return;
      if (!isLocked) {
        document.body.requestPointerLock();
      } else {
        shoot();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isLocked = document.pointerLockElement === document.body;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isLocked) return;
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
    });
  }

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) return;
    keys[e.code] = true;
    if (e.code === 'Enter') {
      chatInput.focus();
    }
  });

  window.addEventListener('keyup', (e) => keys[e.code] = false);

  animate();
}

function doJump() {
  if (isGrounded) {
    velocityY = jumpPower;
    isGrounded = false;
  }
}

function shoot() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const startPos = player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  spawnBullet(startPos.x, startPos.y, startPos.z, dir.x, dir.y, dir.z, true);

  broadcastData({
    type: 'shoot',
    x: startPos.x,
    y: startPos.y,
    z: startPos.z,
    dirX: dir.x,
    dirY: dir.y,
    dirZ: dir.z
  });
}

function spawnBullet(x, y, z, dirX, dirY, dirZ, isLocal) {
  const geo = new THREE.SphereGeometry(0.2, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: isLocal ? 0x00fff5 : 0xff0055 });
  const bullet = new THREE.Mesh(geo, mat);
  bullet.position.set(x, y, z);
  scene.add(bullet);

  bullets.push({
    mesh: bullet,
    dir: new THREE.Vector3(dirX, dirY, dirZ),
    life: 120
  });
}

function updateOtherPlayer(pData) {
  if (!otherPlayers[pData.id]) {
    const meshGroup = createPlayerGroup(pData.name || "Player");
    scene.add(meshGroup);

    otherPlayers[pData.id] = { mesh: meshGroup };
  }

  otherPlayers[pData.id].mesh.position.set(pData.x, pData.y, pData.z);
  otherPlayers[pData.id].mesh.rotation.y = pData.rotationY || 0;
}

function removeOtherPlayer(id) {
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id].mesh);
    delete otherPlayers[id];
  }
}

function animate() {
  requestAnimationFrame(animate);

  player.rotation.y = yaw;

  // Расчёт движения (Клавиатура или Мобильный джойстик)
  const moveVector = new THREE.Vector3();

  if (isMobile) {
    moveVector.x = joystickDir.x;
    moveVector.z = joystickDir.y;
  } else {
    if (keys['KeyW']) moveVector.z -= 1;
    if (keys['KeyS']) moveVector.z += 1;
    if (keys['KeyA']) moveVector.x -= 1;
    if (keys['KeyD']) moveVector.x += 1;
  }

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize();
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    player.position.addScaledVector(moveVector, 0.15);
  }

  if (keys['Space']) doJump();

  // Гравитация
  velocityY += gravity;
  player.position.y += velocityY;

  if (player.position.y <= 0) {
    player.position.y = 0;
    velocityY = 0;
    isGrounded = true;
  }

  // Пули
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, 0.6);
    b.life--;

    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // Камера
  const cameraOffset = new THREE.Vector3(0, 3, 7);
  cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
  cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  
  camera.position.copy(player.position).add(cameraOffset);
  camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));

  // Отправка координат
  if (peer && peer.id) {
    broadcastData({
      type: 'state',
      id: peer.id,
      name: playerName,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.rotation.y
    });
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});