import {
  Ion,
  buildModuleUrl,
  CameraEventType,
  KeyboardEventModifier,
  createWorldTerrainAsync,
  DirectionalLight,
  ImageryLayer,
  IonWorldImageryStyle,
  Transforms,
  Viewer,
  Math as CesiumMath,
  Cartesian3,
  Cartesian4,
  Matrix4,
  Color,
} from "cesium";
import { publicEnv } from "@/lib/publicEnv";
import { DEFAULT_CAMERA } from "@/lib/cameraDefaults";

export function configureCesium() {
  (buildModuleUrl as unknown as { setBaseUrl: (url: string) => void }).setBaseUrl("/cesium/");

  const ionToken = publicEnv.cesiumIonToken;
  if (ionToken) {
    Ion.defaultAccessToken = ionToken;
  }
}

// Imagery colour trim. Bing Aerial is a global mosaic graded to stay legible
// under road and label overlays, which is not what we draw on it: at regional
// zoom, unaugmented, it reads flat and slightly milky against a black page.
// These are deliberately small — enough to give vegetation and rock some
// separation, not enough to look filtered. Gamma below 1 deepens the midtones,
// which is where the haze sits; contrast and saturation then recover the bite
// that removing haze costs.
const IMAGERY_GAMMA = 0.92;
const IMAGERY_CONTRAST = 1.14;
const IMAGERY_SATURATION = 1.16;
const IMAGERY_BRIGHTNESS = 1.02;

// Relief shading. Cesium's default light is the real sun, which is correct for
// a globe you are simulating and wrong for one you are reading: half the planet
// falls into night and the fires there sit on black ground. The light is
// therefore synthetic and follows the camera around the globe, so every part of
// the visible surface is lit and the terminator never crosses the data.
//
// It is aimed the way a cartographer aims one, in the local east-north-up frame
// under the camera rather than off the camera's own axis. That distinction is
// the whole effect: a light raked a little off the view direction arrives
// nearly head-on to ground that faces the sky, N·L barely changes from pixel to
// pixel, and the result is a uniform dimmer that shades nothing. Illumination
// from low on the horizon is what turns a few degrees of slope into a visible
// step, which is why hillshading has used a low north-western sun since it was
// done by hand.
//
// 315 degrees is that convention — light from the upper left, which the eye
// reads as raised rather than sunken. 38 degrees of elevation is low enough to
// bite and high enough to keep valley floors off pure black.
const LIGHT_AZIMUTH_DEG = 315;
const LIGHT_ELEVATION_DEG = 38;
// Above 1 the diffuse term clips to white across most of the frame and takes
// the relief with it — measured: intensity 1.35 and 6.0 render identically.
const LIGHT_INTENSITY = 0.95;

/**
 * Construct the viewer. **Synchronous, deliberately.**
 *
 * This used to be one async `initializeViewer` that awaited the globe surface
 * before returning. That made correct teardown impossible: the `Viewer` is
 * built on the first line but the caller only receives it after the await, so
 * a React effect cleanup that fired during loading had nothing to destroy.
 * Under Strict Mode's mount/unmount/mount that produced two live viewers on
 * one container — layers bound to one, the visible canvas belonging to the
 * other.
 *
 * Returning the viewer synchronously means a caller always holds a concrete
 * reference it can destroy, whatever the network is doing. Terrain arrives
 * separately via `loadWorldTerrain`.
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
    // Stated rather than inherited. This is the same Ion asset Cesium would
    // pick on its own today (2, Bing Aerial, unlabelled), but "today" is the
    // problem: the default has moved before and the whole look of the globe
    // rides on it. AERIAL and not AERIAL_WITH_LABELS because the app draws its
    // own labels and place names would compete with them.
    //
    // The cast covers a gap in Cesium's own typings: `style` is documented on
    // fromWorldImagery and handled at runtime, but WorldImageryConstructorOptions
    // is aliased straight to ImageryLayer.ConstructorOptions, which omits it.
    baseLayer: ImageryLayer.fromWorldImagery({
      style: IonWorldImageryStyle.AERIAL,
      gamma: IMAGERY_GAMMA,
      contrast: IMAGERY_CONTRAST,
      saturation: IMAGERY_SATURATION,
      brightness: IMAGERY_BRIGHTNESS,
    } as ImageryLayer.ConstructorOptions & { style: IonWorldImageryStyle }),
  });

  // Opening view — see lib/cameraDefaults.ts for why it sits over the Atlantic.
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height
    ),
    orientation: {
      heading: CesiumMath.toRadians(DEFAULT_CAMERA.headingDeg),
      pitch: CesiumMath.toRadians(DEFAULT_CAMERA.pitchDeg),
      roll: CesiumMath.toRadians(DEFAULT_CAMERA.rollDeg),
    },
  });

  // Dark sky atmosphere. The starfield is Cesium's default skyBox and is left
  // alone; backgroundColor only shows where neither reaches.
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = true;
  }
  viewer.scene.backgroundColor = new Color(0.04, 0.04, 0.04, 1.0);

  // Terrain lighting. Off, this shades nothing and the mountains stay a painted
  // texture; on, the vertex normals requested in `loadWorldTerrain` turn real
  // elevation into visible relief.
  viewer.scene.globe.enableLighting = true;
  // The ground atmosphere follows scene.light by default. Since scene.light now
  // follows the camera, leaving this on drags a bright spot around the limb as
  // the globe turns. Fixed lighting keeps the edge glow even.
  viewer.scene.globe.dynamicAtmosphereLighting = false;

  const light = new DirectionalLight({
    direction: Cartesian3.clone(viewer.camera.directionWC),
    intensity: LIGHT_INTENSITY,
  });
  viewer.scene.light = light;

  const azimuth = CesiumMath.toRadians(LIGHT_AZIMUTH_DEG);
  const elevation = CesiumMath.toRadians(LIGHT_ELEVATION_DEG);
  const enuScratch = new Matrix4();
  const axisScratch = new Cartesian4();
  const towardSunScratch = new Cartesian3();
  const termScratch = new Cartesian3();

  const addScaledColumn = (column: number, scalar: number) => {
    Matrix4.getColumn(enuScratch, column, axisScratch);
    Cartesian3.fromCartesian4(axisScratch, termScratch);
    Cartesian3.multiplyByScalar(termScratch, scalar, termScratch);
    Cartesian3.add(towardSunScratch, termScratch, towardSunScratch);
  };

  const updateLightDirection = () => {
    // East-north-up under the camera. Columns 0/1/2 are east, north and up.
    Transforms.eastNorthUpToFixedFrame(
      viewer.camera.positionWC,
      viewer.scene.globe.ellipsoid,
      enuScratch
    );
    // Vector pointing *at* the light, from azimuth measured clockwise from
    // north and elevation above the local horizon.
    Cartesian3.clone(Cartesian3.ZERO, towardSunScratch);
    addScaledColumn(0, Math.cos(elevation) * Math.sin(azimuth)); // east
    addScaledColumn(1, Math.cos(elevation) * Math.cos(azimuth)); // north
    addScaledColumn(2, Math.sin(elevation)); // up
    // A DirectionalLight stores the direction light *travels*, the opposite.
    Cartesian3.normalize(towardSunScratch, towardSunScratch);
    Cartesian3.negate(towardSunScratch, light.direction);
  };
  updateLightDirection();
  // Dies with the viewer: destroy() tears the scene down and the event with it.
  viewer.scene.preRender.addEventListener(updateLightDirection);

  // Depth-test markers against terrain. With real elevation loaded this now
  // does what it always claimed to: a detection on the far slope of a ridge is
  // behind geometry, not merely behind a sphere. FireLayer decides when to opt
  // out of it — see FIRE_DEPTH_TEST_OFF_WITHIN_M there.
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // Input / zoom configuration — ensure mouse wheel AND trackpad pinch both
  // drive zoom, and remove PINCH from tiltEventTypes so two-finger gestures
  // on a trackpad zoom cleanly instead of fighting with tilt.
  //
  // The CTRL-modified WHEEL entry is what makes a trackpad *pinch* work.
  // Browsers do not report a pinch as a touch gesture on a trackpad: they
  // synthesise a wheel event with ctrlKey set. Cesium reads that modifier
  // (ScreenSpaceEventHandler.getModifier) and dispatches to the WHEEL+CTRL
  // action, so a zoomEventTypes list containing only bare WHEEL never sees it —
  // the event arrives, gets preventDefault'd, and is then dropped. Cesium's own
  // default list has the same gap, so pinch has never zoomed here.
  //
  // CameraEventType.PINCH below is the *touchscreen* two-finger gesture, which
  // is a different input path and is left alone.
  const controller = viewer.scene.screenSpaceCameraController;
  controller.zoomEventTypes = [
    CameraEventType.WHEEL,
    CameraEventType.PINCH,
    { eventType: CameraEventType.WHEEL, modifier: KeyboardEventModifier.CTRL },
  ];
  controller.tiltEventTypes = [CameraEventType.MIDDLE_DRAG];
  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 20_000_000;

  return viewer;
}

/**
 * Attach Cesium World Terrain.
 *
 * `requestVertexNormals` is the point of the exercise: without normals the
 * mesh has real elevation but nothing to shade it with, so a mountain range
 * renders as a silhouette against the horizon and as flat paint head-on.
 *
 * On failure the viewer keeps Cesium's default `EllipsoidTerrainProvider` — a
 * smooth globe with the same imagery, which is what this app rendered for its
 * whole life until now. That is a degraded scene, not a broken one, so the
 * failure is logged rather than surfaced.
 */
export async function loadWorldTerrain(viewer: Viewer): Promise<boolean> {
  try {
    const terrain = await createWorldTerrainAsync({
      requestVertexNormals: true,
    });
    // The viewer can be torn down while this request is in flight — a Strict
    // Mode remount does exactly that. Touching a destroyed viewer throws.
    if (viewer.isDestroyed()) return false;
    viewer.terrainProvider = terrain;
    return true;
  } catch (e) {
    console.error(
      "Failed to load Cesium World Terrain — the globe stays a smooth ellipsoid:",
      e
    );
    return false;
  }
}
