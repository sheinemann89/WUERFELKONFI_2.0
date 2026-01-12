const DEFAULT_POSITION = { lat: 48.137154, lng: 11.576124, altitude: 0 };
const MODEL_COUNT = 3;

let map;
let overlay;
let scene;
let camera;
let renderer;
let transformer;

const modelSlots = Array.from({ length: MODEL_COUNT }, () => ({
  object: null,
  position: { ...DEFAULT_POSITION },
  url: null,
}));

const init = () => {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: DEFAULT_POSITION.lat, lng: DEFAULT_POSITION.lng },
    zoom: 18,
    tilt: 67,
    heading: 0,
    mapId: "DEMO_MAP_ID",
  });

  overlay = new google.maps.WebGLOverlayView();

  overlay.onAdd = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(0.5, 1, 0.5);
    scene.add(directional);

    modelSlots.forEach((slot) => {
      if (slot.object) {
        scene.add(slot.object);
      }
    });
  };

  overlay.onContextRestored = ({ gl }) => {
    renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
    });
    renderer.autoClear = false;
  };

  overlay.onDraw = ({ gl, transformer: mapTransformer }) => {
    transformer = mapTransformer;
    renderer.resetState();

    modelSlots.forEach((slot) => {
      if (!slot.object) {
        return;
      }
      const { lat, lng, altitude } = slot.position;
      const matrix = transformer.fromLatLngAltitude({ lat, lng, altitude });
      const threeMatrix = new THREE.Matrix4().fromArray(matrix);
      slot.object.matrixAutoUpdate = false;
      slot.object.matrix.copy(threeMatrix);
      slot.object.scale.set(3, 3, 3);
    });

    renderer.render(scene, camera);
    renderer.resetState();

    overlay.requestRedraw();
  };

  overlay.setMap(map);

  map.addListener("click", (event) => {
    const activeIndex = getActiveIndex();
    const slot = modelSlots[activeIndex];
    if (!slot) {
      return;
    }
    slot.position = {
      ...slot.position,
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    syncInputs(slot.position);
    overlay.requestRedraw();
  });

  bindControls();
};

const bindControls = () => {
  const inputs = [
    "model-input-1",
    "model-input-2",
    "model-input-3",
  ].map((id, index) => {
    const input = document.getElementById(id);
    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      loadModelFromFile(file, index);
    });
    return input;
  });

  const moveButtons = document.querySelectorAll("[data-move]");
  moveButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.move;
      moveActiveModel(direction);
    });
  });

  const select = document.getElementById("active-model");
  select.addEventListener("change", () => {
    const slot = modelSlots[getActiveIndex()];
    if (slot) {
      syncInputs(slot.position);
    }
  });

  const applyButton = document.getElementById("apply-coords");
  applyButton.addEventListener("click", () => {
    const slot = modelSlots[getActiveIndex()];
    if (!slot) {
      return;
    }
    const lat = parseFloat(document.getElementById("lat-input").value);
    const lng = parseFloat(document.getElementById("lng-input").value);
    const altitude = parseFloat(
      document.getElementById("alt-input").value,
    );
    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(altitude)) {
      return;
    }
    slot.position = { lat, lng, altitude };
    overlay.requestRedraw();
  });

  syncInputs(modelSlots[0].position);
};

const loadModelFromFile = (file, index) => {
  const slot = modelSlots[index];
  if (!slot) {
    return;
  }

  if (slot.url) {
    URL.revokeObjectURL(slot.url);
  }

  slot.url = URL.createObjectURL(file);
  const loader = new THREE.GLTFLoader();
  loader.load(slot.url, (gltf) => {
    if (slot.object) {
      scene.remove(slot.object);
    }
    slot.object = gltf.scene;
    slot.object.rotation.x = Math.PI / 2;
    slot.object.scale.set(3, 3, 3);
    if (scene) {
      scene.add(slot.object);
    }
    overlay.requestRedraw();
  });
};

const moveActiveModel = (direction) => {
  const slot = modelSlots[getActiveIndex()];
  if (!slot) {
    return;
  }
  const stepMeters = parseFloat(document.getElementById("step-size").value) || 5;
  const latOffset = metersToLat(stepMeters);
  const lngOffset = metersToLng(stepMeters, slot.position.lat);

  switch (direction) {
    case "north":
      slot.position.lat += latOffset;
      break;
    case "south":
      slot.position.lat -= latOffset;
      break;
    case "east":
      slot.position.lng += lngOffset;
      break;
    case "west":
      slot.position.lng -= lngOffset;
      break;
    default:
      break;
  }

  syncInputs(slot.position);
  overlay.requestRedraw();
};

const metersToLat = (meters) => meters / 111_320;
const metersToLng = (meters, latitude) =>
  meters / (111_320 * Math.cos((latitude * Math.PI) / 180));

const getActiveIndex = () => {
  const select = document.getElementById("active-model");
  return Number(select.value);
};

const syncInputs = (position) => {
  document.getElementById("lat-input").value = position.lat.toFixed(6);
  document.getElementById("lng-input").value = position.lng.toFixed(6);
  document.getElementById("alt-input").value = position.altitude.toFixed(0);
};

window.initMap = init;

window.addEventListener("load", () => {
  if (window.google && window.google.maps) {
    init();
  }
});
