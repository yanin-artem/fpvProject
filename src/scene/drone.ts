import { Scene } from "@babylonjs/core/scene";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import {
  ISceneLoaderAsyncResult,
  SceneLoader,
} from "@babylonjs/core/Loading/sceneLoader";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import {
  IPhysicsCollisionEvent,
  PhysicsShapeType,
} from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Animation } from "@babylonjs/core/Animations/animation";
import "@babylonjs/loaders/glTF";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Ray } from "@babylonjs/core/Culling/ray";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";
// import Smoke from '../smoke';
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Observer } from "@babylonjs/core/Misc/observable";
import { KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
// import { DroneOptions } from './droneTypes';
import { PhysicsShapeMesh } from "@babylonjs/core/Physics/v2/physicsShape";
import DroneController from "./droneController";

export default class Drone {
  public droneBox: AbstractMesh;
  public droneController: DroneController;
  public droneAggregate: PhysicsAggregate;
  private crushed = false;
  private invulnerable = false;
  private stayInvulnerable = false;
  private position: Vector3;
  private rotation: Vector3;
  // private droneSmoke: Smoke;
  private droneInvulnerableTimeOut: NodeJS.Timeout;
  private resetTimeout: NodeJS.Timeout;
  private resetTimeoutSeconds = 5;
  private deltaTime: number;
  private firstViewCamera: UniversalCamera;
  private thirdViewCamera: UniversalCamera;
  private activeCamera: UniversalCamera;
  private cameraChangeObserver: Observer<KeyboardInfo>;
  private resetObserver: Observer<KeyboardInfo>;
  private infoBox: Rectangle;
  private stillObserver: Observer<Scene>;
  private stillModeObserver: Observer<Scene>;
  private stillModeKeyObserver: Observer<KeyboardInfo> = null;
  protected isDroneStill = false;
  protected isDroneStillMode = false;
  private skeletons: Skeleton[] = null;
  public isRaycastHit = false;
  public pickedMesh: number;
  private observer2d: Observer<Scene>;
  public onChangingCamera: (camera: UniversalCamera) => void = null;
  private stabMode = false;
  private moveObserver: Observer<Scene>;
  private observeThirdCamera: () => void;

  constructor(
    public scene: Scene,
    private advancedTexture: AdvancedDynamicTexture // private options?: DroneOptions
  ) {
    this.scene.registerBeforeRender(() => {
      this.deltaTime = (this.scene.getEngine() as any).getDeltaTime() / 1000;
    });
  }

  public init(options: {
    position: Vector3;
    rotation: Vector3;
    freeCamera?: boolean;
  }): AbstractMesh {
    this.position = options.position;
    this.rotation = options.rotation;

    this.droneBox = MeshBuilder.CreateBox("droneBox", {
      width: 0.5,
      height: 0.25,
      depth: 0.5,
    });

    this.droneBox._worldMatrix = this.droneBox.getWorldMatrix();
    this.droneBox.position = this.position.clone();
    this.droneBox.rotation = this.rotation.clone();

    // this.droneBox.isVisible = false;

    this.firstViewCamera = this.initFirstViewCamera();
    this.thirdViewCamera = this.initThirdViewCamera();

    this.activeCamera = this.firstViewCamera;
    if (!options.freeCamera) this.scene.activeCamera = this.activeCamera;

    this.changeCamera();

    this.droneAggregate = new PhysicsAggregate(
      this.droneBox,
      PhysicsShapeType.BOX,
      {
        mass: 1,
        restitution: 0.01,
      },
      this.scene
    );
    this.droneAggregate.body.setAngularDamping(10);
    this.droneAggregate.body.setLinearDamping(1);

    this.droneController = new DroneController(
      this.droneBox,
      this.droneAggregate,
      this.scene
    );

    this.checkCrushing();
    this.checkDroneStill();
    // this.observeStillMode();

    this.manageCameraOnInspector();

    return this.droneBox;
  }

  public getActiveCamera(): UniversalCamera {
    return this.activeCamera;
  }

  private manageCameraOnInspector() {
    let wasActive = true;
    document.addEventListener("onInspectorOpen", () => {
      wasActive = this.droneController.isActive;
      this.droneController.isActive = false;
    });
    document.addEventListener("onInspectorClose", () => {
      this.droneController.isActive = wasActive;
    });
  }

  private changeCamera(): void {
    this.cameraChangeObserver = this.scene.onKeyboardObservable.add((evt) => {
      if (evt.type === 2 && evt.event.code === "KeyC") {
        if (this.scene.activeCamera === this.firstViewCamera) {
          this.activeCamera = this.thirdViewCamera;
        } else if (this.scene.activeCamera === this.thirdViewCamera) {
          this.activeCamera = this.firstViewCamera;
        }
        this.scene.activeCamera = this.activeCamera;

        if (this.onChangingCamera != null) {
          this.onChangingCamera(this.activeCamera);
        }
      }
    });
  }

  public lockFPVCamera(): void {
    if (this.cameraChangeObserver) this.cameraChangeObserver.remove();
    this.activeCamera = this.firstViewCamera;
  }

  public unlockFPVCamera(): void {
    this.changeCamera();
  }

  public setFirstViewCameraAngle(angle: number) {
    this.firstViewCamera.rotation.x = (-angle * Math.PI) / 180;
  }

  public setFirstViewCameraPosition(position: Vector3) {
    this.firstViewCamera.position = position;
  }

  public set2DMode(value: boolean): void {
    if (value) {
      this.observer2d = this.scene.onBeforePhysicsObservable.add(() => {
        this.droneAggregate.body.setAngularVelocity(
          new Vector3(this.droneAggregate.body.getAngularVelocity().x, 0, 0)
        );
        // this.droneAggregate.body.disablePreStep = false;
        // this.droneBox.setAbsolutePosition(
        //   new Vector3(
        //     0,
        //     this.droneBox.getAbsolutePosition().y,
        //     this.droneBox.getAbsolutePosition().z
        //   )
        // );
      });
    } else {
      if (this.observer2d)
        this.scene.onBeforePhysicsObservable.remove(this.observer2d);
      this.scene.onAfterRenderObservable.addOnce(() => {
        this.droneAggregate.body.disablePreStep = true;
      });
    }
  }

  private initFirstViewCamera(): UniversalCamera {
    const camera = new UniversalCamera(
      "DroneFirstViewCamera",
      new Vector3(0, 0.5, 0),
      this.scene
    );
    camera.fov = 1.5;
    camera.minZ = 0.1;
    camera.parent = this.droneBox;
    camera.rotation._y = Math.PI;
    camera.rotation._x = -Math.PI / 6;

    return camera;
  }

  private initThirdViewCamera(): UniversalCamera {
    const camera = new UniversalCamera(
      "DroneThirdViewCamera",
      new Vector3(0, 0, 0),
      this.scene
    );

    camera.minZ = 0.1;
    camera.position = this.droneBox.position.clone();

    this.scene.registerBeforeRender(() => {
      camera.position = new Vector3(
        this.droneBox.forward.x,
        0,
        this.droneBox.forward.z
      )
        .normalize()
        .scale(2)
        .add(this.droneBox.position.clone())
        .clone();

      camera.setTarget(this.droneBox.position.clone());
    });

    return camera;
  }

  public getInvulnerable(): boolean {
    return this.stayInvulnerable;
  }

  public setInvulnerable(value: boolean): boolean {
    return (this.stayInvulnerable = value);
  }

  public getCrushed(): boolean {
    return this.crushed;
  }

  private checkCrushing(): void {
    let resetTimeoutStarted = false;
    let executed = false;

    this.scene.registerBeforeRender(() => {
      if (this.crushed) {
        this.droneController.isCrushed = true;
        if (this.stabMode) {
          this.droneController.TAKEOFF_SPEED = 15;
          this.droneAggregate.body.setGravityFactor(1);
          this.droneAggregate.body.setLinearDamping(1);
        }
      } else {
        this.droneController.isCrushed = false;
        if (this.stabMode) {
          this.droneController.TAKEOFF_SPEED = 15 - 9.81;
          this.droneAggregate.body.setGravityFactor(0);
          this.droneAggregate.body.setLinearDamping(2);
        }
      }

      if (this.crushed && !resetTimeoutStarted) {
        resetTimeoutStarted = true;
        this.resetTimeout = setInterval(() => {
          this.resetTimeoutSeconds--;
          if (this.resetTimeoutSeconds < 1) {
            clearInterval(this.resetTimeout);
            this.resetTimeoutSeconds = 5;
            resetTimeoutStarted = false;

            this.reset();
          }
        }, 1000);
      }
    });

    this.invulnerable = true;

    this.droneInvulnerableTimeOut = setTimeout(() => {
      this.invulnerable = false;
    }, 3000);

    this.resetObserver = this.scene.onKeyboardObservable.add((evt) => {
      if (evt.type === 2 && evt.event.code === "KeyR") {
        resetTimeoutStarted = false;
        this.resetTimeoutSeconds = 5;
        if (this.resetTimeout) clearInterval(this.resetTimeout);
        executed = false;

        this.reset();
      }
    });

    // this.droneSmoke = new Smoke(this.scene);
    // this.droneSmoke.createSmoke(this.droneBox);

    let collisionAngle = 0;

    this.droneAggregate.body.setCollisionCallbackEnabled(true);
    this.droneAggregate.body
      .getCollisionObservable()
      .add((collision: IPhysicsCollisionEvent) => {
        collisionAngle = Vector3.GetAngleBetweenVectors(
          this.droneBox.up,
          this.droneBox.position.subtract(collision.point).normalize(),
          Vector3.Cross(
            this.droneBox.up,
            this.droneBox.position.subtract(collision.point).normalize()
          ).normalize()
        );
        if (
          collision.impulse >= 0 &&
          !this.invulnerable &&
          !this.stayInvulnerable &&
          Math.round(collisionAngle) > 1 &&
          !executed
        ) {
          executed = true;
          this.crushed = true;
          // this.droneSmoke.smokeStart();
        } else if (
          collision.impulse > 100 &&
          !this.invulnerable &&
          !this.stayInvulnerable &&
          Math.round(collisionAngle) === 1 &&
          !executed
        ) {
          executed = true;
          this.crushed = true;
          // this.droneSmoke.smokeStart();
        }
      });
    this.createCrushingWarning();
  }

  private createCrushingWarning(): void {
    this.infoBox = new Rectangle("heightInfoBox");
    this.infoBox.width = "400px";
    this.infoBox.height = "130px";
    this.infoBox.color = "rgba(255,255,255,0.6)";
    this.infoBox.background = "rgba(0,0,0,0.6)";
    this.infoBox.cornerRadius = 10;
    this.infoBox.thickness = 2;
    this.infoBox.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.infoBox.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.infoBox.top = "10%";
    this.advancedTexture.addControl(this.infoBox);

    const Info = new TextBlock("heightInfo");
    Info.text = `БВС сломан!
Возрождение через ${this.resetTimeoutSeconds} сек.
Нажми R, чтобы не ждать`;

    this.scene.registerBeforeRender(() => {
      this.crushed
        ? (this.infoBox.isVisible = true)
        : (this.infoBox.isVisible = false);
      if (this.infoBox.isVisible) {
        Info.text = `БВС сломан!
Возрождение через ${this.resetTimeoutSeconds} сек.
Нажми R, чтобы не ждать`;
      }
    });
    Info.fontSize = "25px";
    Info.color = "white";
    Info.textWrapping = true;
    this.infoBox.addControl(Info);

    this.infoBox.isVisible = false;
  }

  public reset(): void {
    if (this.moveObserver)
      this.scene.onBeforePhysicsObservable.remove(this.moveObserver);
    this.crushed = false;
    // this.droneSmoke.smokeStop();
    this.setStillMode(false);
    if (this.stabMode) {
      this.droneController.TAKEOFF_SPEED = 15 - 9.81;
      this.droneAggregate.body.setGravityFactor(0);
      this.droneAggregate.body.setLinearDamping(2);
    } else {
      this.droneController.TAKEOFF_SPEED = 15;
      this.droneAggregate.body.setGravityFactor(1);
      this.droneAggregate.body.setLinearDamping(1);
    }
    this.setEngineForceLB(0);
    this.setEngineForceRB(0);
    this.setEngineForceLF(0);
    this.setEngineForceRF(0);
    this.droneController.engineForce = 0;
    if (this.droneInvulnerableTimeOut)
      clearTimeout(this.droneInvulnerableTimeOut);
    this.invulnerable = true;
    this.droneInvulnerableTimeOut = setTimeout(() => {
      this.invulnerable = false;
    }, 3000);

    this.droneAggregate.body.disablePreStep = false;
    this.droneAggregate.body.setLinearVelocity(Vector3.Zero());
    this.droneAggregate.body.setAngularVelocity(Vector3.Zero());
    this.droneAggregate.body.transformNode.position = this.position.clone();
    this.droneAggregate.body.transformNode.rotation = this.rotation.clone();

    if (this.scene.activeCamera.name === "UniversalDroneFollowCamera")
      this.scene.activeCamera.position = this.droneBox.position.clone();

    this.scene.onAfterPhysicsObservable.addOnce(() => {
      // setTimeout(() => {
      this.droneAggregate.body.disablePreStep = true;
      // }, 500);
    });
  }

  public setSpawnPosition(position: Vector3): Vector3 {
    return (this.position = position);
  }

  public setSpawnRotation(rotation: Vector3): Vector3 {
    return (this.rotation = rotation);
  }

  public setStillModeKey(key: string): Observer<KeyboardInfo> {
    this.stillModeKeyObserver = this.scene.onKeyboardObservable.add((evt) => {
      if (evt.type === 1 && evt.event.code === key) {
        if (this.getStillMode()) {
          this.setStillMode(false);
        } else {
          this.setStillMode(true);
        }
      }
    });
    return this.stillModeKeyObserver;
  }

  public setStillMode(mode: boolean): boolean {
    let gradient = 0;
    if (mode) {
      this.droneController.photoMode = true;
      this.droneController.isStopMode = true;
      this.droneAggregate.body.disablePreStep = false;
      this.droneAggregate.body.setGravityFactor(0);
      this.droneAggregate.body.setLinearVelocity(Vector3.Zero());
      this.isDroneStillMode = true;

      const droneRotation = this.droneBox.rotation.clone();

      this.stillModeObserver = this.scene.onBeforePhysicsObservable.add(() => {
        if (gradient < 1 && gradient >= 0) {
          this.droneBox.rotation = Vector3.Lerp(
            droneRotation,
            new Vector3(0, this.droneBox.rotation.y, 0),
            gradient
          );
          gradient += 0.025;
          if (gradient >= 1) {
            gradient = 1;
            this.scene.onBeforePhysicsObservable.remove(this.stillModeObserver);
            gradient = 0;
          }
        }
      });
    } else {
      this.scene.onBeforePhysicsObservable.remove(this.stillModeObserver);
      gradient = 0;
      this.droneController.photoMode = false;
      this.droneController.isStopMode = false;
      this.droneAggregate.body.setGravityFactor(1);
      this.isDroneStillMode = false;
      this.scene.onAfterRenderObservable.addOnce(() => {
        this.droneAggregate.body.disablePreStep = true;
      });
    }
    return this.isDroneStillMode;
  }

  public getStillMode(): boolean {
    return this.isDroneStillMode;
  }

  public checkDroneStill(): void {
    this.stillObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (
        this.droneAggregate.body.getLinearVelocity().length() === 0 &&
        !this.isDroneStillMode &&
        this.droneController.stopers.stopStabMode &&
        !this.droneController.stabModeOn
      )
        this.isDroneStill = true;
      else this.isDroneStill = false;

      if (this.isDroneStill) {
        this.droneBox.getChildMeshes().forEach((el) => {
          if (el.name.startsWith("Prop_")) {
            el.setEnabled(true);
          }
          if (el.name.startsWith("Plane_")) {
            el.setEnabled(false);
          }
          if (this.skeletons && this.skeletons[0])
            this.skeletons[0].bones.forEach((bone) => {
              if (bone.name.endsWith("_Prop")) {
                bone.getTransformNode().scaling = Vector3.One();
              }
            });
        });
      } else {
        this.droneBox.getChildMeshes().forEach((el) => {
          if (el.name.startsWith("Prop_")) {
            el.setEnabled(false);
          }
          if (el.name.startsWith("Plane_")) {
            el.setEnabled(true);
          }
          if (this.skeletons && this.skeletons[0])
            this.skeletons[0].bones.forEach((bone) => {
              if (bone.name.endsWith("_Prop")) {
                bone.getTransformNode().scaling = Vector3.Zero();
              }
            });
        });
      }
    });
  }

  protected setSkeletons(skeletons: Skeleton[]) {
    this.skeletons = skeletons;
  }

  public createRayCast(mesh?: AbstractMesh, targetName?: string): void {
    const origin = this.droneBox.getAbsolutePosition();
    let direction = this.droneBox.forward.negate();
    const length = 35;
    const array = ["MorzeDroneSphere", "FindBoxSphere", "StrawberryZone"];

    const raycastInterval = setInterval(() => {
      const ray = new Ray(origin, direction, length);
      direction = this.droneBox.forward.negate();
      const raycastHit = this.scene.pickWithRay(ray, (mesh: AbstractMesh) => {
        if (array.includes(mesh.name)) {
          return true;
        } else {
          return false;
        }
      });
      if (raycastHit.hit) {
        // console.log('Дрон видит: ', raycastHit.pickedMesh.name);
        this.isRaycastHit = true;
        this.pickedMesh = raycastHit.pickedMesh.uniqueId;
      } else {
        this.isRaycastHit = false;
        this.pickedMesh = null;
      }
    }, 500);
  }

  public moveUp(speed: number, time?: number): void {
    this.droneController.moveDroneUp(speed, time ? time : null);
  }
  public stopMoveUp(): void {
    this.droneController.stopMoveDroneUp();
  }
  public moveDown(speed: number, time?: number): void {
    this.droneController.moveDroneDown(speed, time ? time : null);
  }
  public stopMoveDown(): void {
    this.droneController.stopMoveDroneDown();
  }
  public rollForward(speed: number, time?: number): void {
    this.droneController.rollDroneForward(speed, time ? time : null);
  }
  public stopRollForward(): void {
    this.droneController.stopRollDroneForward();
  }
  public rollBackward(speed: number, time?: number): void {
    this.droneController.rollDroneBackward(speed, time ? time : null);
  }
  public stopRollBackward(): void {
    this.droneController.stopRollDroneBackward();
  }
  public rollLeft(speed: number, time?: number): void {
    this.droneController.rollDroneLeft(speed, time ? time : null);
  }
  public stopRollLeft(): void {
    this.droneController.stopRollDroneLeft();
  }
  public rollRight(speed: number, time?: number): void {
    this.droneController.rollDroneRight(speed, time ? time : null);
  }
  public stopRollRight(): void {
    this.droneController.stopRollDroneRight();
  }
  public rotateLeft(speed: number, time?: number): void {
    this.droneController.rotateDroneLeft(speed, time ? time : null);
  }
  public stopRotateLeft(): void {
    this.droneController.stopRotateDroneLeft();
  }
  public rotateRight(speed: number, time?: number): void {
    this.droneController.rotateDroneRight(speed, time ? time : null);
  }
  public stopRotateRight(): void {
    this.droneController.stopRotateDroneRight();
  }

  public setStabMode(value: boolean) {
    this.stabMode = value;
    this.droneController.stabModeOn = value;
    return this.stabMode;
  }
  public startStabMode(): void {
    this.droneController.startStabMode();
  }
  public stopStabMode(): void {
    this.droneController.stopStabMode();
  }

  public startPIDMode(): void {
    this.droneController.startPIDMode();
  }
  public stopPIDMode(): void {
    this.droneController.stopPIDMode();
  }

  public setSpeedForce(number: number): void {
    this.droneController.engineSpeed = number;
  }

  public setEngineForceLF(number: number): void {
    this.droneController.engineForce_LF =
      this.droneController.engineSpeed + number;
  }
  public setEngineForceRF(number: number): void {
    this.droneController.engineForce_RF =
      this.droneController.engineSpeed + number;
  }
  public setEngineForceLB(number: number): void {
    this.droneController.engineForce_LB =
      this.droneController.engineSpeed + number;
  }
  public setEngineForceRB(number: number): void {
    this.droneController.engineForce_RB =
      this.droneController.engineSpeed + number;
  }

  public stopAllMovement(): void {
    this.stopMoveUp();
    this.stopMoveDown();
    this.stopRollForward();
    this.stopRollBackward();
    this.stopRollLeft();
    this.stopRollRight();
    this.stopRotateLeft();
    this.stopRotateRight();
    this.stopStabMode();
    this.setEngineForceLF(0);
    this.setEngineForceRF(0);
    this.setEngineForceLB(0);
    this.setEngineForceRB(0);
  }

  public getDronePositionY(): number {
    return this.droneBox.position.y;
  }

  public moveDroneTo(positions: number[][]): void {
    let currentIndex = 0;
    let gradient = 0;
    let startPosition = this.droneBox.getAbsolutePosition().clone();
    const moveDroneFunc = () => {
      this.isDroneStillMode = true;

      this.droneAggregate.body.disablePreStep = false;
      this.droneAggregate.body.setGravityFactor(0);

      if (currentIndex > 0)
        startPosition = new Vector3(
          positions[currentIndex - 1][0],
          positions[currentIndex - 1][1],
          positions[currentIndex - 1][2]
        );
      const finishPosition = new Vector3(
        positions[currentIndex][0],
        positions[currentIndex][1],
        positions[currentIndex][2]
      );

      const distance = Vector3.Distance(startPosition, finishPosition);

      this.droneBox.lookAt(finishPosition, Math.PI, null, 0);

      if (gradient < 1) {
        this.droneBox.setAbsolutePosition(
          Vector3.Lerp(startPosition, finishPosition, gradient)
        );
        gradient += distance * 0.00005 * this.deltaTime;
        if (gradient > 1) gradient = 1;
      } else {
        this.scene.onBeforePhysicsObservable.remove(this.moveObserver);
        this.droneAggregate.body.setGravityFactor(1);
        this.droneBox.rotation = new Vector3(0, this.droneBox.rotation.y, 0);
        this.scene.onAfterRenderObservable.addOnce(() => {
          this.droneAggregate.body.disablePreStep = true;
        });
        this.isDroneStillMode = false;

        if (currentIndex < positions.length - 1) {
          currentIndex++;
          gradient = 0;
          this.moveObserver =
            this.scene.onBeforePhysicsObservable.add(moveDroneFunc);
        }
      }
    };

    this.moveObserver = this.scene.onBeforePhysicsObservable.add(moveDroneFunc);
  }

  public moveDroneToOne(positions: number[]) {
    return new Promise<void>((resolve) => {
      const transformNode = new TransformNode("DroneTransformNode");
      let gradient = 0;
      let rotated = false;

      const speed = 7;
      let elapsedTime = 0;
      let travelTime = 0;

      let directionFixed = false;
      let originRotation = null;
      let finishRotation = null;

      const startPosition = this.droneBox.getAbsolutePosition().clone();
      const moveDroneFunc = () => {
        this.isDroneStillMode = true;
        this.droneAggregate.body.disablePreStep = false;
        transformNode.position = this.droneBox.getAbsolutePosition().clone();
        this.droneAggregate.body.setGravityFactor(0);
        const finishPosition = new Vector3(
          positions[0],
          positions[1],
          positions[2]
        );

        if (!directionFixed) {
          directionFixed = true;
          originRotation = this.droneBox.rotation.clone();
          transformNode.lookAt(finishPosition, Math.PI, null, 0);
          finishRotation = transformNode.rotation.clone();

          let deltaYaw = finishRotation.y - originRotation.y;

          if (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
          else if (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;

          const adjustedFinishRotation = originRotation.clone();
          adjustedFinishRotation.y += deltaYaw;

          let keyFrames = [];

          const animation = new Animation(
            "DroneAnimation",
            "rotation",
            60,
            Animation.ANIMATIONTYPE_VECTOR3
          );
          keyFrames = [];
          keyFrames.push({
            frame: 0,
            value: originRotation,
          });
          keyFrames.push({
            frame: 60,
            value: adjustedFinishRotation,
          });

          animation.setKeys(keyFrames);

          this.droneBox.animations.push(animation);
          this.scene.beginAnimation(this.droneBox, 0, 60, false, 1, () => {
            rotated = true;
          });
        }

        const distance = Vector3.Distance(startPosition, finishPosition);
        travelTime = distance / speed;

        if (gradient < 1 && rotated) {
          elapsedTime += this.deltaTime;
          gradient = Math.min(elapsedTime / travelTime, 1);
          this.droneBox.setAbsolutePosition(
            Vector3.Lerp(startPosition, finishPosition, gradient)
          );
          if (gradient > 1) gradient = 1;
        } else if (gradient >= 1 && rotated) {
          this.scene.onBeforePhysicsObservable.remove(this.moveObserver);
          this.droneBox.rotation = new Vector3(0, this.droneBox.rotation.y, 0);
          this.scene.onAfterRenderObservable.addOnce(() => {
            this.droneAggregate.body.disablePreStep = true;
          });
          resolve();
        }
      };

      this.moveObserver =
        this.scene.onBeforePhysicsObservable.add(moveDroneFunc);
    });
  }

  public delete(): void {
    this.scene.onBeforeRenderObservable.remove(this.stillObserver);
    this.scene.onBeforeRenderObservable.remove(this.stillModeObserver);
    this.scene.onBeforePhysicsObservable.remove(this.observer2d);
    if (this.resetTimeout) clearInterval(this.resetTimeout);
    // this.droneSmoke.smokeStop();
    this.infoBox.dispose();
    this.droneController.delete();
    this.scene.onKeyboardObservable.remove(this.cameraChangeObserver);
    this.scene.onKeyboardObservable.remove(this.stillModeKeyObserver);
    this.scene.onKeyboardObservable.remove(this.resetObserver);
    // this.droneAggregate.body.dispose();
    if (this.skeletons) this.skeletons.forEach((el) => el.dispose());
    this.droneAggregate.dispose();
    this.droneBox.dispose();
    this.thirdViewCamera.dispose();
    this.firstViewCamera.dispose();
  }

  public startControl(): void {
    this.droneController.isActive = true;
  }
  public stopControl(): void {
    this.droneController.isActive = false;
  }
  public setActive(value: boolean): boolean {
    this.droneController.isActive = value;
    return this.droneController.isActive;
  }

  public moveStabTo(positions: number[][]): void {
    const transformNode = new TransformNode("DroneTransformNode");
    let currentIndex = 0;
    let gradient = 0;
    let rotationGradient = 0;
    let rotated = false;
    const speed = 7;
    let elapsedTime = 0;
    let travelTime = 0;
    let directionFixed = false;

    let originRotation = null;
    let finishRotation = null;

    let startPosition = this.droneBox.getAbsolutePosition().clone();
    const moveDroneFunc = () => {
      this.droneAggregate.body.disablePreStep = false;
      transformNode.position = this.droneBox.getAbsolutePosition().clone();

      if (currentIndex > 0)
        startPosition = new Vector3(
          positions[currentIndex - 1][0],
          positions[currentIndex - 1][1],
          positions[currentIndex - 1][2]
        );
      const finishPosition = new Vector3(
        positions[currentIndex][0],
        positions[currentIndex][1],
        positions[currentIndex][2]
      );
      if (!directionFixed) {
        directionFixed = true;
        originRotation = this.droneBox.rotation.clone();
        transformNode.lookAt(finishPosition, Math.PI, null, 0);
        finishRotation = transformNode.rotation.clone();

        let deltaYaw = finishRotation.y - originRotation.y;

        if (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
        else if (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;

        const adjustedFinishRotation = originRotation.clone();
        adjustedFinishRotation.y += deltaYaw;

        let keyFrames = [];

        const animation = new Animation(
          "DroneAnimation",
          "rotation",
          60,
          Animation.ANIMATIONTYPE_VECTOR3
        );
        keyFrames = [];
        keyFrames.push({
          frame: 0,
          value: originRotation,
        });
        keyFrames.push({
          frame: 60,
          value: adjustedFinishRotation,
        });

        animation.setKeys(keyFrames);

        this.droneBox.animations.push(animation);
        this.scene.beginAnimation(this.droneBox, 0, 60, false, 1, () => {
          rotated = true;
        });
      }

      const distance = Vector3.Distance(startPosition, finishPosition);

      travelTime = distance / speed;

      if (gradient < 1 && rotated) {
        elapsedTime += this.deltaTime;
        gradient = Math.min(elapsedTime / travelTime, 1);
        this.droneBox.setAbsolutePosition(
          Vector3.Lerp(startPosition, finishPosition, gradient)
        );
        // gradient += 0.001 * distance;
        if (gradient > 1) gradient = 1;
      } else if (gradient >= 1 && rotated) {
        this.scene.onBeforePhysicsObservable.remove(this.moveObserver);
        this.droneBox.rotation = new Vector3(0, this.droneBox.rotation.y, 0);
        this.scene.onAfterRenderObservable.addOnce(() => {
          this.droneAggregate.body.disablePreStep = true;
        });

        if (currentIndex < positions.length - 1) {
          this.droneBox.animations.length = 0;
          currentIndex++;
          rotated = false;
          directionFixed = false;
          originRotation = null;
          finishRotation = null;
          gradient = 0;
          rotationGradient = 0;
          elapsedTime = 0;
          travelTime = 0;
          this.moveObserver =
            this.scene.onBeforePhysicsObservable.add(moveDroneFunc);
        }
      }
    };

    this.moveObserver = this.scene.onBeforePhysicsObservable.add(moveDroneFunc);
  }
}
