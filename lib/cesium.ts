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
import { publicEnv } from "@/lib/publicEnv";

export function configureCesium() {
  (buildModuleUrl as unknown as { setBaseUrl: (url: string) => void }).setBaseUrl("/cesium/");

  const ionToken = publicEnv.cesiumIonToken;
  if (ionToken) {
    Ion.defaultAccessToken = ionToken;
  }
}

/**
 * Construct the viewer. **Synchronous, deliberately.**
 *
 * This used to be one async `initializeViewer` that awaited the Google tileset
 * before returning. That made correct teardown impossible: the `Viewer` is
 * built on the first line but the caller only receives it after the await, so
 * a React effect cleanup that fired during loading had nothing to destroy.
 * Under Strict Mode's mount/unmount/mount that produced two live viewers on
 * one container — layers bound to one, the visible canvas belonging to the
 * other.
 *
 * Returning the viewer synchronously means a caller always holds a concrete
 * reference it can destroy, whatever the tileset is doing. Tiles load
 * separately via `loadPhotorealisticTiles`.
 */
export function createViewer(container: HTMLElement): Viewer {
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

/**
 * Attach Google Photorealistic 3D Tiles, if the key allows it.
 *
 * When these load they ARE the planet's surface — real elevation, real
 * buildings. Leaving Cesium's own globe visible underneath puts two surfaces in
 * nearly the same place, both writing depth, and the GPU resolves the tie
 * per-pixel: that is the shimmering "translucent and patchy" look, and it is
 * z-fighting rather than any translucency setting. So on success we hide the
 * globe and let the tileset be the surface.
 *
 * On failure we must NOT hide it — that would leave a black void with fire
 * points floating in it. Falling back to the Cesium globe keeps a usable scene
 * whatever Google says, and it says no fairly often: the key is HTTP-referrer
 * restricted, and separately, Photorealistic 3D Tiles are unavailable to
 * accounts in some regions regardless of referrer.
 *
 * Returns whether the tileset became the surface.
 */
export async function loadPhotorealisticTiles(viewer: Viewer): Promise<boolean> {
  const googleApiKey = publicEnv.googleMapsApiKey;
  if (!googleApiKey) {
    console.warn(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set — globe will render without 3D tiles"
    );
    return false;
  }

  try {
    const tileset = await createGooglePhotorealistic3DTileset({
      key: googleApiKey,
    });
    // The viewer can be torn down while this request is in flight — a Strict
    // Mode remount does exactly that. Touching a destroyed viewer throws.
    if (viewer.isDestroyed()) return false;
    viewer.scene.primitives.add(tileset);
    viewer.scene.globe.show = false;
    return true;
  } catch (e) {
    if (!viewer.isDestroyed()) viewer.scene.globe.show = true;
    console.error(
      "Failed to load Google 3D Tiles — falling back to the Cesium globe:",
      e
    );
    return false;
  }
}
