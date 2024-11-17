import "@babylonjs/core/Loading/loadingScreen";
import Drone from "./drone";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Engine } from "@babylonjs/core/Engines/engine";
// import SkyBox from "./skyBox";
import { Inspector } from "@babylonjs/inspector";

import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
// import CustomLoadingScreenWithoutLogo from "./loadingScreenWithoutLogo";
// import { sliderContentArray } from "./droneSliderContent";
// import PhysicsToggler from "./elements/physicsToggler";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
// import Nightingale from "./drone/nightingale";
// import GamepadSettings from "./elements/droneGamepadSettings";
// import DroneInspector from "./inspector";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
// import F450 from "./drone/f450";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import {
  ISceneLoaderAsyncResult,
  SceneLoader,
} from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/core/Physics/physicsEngineComponent";
// import LoadingMesh from "./tasks/fileLoading";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
// import ThinInstanceManager from "./elements/thinInstanceManager";
// import PhysicsManager from "./elements/physicsManager";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeMesh } from "@babylonjs/core/Physics/v2/physicsShape";
// import questTimer from "./elements/questTimer";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import LocationManager from "./locationManager";

export default class MainScene {
  public scene: Scene;
  private drone: Drone;
  private camera: UniversalCamera;
  private fps: HTMLElement;
  private canvas: HTMLCanvasElement;
  private light: DirectionalLight;
  private shadowGenerator: ShadowGenerator;
  //   private skyBox: SkyBox;
  private hemiLight: HemisphericLight;
  private advancedTexture: AdvancedDynamicTexture;
  //   private isLocationLoaded = false;
  //   private isThreeSecondsPassed = false;
  //   private customLoadingScreen: CustomLoadingScreenWithoutLogo;
  private droneSpawnPosition: Vector3;
  //   private loadingMesh: LoadingMesh;
  //   private thinInstanceManager: ThinInstanceManager;
  //   private physicsManager: PhysicsManager;
  //   private qTimer: questTimer;
  //   private tryCount = 3;
  private location: LocationManager;
  constructor(private engine: Engine) {
    this.createScene();

    const mainCamera = new UniversalCamera(
      "UniversalCamera",
      new Vector3(0, 0.5, 0),
      this.scene
    );
    mainCamera.fov = 1.5;
    mainCamera.minZ = 0.1;
    this.camera = mainCamera;

    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("main");
    this.createInspector();
    this.createLocation();
    this.createFPSTracker();
  }

  createInspector(): void {
    const secondCamera = new UniversalCamera(
      "secondCamera",
      new Vector3(0, 3, 0),
      this.scene
    );
    secondCamera.minZ = 0;

    secondCamera.speed = 0.1;

    secondCamera.keysUp.push(87);
    secondCamera.keysLeft.push(65);
    secondCamera.keysDown.push(83);
    secondCamera.keysRight.push(68);

    this.scene.onKeyboardObservable.add((evt) => {
      if (evt.type === 2 && evt.event.code === "KeyU") {
        secondCamera.attachControl();
        this.camera.detachControl();
        Inspector.Show(this.scene, {});
        this.engine.exitPointerlock;
        this.scene.activeCameras = [];
        this.scene.activeCameras.push(secondCamera);
      } else if (evt.type === 2 && evt.event.code === "KeyO") {
        if (!this.engine.isPointerLock) this.engine.enterPointerlock();
        secondCamera.detachControl();
        // this.camera.attachControl();
        Inspector.Hide();
        this.scene.activeCameras = [];
        this.scene.activeCameras.push(this.camera);
      }
    });
  }

  createScene() {
    this.scene = new Scene(this.engine);

    const hemiLight = new HemisphericLight(
      "hemisphericLight",
      new Vector3(30, 30, 0),
      this.scene
    );
    hemiLight.intensity = 0.5;
    this.hemiLight = hemiLight;

    const dirLight = new DirectionalLight(
      "directionalLight",
      new Vector3(30, -30, -30),
      this.scene
    );
    dirLight.position = new Vector3(0, 5, 0);
    dirLight.direction = new Vector3(-30, -30, 30);
    dirLight.intensity = 5;
    this.light = dirLight;
  }

  async enablePhysic(): Promise<void> {
    console.log(this.scene);

    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);
    console.log(this.scene.enablePhysics, havokPlugin);
    this.scene.enablePhysics(new Vector3(0, -10, 0), havokPlugin);
  }

  async createLocation(): Promise<void> {
    // const promiseArray = [];
    // (this.scene.getEngine() as any).displayLoadingUI();

    // setTimeout(() => {
    //   this.isThreeSecondsPassed = true;
    //   if (this.isLocationLoaded && this.isThreeSecondsPassed) {
    //     this.customLoadingScreen.showLoadedWindow(this.scene);
    //   }
    // }, 3000);

    await this.enablePhysic();

    // this.skyBox = new SkyBox(this.scene);

    // promiseArray.push(this.importLocation());

    // Promise.all(promiseArray).then(async () => {
    //   this.scene.materials.forEach((material) => {
    //     material.transparencyMode = 1;
    //   });

    this.location = new LocationManager(this.scene);
    await this.location.createBaseArea();
    await this.createDrone();

    //   const inspector = new DroneInspector(this.scene, this.engine);
    //   inspector.createInspector();
    //   inspector.setMesh(this.drone.droneBox);

    //   this.isLocationLoaded = true;

    //   if (this.isLocationLoaded && this.isThreeSecondsPassed) {
    // this.customLoadingScreen.showLoadedWindow(this.scene);
    //   }

    //   const physicsToggler = new PhysicsToggler(
    //     this.scene,
    //     this.drone.droneBox
    //   );

    //   physicsToggler.initPhysicsToggler();

    // this.createQuest();
    // });

    // await this.setShadow();
  }

  //   private async importLocation(): Promise<AssetContainer> {
  //     const assetContainer = new AssetContainer(this.scene);

  //     const importedMesh = await SceneLoader.ImportMeshAsync(
  //       "",
  //       "../assets/models/droneMap/hypercube/",
  //       "Exam2024HangarNOVertex2.glb",
  //       this.scene,
  //       (evt) => {
  //         let loadedPercent = "0";
  //         if (evt.lengthComputable) {
  //           loadedPercent = ((evt.loaded * 100) / evt.total).toFixed();
  //         } else {
  //           const dlCount = evt.loaded / (1024 * 1024);
  //           loadedPercent = (Math.floor(dlCount * 100.0) / 100.0).toFixed();
  //         }
  //         this.loadingMesh.onProgress("Exam2024HangarNOVertex2", loadedPercent);
  //       }
  //     );

  //     importedMesh.meshes[0].name = "Exam2024HangarNOVertex2";

  //     const startMesh = importedMesh.meshes.find(
  //       (mesh) => mesh.name === "Объект Куб.1"
  //     );

  //     this.droneSpawnPosition = startMesh.getAbsolutePosition();

  //     importedMesh.meshes.forEach((mesh) => {
  //       if (
  //         !mesh.name.startsWith("Объект Куб.1") &&
  //         !mesh.name.startsWith("ArrowMarker")
  //       ) {
  //         const collisionNode = new TransformNode("sc_" + mesh.name);
  //         collisionNode.parent = mesh;
  //         const collisionNodeAggregate = new PhysicsAggregate(
  //           collisionNode,
  //           new PhysicsShapeMesh(mesh as Mesh, this.scene),
  //           { mass: 0, startAsleep: true },
  //           this.scene
  //         );
  //         if (mesh.name.startsWith("sc_")) {
  //           mesh.setEnabled(false);
  //         }
  //       }
  //       if (mesh.name.startsWith("Объект Куб.1")) {
  //         mesh.dispose();
  //       }
  //     });

  //     // this.physicsManager.setMapPhysics(importedMesh.meshes);
  //     this.thinInstanceManager.setThinInstances(importedMesh);

  //     importedMesh.meshes.forEach((el) => {
  //       // el.freezeWorldMatrix();
  //       // el.doNotSyncBoundingInfo = true;
  //       el.isPickable = false;
  //       el.checkCollisions = false;
  //       el.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  //     });

  //     await this.setShadow(importedMesh.meshes);

  //     assetContainer.addAllAssetsToContainer(importedMesh.meshes[0]);
  //     return assetContainer;
  //   }

  async setShadow(meshes?): Promise<void> {
    this.light.shadowEnabled = true;
    this.shadowGenerator = new ShadowGenerator(2048, this.light);
    this.shadowGenerator.darkness = 0.3;
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    // this.shadowGenerator.getShadowMap().refreshRate =
    //   RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    // this.light.autoUpdateExtends = false;
    this.light.shadowMaxZ = 10000;
    this.light.shadowMinZ = -10000;
    // meshes.forEach((mesh) => {
    //   if (
    //     mesh instanceof Mesh &&
    //     mesh.id !== "__root__" &&
    //     mesh.id !== "SkyDome"
    //   ) {
    //     mesh.receiveShadows = true;
    //     if (
    //       mesh.id != "SkyDome" &&
    //       mesh.id != "tree" &&
    //       mesh.id != "Ocean" &&
    //       mesh.id != "Lake" &&
    //       mesh.id != "Lake1" &&
    //       mesh.id != "Lake2" &&
    //       mesh.id != "WaterfallRiver" &&
    //       !mesh.id.includes("Terrain") &&
    //       !mesh.id.includes("Runway") &&
    //       mesh.id != "__root__" &&
    //       mesh.id != "Объект_Ландшафт" &&
    //       !mesh.id.includes("runway") &&
    //       !mesh.id.includes("Cargo") &&
    //       !mesh.id.includes("CarBox")
    //     ) {
    //       this.shadowGenerator.addShadowCaster(mesh);
    //     }
    //   }
    // });
  }

  async createDrone(): Promise<void> {
    const drone = new Drone(this.scene, this.advancedTexture);
    drone.init({
      position: this.droneSpawnPosition ?? new Vector3(-0.31, 30, 8.85),
      rotation: new Vector3(0, 0, 0),
    });
    drone.droneAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    // await drone.importModel();
    drone.setFirstViewCameraPosition(new Vector3(0, 0, -0.125));
    drone.setFirstViewCameraAngle(0);
    // const droneModel = drone.droneBox
    //   .getChildMeshes(true)
    //   .find((mesh) => mesh.name === "droneModel");
    // droneModel.receiveShadows = true;
    // this.shadowGenerator.addShadowCaster(droneModel);
    this.drone = drone;

    this.drone.setStillMode(true);
    this.drone.reset();

    // const gamepadSettings = new GamepadSettings(
    //   this.scene,
    //   this.advancedTexture,
    //   this.drone
    // );
    this.drone.droneAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
  }

  private createFPSTracker(): void {
    const fps = document.getElementById("fps");
    fps.style.display = "block";
    const sceneInstrumentation = new SceneInstrumentation(this.scene);
    sceneInstrumentation.captureFrameTime = true;
    sceneInstrumentation.capturePhysicsTime = true;

    const fpsTextBlock = new TextBlock("fps");
    fpsTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    fpsTextBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;

    // this.advancedTexture.addControl(fpsTextBlock);

    this.scene.registerBeforeRender(() => {
      const ft = sceneInstrumentation.frameTimeCounter.lastSecAverage;
      fps.innerHTML = (1000 / ft).toFixed() + " fps";

      fpsTextBlock.text = (1000 / ft).toFixed() + " fps";
    });
  }

  private createQuest() {
    let timeStarted = false;
    // this.qTimer = new questTimer();

    // const tryCountTextBox = this.createTryCountGUI();
    // const timeTextBox = this.createTimerGUI();

    const startPlane = MeshBuilder.CreatePlane("StartPlane", {
      sideOrientation: 2,
    });
    startPlane.position = new Vector3(-0.75, 0.9, 0.46);
    startPlane.isVisible = false;
    // const startObserver = this.scene.onBeforePhysicsObservable.add(() => {
    //   if (startPlane.intersectsMesh(this.drone.droneBox) && !timeStarted) {
    //     timeStarted = true;
    //     this.resetTimeBox();
    //     this.qTimer.startMiliTimer();
    //   }
    // });
    const finishPlane = MeshBuilder.CreatePlane("FinishPlane", {
      sideOrientation: 2,
    });
    finishPlane.position = new Vector3(0.75, 0.9, 0.46);
    finishPlane.isVisible = false;
    // const finishObserver = this.scene.onBeforePhysicsObservable.add(() => {
    //   if (finishPlane.intersectsMesh(this.drone.droneBox) && timeStarted) {
    //     timeStarted = false;
    //     this.qTimer.stopMiliTimer();
    //     this.checkTime();
    //     this.tryCount--;
    //     tryCountTextBox.text = "Попыток: " + this.tryCount.toFixed();
    //   }
    //   if (this.drone.getCrushed()) {
    //     timeStarted = false;
    //     this.qTimer.stopMiliTimer();
    //     this.qTimer.resetTimer();
    //   }
    // });

    // const timeInterval = setInterval(() => {
    //   timeTextBox.text = this.qTimer.getFormattedTime() ?? "00:00.00";
    // }, 10);

    // const tryObserver = this.scene.onBeforePhysicsObservable.add(() => {
    //   if (this.tryCount === 0) {
    //     this.scene.onBeforePhysicsObservable.remove(startObserver);
    //     this.scene.onBeforePhysicsObservable.remove(finishObserver);
    //     this.scene.onBeforePhysicsObservable.remove(tryObserver);
    //     if (timeInterval) {
    //       clearInterval(timeInterval);
    //       timeTextBox.text = "";
    //     }
    //   }
    // });

    // this.scene.onKeyboardObservable.add((evt) => {
    //   if (evt.type === 2 && evt.event.code === "KeyR") {
    //     timeStarted = false;
    //     this.qTimer.stopMiliTimer();
    //     this.qTimer.resetTimer();
    //     this.resetTimeBox();
    //   }
    // });
  }

  //   private checkTime() {
  //     this.resetTimeBox();
  //     const time = new TextBlock("TimeText");
  //     time.color = "white";
  //     time.fontSize = "30%";
  //     time.outlineWidth = 5;
  //     time.outlineColor = "#280046";
  //     time.text = this.qTimer.getFormattedTime();
  //     this.advancedTexture.addControl(time);
  //   }

  //   private resetTimeBox() {
  //     if (
  //       this.advancedTexture
  //         .getChildren()[0]
  //         .children.find((el) => el.name === "TimeText")
  //     ) {
  //       this.advancedTexture
  //         .getChildren()[0]
  //         .children.find((el) => el.name === "TimeText")
  //         .dispose();
  //     }
  //   }

  //   private createTryCountGUI(): TextBlock {
  //     const tryCountText = new TextBlock("TryCount");
  //     tryCountText.color = "white";
  //     tryCountText.fontSize = "25px";
  //     tryCountText.widthInPixels = 150;
  //     tryCountText.heightInPixels = 50;
  //     tryCountText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  //     tryCountText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  //     tryCountText.left = "2%";
  //     tryCountText.top = "3%";
  //     tryCountText.text = "Попыток: " + this.tryCount.toFixed();
  //     this.advancedTexture.addControl(tryCountText);
  //     return tryCountText;
  //   }

  //   private createTimerGUI(): TextBlock {
  //     const timerText = new TextBlock("TimerText");
  //     timerText.color = "white";
  //     timerText.fontSize = "35px";
  //     timerText.widthInPixels = 200;
  //     timerText.heightInPixels = 50;
  //     timerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  //     timerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  //     timerText.top = "5%";
  //     timerText.fontFamily = "Courier New";
  //     timerText.fontWeight = "900";
  //     timerText.text = this.qTimer.getFormattedTime() ?? "00:00.00";
  //     this.advancedTexture.addControl(timerText);
  //     return timerText;
  //   }
}
