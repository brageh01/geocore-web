import {
  Ion,
  buildModuleUrl,
  CameraEventType,
  createGooglePhotorealistic3DTileset,
  Viewer,
  Math as CesiumMath,
  Cartesian3,
  Color,
} from "cesium";

export function configureCesium() {
  (buildModuleUrl as unknown as { setBaseUrl: (url: string) => void }).setBaseUrl("/cesium/");

  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (ionToken) {
    Ion.defaultAccessToken = ionToken;
  }
}

export async function initializeViewer(
  container: HTMLElement
): Promise<Viewer> {
  configureCesium();

  const viewer = new Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    creditContainer: document.createElement("div"),
    msaaSamples: 4,
  });

  // Load Google Photorealistic 3D Tiles
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      const tileset = await createGooglePhotorealistic3DTileset({ key: googleApiKey });
      viewer.scene.primitives.add(tileset);
    } catch (e) {
      console.error("Failed to load Google 3D Tiles:", e);
    }
  } else {
    console.warn(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set — globe will render without 3D tiles"
    );
  }

  // Default camera: continental US overview (~35°N 100°W, 8000km altitude)
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(-100, 35, 8_000_000),
    orientation: {
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    },
  });

  // Dark sky atmosphere
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = true;
  }
  viewer.scene.globe.enableLighting = false;
  // Depth-test markers against terrain so points on the far side of the
  // earth are hidden behind the globe instead of rendering through it.
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.backgroundColor = new Color(0.04, 0.04, 0.04, 1.0);

  // Input / zoom configuration — ensure mouse wheel AND trackpad pinch both
  // drive zoom, and remove PINCH from tiltEventTypes so two-finger gestures
  // on a trackpad zoom cleanly instead of fighting with tilt.
  const controller = viewer.scene.screenSpaceCameraController;
  controller.zoomEventTypes = [CameraEventType.WHEEL, CameraEventType.PINCH];
  controller.tiltEventTypes = [CameraEventType.MIDDLE_DRAG];
  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 20_000_000;

  return viewer;
}
