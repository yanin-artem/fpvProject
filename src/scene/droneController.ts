import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { GamepadManager } from "@babylonjs/core/Gamepads/gamepadManager";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Gamepad } from "@babylonjs/core/Gamepads/gamepad";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { VirtualJoystick } from "@babylonjs/core/Misc/virtualJoystick";
import { Observer } from "@babylonjs/core/Misc/observable";
import { KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";
import ControlEvents from "./droneControl";

export default class DroneController {
  public YAW_SPEED = 0.2;
  public ROLL_SPEED = 0.2;
  public PITCH_SPEED = 0.2;
  public TAKEOFF_SPEED = 15;
  public STAB_SPEED = 30;
  public photoMode: boolean;
  public isActive: boolean;
  public isStabMode: boolean;
  public isStopMode = false;
  public isAirplaneMode = false;
  public isCrushed = false;
  public controls: ControlEvents;
  public engineForce_LF = 0;
  public engineForce_RF = 0;
  public engineForce_LB = 0;
  public engineForce_RB = 0;
  public engineSpeed = 0;
  public engineForce = null;
  public gamepadManager: GamepadManager;
  protected rightJoystickTurnSpeed = 0.04;
  protected leftJoystickTurnSpeed = 0.02;
  protected isPhone: boolean;
  public gamepadSticks = {
    leftX: [0, false, 1, 0, 0],
    leftY: [1, false, 1, 0, 0],
    rightX: [2, false, 1, 0, 0],
    rightY: [3, false, 1, 0, 0],
  };
  public gamepadAxes = [];
  public gamepadButtons = [];
  public gamepadJoysticks = [];

  public deltaTime: number;
  protected direction;
  public stabModeOn = false;
  protected PIDModeOn = false;
  public stopers = {
    stopMoveUp: true,
    stopMoveDown: true,
    stopRollForward: true,
    stopRollBackward: true,
    stopRollLeft: true,
    stopRollRight: true,
    stopRotateLeft: true,
    stopRotateRight: true,
    stopStabMode: true,
  };
  protected speeds = {
    speedMoveUp: 0,
    speedMoveDown: 0,
    speedRollForward: 0,
    speedRollBackward: 0,
    speedRollLeft: 0,
    speedRollRight: 0,
    speedRotateLeft: 0,
    speedRotateRight: 0,
  };

  protected noiseSpeeds = {
    RF: 0.0005,
    LF: 0.0005,
    RB: 0.0005,
    LB: 0.0005,
  };

  protected stickX = 0;
  protected stickY = 0;

  public leftJoystick: VirtualJoystick;
  public rightJoystick: VirtualJoystick;
  public virtualMode = false;

  private controlObserver: Observer<KeyboardInfo>;
  private physicsObserver: Observer<Scene>;
  private physicsGamepadObserver: Observer<Scene>;
  private physicsGamepad1TObserver: Observer<Scene>;

  constructor(
    public droneBox: AbstractMesh,
    public droneAggregate: PhysicsAggregate,
    public scene: Scene
  ) {
    this.controls = new ControlEvents();

    if (localStorage.getItem("leftStickXValue"))
      this.gamepadSticks.leftX[0] = Number(
        localStorage.getItem("leftStickXValue")
      );
    if (localStorage.getItem("leftStickXValueFactor"))
      this.gamepadSticks.leftX[2] = Number(
        localStorage.getItem("leftStickXValueFactor")
      );
    // if (localStorage.getItem('leftStickXInvert'))
    //   this.gamepadSticks.leftX[1] = JSON.parse(
    //     localStorage.getItem('leftStickXInvert')
    //   );
    if (localStorage.getItem("leftStickYValue"))
      this.gamepadSticks.leftY[0] = Number(
        localStorage.getItem("leftStickYValue")
      );
    if (localStorage.getItem("leftStickYValueFactor"))
      this.gamepadSticks.leftY[2] = Number(
        localStorage.getItem("leftStickYValueFactor")
      );
    // if (localStorage.getItem('leftStickYInvert'))
    //   this.gamepadSticks.leftY[1] = JSON.parse(
    //     localStorage.getItem('leftStickYInvert')
    //   );
    if (localStorage.getItem("rightStickXValue"))
      this.gamepadSticks.rightX[0] = Number(
        localStorage.getItem("rightStickXValue")
      );
    if (localStorage.getItem("rightStickXValueFactor"))
      this.gamepadSticks.rightX[2] = Number(
        localStorage.getItem("rightStickXValueFactor")
      );
    // if (localStorage.getItem('rightStickXInvert'))
    //   this.gamepadSticks.rightX[1] = JSON.parse(
    //     localStorage.getItem('rightStickXInvert')
    //   );
    if (localStorage.getItem("rightStickYValue")) {
      this.gamepadSticks.rightY[0] = Number(
        localStorage.getItem("rightStickYValue")
      );
      if (localStorage.getItem("rightStickYValueFactor")) {
        this.gamepadSticks.rightY[2] = Number(
          localStorage.getItem("rightStickYValueFactor")
        );
      }
      // if (localStorage.getItem('rightStickYInvert'))
      //   this.gamepadSticks.rightY[1] = JSON.parse(
      //     localStorage.getItem('rightStickYInvert')
      //   );
    }

    this.isActive = true;
    this.isStabMode = false;

    this.controlObserver = this.scene.onKeyboardObservable.add((event) => {
      this.controls.handleControlEvents(event);
    });

    this.isPhone =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(
        navigator.userAgent
      );

    if (this.isPhone) {
      this.virtualStyle();
      this.virtualMode = true;
    }
    this.scene.registerBeforeRender(() => {
      this.deltaTime = (this.scene.getEngine() as any).getDeltaTime() / 1000;
    });

    this.physicsObserver = this.scene.onBeforePhysicsObservable.add(() => {
      if (this.PIDModeOn) {
        if (!this.isCrushed) {
          if (
            this.engineForce_LF + this.engineForce_RB >
            this.engineForce_RF + this.engineForce_LB
          ) {
            this.rotate(
              2,
              this.engineForce_RF * 0.001 - this.engineForce_LF * 0.001
            );
          } else if (
            this.engineForce_RF + this.engineForce_LB >
            this.engineForce_LF + this.engineForce_RB
          ) {
            this.rotate(
              1,
              this.engineForce_RF * 0.001 - this.engineForce_LF * 0.001
            );
          }

          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED *
                this.engineForce_RF *
                // (this.engineForce_RF + 300) *
                this.noiseSpeeds.RF *
                this.deltaTime
            ),
            this.droneBox
              .getChildMeshes()
              .find(
                (el) =>
                  el.name === "vintPlane1" ||
                  el.name === "Plane_1" ||
                  el.name === "Plane_1" ||
                  el.name === "Plane_Prop_4"
              )
              .getAbsolutePosition()
            // .add(this.droneBox.up)
          );
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED *
                this.engineForce_LB *
                // (this.engineForce_LB + 300) *
                this.noiseSpeeds.LB *
                this.deltaTime
            ),
            this.droneBox
              .getChildMeshes()
              .find(
                (el) =>
                  el.name === "vintPlane2" ||
                  el.name === "Plane_3" ||
                  el.name === "Plane_Prop_2"
              )
              .getAbsolutePosition()
            // .add(this.droneBox.up)
          );
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED *
                this.engineForce_RB *
                // (this.engineForce_RB + 300) *
                this.noiseSpeeds.RB *
                this.deltaTime
            ),
            this.droneBox
              .getChildMeshes()
              .find(
                (el) =>
                  el.name === "vintPlane3" ||
                  el.name === "Plane_2" ||
                  el.name === "Plane_Prop_1"
              )
              .getAbsolutePosition()
            // .add(this.droneBox.up)
          );
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED *
                this.engineForce_LF *
                // (this.engineForce_LF + 300) *
                this.noiseSpeeds.LF *
                this.deltaTime
            ),
            this.droneBox
              .getChildMeshes()
              .find(
                (el) =>
                  el.name === "vintPlane4" ||
                  el.name === "Plane_4" ||
                  el.name === "Plane_Prop_3"
              )
              .getAbsolutePosition()
            // .add(this.droneBox.up)
          );
        }
      }
      if (this.isActive) {
        if (!this.isCrushed) {
          this.keyboardControl();
          if (this.virtualMode) this.virtualControl();

          if (this.stabModeOn) {
            this.moveWithStabMode();
          }
        }
      }

      if (!this.isCrushed) {
        if (!this.stopers.stopStabMode) {
          this.droneAggregate.body.applyImpulse(
            new Vector3(this.droneBox.up.x, 0, this.droneBox.up.z).scale(
              this.TAKEOFF_SPEED * 6 * this.deltaTime
            ),
            this.droneBox.getAbsolutePosition()
          );

          // this.droneAggregate.body.applyImpulse(
          //   Axis.Y.scale(9.81 * this.deltaTime),
          //   this.droneBox.getAbsolutePosition()
          // );

          this.droneAggregate.body.disablePreStep = false;
          // if (this.controls.getPressedKeys().length === 0) {
          //   console.log('ЛЕРПАЮ');
          this.droneBox.rotation = Vector3.Lerp(
            this.droneBox.rotation,
            new Vector3(0, this.droneBox.rotation.y, 0),
            5 * this.deltaTime
          );
          // }

          if (!this.stopers.stopRollForward) {
            this.rotate(this.direction.forward, this.speeds.speedRollForward);
          }

          if (!this.stopers.stopRollBackward)
            this.rotate(this.direction.back, -this.speeds.speedRollBackward);

          if (!this.stopers.stopRollLeft)
            this.rotate(this.direction.leftroll, -this.speeds.speedRollLeft);

          if (!this.stopers.stopRollRight)
            this.rotate(this.direction.rightroll, this.speeds.speedRollRight);

          if (!this.stopers.stopRotateLeft)
            this.rotate(this.direction.left, -this.speeds.speedRotateLeft);

          if (!this.stopers.stopRotateRight)
            this.rotate(this.direction.right, this.speeds.speedRotateRight);

          if (!this.stopers.stopMoveUp) {
            this.droneAggregate.body.applyImpulse(
              Axis.Y.scale(
                this.speeds.speedMoveUp * this.TAKEOFF_SPEED * this.deltaTime
              ),
              this.droneBox.getAbsolutePosition()
            );
          }

          if (!this.stopers.stopMoveDown) {
            this.droneAggregate.body.applyImpulse(
              Axis.Y.scale(
                -this.speeds.speedMoveDown * this.TAKEOFF_SPEED * this.deltaTime
              ),
              this.droneBox.getAbsolutePosition()
            );
          }
        } else {
          if (!this.stopers.stopMoveUp) {
            this.droneAggregate.body.applyImpulse(
              this.droneBox.up.scale(
                this.speeds.speedMoveUp *
                  (this.TAKEOFF_SPEED + 9.81) *
                  this.deltaTime
              ),
              this.droneBox.position.add(this.droneBox.up)
            );
          }

          if (!this.stopers.stopMoveDown) {
            this.droneAggregate.body.applyImpulse(
              this.droneBox.up.scale(
                -this.speeds.speedMoveDown *
                  (this.TAKEOFF_SPEED + 9.81) *
                  this.deltaTime
              ),
              this.droneBox.position.add(this.droneBox.up)
            );
          }

          if (!this.stopers.stopRollForward)
            this.rotate(this.direction.forward, this.speeds.speedRollForward);

          if (!this.stopers.stopRollBackward)
            this.rotate(this.direction.back, -this.speeds.speedRollBackward);

          if (!this.stopers.stopRollLeft)
            this.rotate(this.direction.leftroll, -this.speeds.speedRollLeft);

          if (!this.stopers.stopRollRight)
            this.rotate(this.direction.rightroll, this.speeds.speedRollRight);

          if (!this.stopers.stopRotateLeft)
            this.rotate(this.direction.left, -this.speeds.speedRotateLeft);

          if (!this.stopers.stopRotateRight)
            this.rotate(this.direction.right, this.speeds.speedRotateRight);
        }
      }
    });

    enum direction {
      right = 1,
      left = 2,
      forward = 3,
      back = 4,
      rightroll = 5,
      leftroll = 6,
    }

    this.direction = direction;
    this.gamepadControl();
  }

  private setDeltaTime(): void {
    if (this.scene) {
      console.log(this.scene);

      this.deltaTime = (this.scene.getEngine() as any).getDeltaTime() / 1000;
    }
  }

  protected moveWithStabMode() {
    this.droneAggregate.body.applyImpulse(
      new Vector3(this.droneBox.up.x, 0, this.droneBox.up.z).scale(
        this.STAB_SPEED * this.deltaTime
      ),
      this.droneBox.getAbsolutePosition()
    );
    this.droneAggregate.body.disablePreStep = false;
    let rotX = this.droneBox.rotation.x;
    let rotZ = this.droneBox.rotation.z;

    if (
      !(
        this.controls.forward ||
        this.controls.back ||
        this.rightJoystick?.pressed
      )
    ) {
      if (this.droneBox.rotation.x >= 0.01) {
        rotX = this.droneBox.rotation.x - 1.75 * this.deltaTime;
        if (rotX <= -0.01) {
          rotX = 0;
        }
      } else if (this.droneBox.rotation.x <= -0.01) {
        rotX = this.droneBox.rotation.x + 1.75 * this.deltaTime;
        if (rotX >= 0.01) {
          rotX = 0;
        }
      }

      this.droneBox.rotation.x = rotX;
    }

    if (
      !(
        this.controls.left ||
        this.controls.right ||
        this.rightJoystick?.pressed
      )
    ) {
      if (this.droneBox.rotation.z >= 0.01) {
        rotZ = this.droneBox.rotation.z - 1.75 * this.deltaTime;
        if (rotZ <= -0.01) {
          rotZ = 0;
        }
      } else if (this.droneBox.rotation.z <= -0.01) {
        rotZ = this.droneBox.rotation.z + 1.75 * this.deltaTime;
        if (rotZ >= 0.01) {
          rotZ = 0;
        }
      }
    }

    this.droneBox.rotation.x = rotX;
    this.droneBox.rotation.z = rotZ;
  }

  public rotate(direction, value?) {
    const sign =
      direction === this.direction.left ||
      direction === this.direction.back ||
      direction === this.direction.leftroll
        ? -this.deltaTime
        : this.deltaTime;
    let scale;

    let compF1, compF2;
    if (
      direction === this.direction.right ||
      direction === this.direction.left
    ) {
      compF1 = this.droneBox.right;
      compF2 = this.droneBox.right.negate();
      scale =
        value && value !== 0
          ? value * this.YAW_SPEED * this.deltaTime
          : sign * this.YAW_SPEED;
    } else if (
      direction === this.direction.forward ||
      direction === this.direction.back
    ) {
      compF1 = this.droneBox.up;
      compF2 = this.droneBox.up.negate();
      scale =
        value && value !== 0
          ? value * this.PITCH_SPEED * this.deltaTime
          : sign * this.PITCH_SPEED;
    } else if (
      direction === this.direction.rightroll ||
      direction === this.direction.leftroll
    ) {
      compF1 = this.droneBox.up;
      compF2 = this.droneBox.up.negate();
      scale =
        value && value !== 0
          ? value * this.ROLL_SPEED * this.deltaTime
          : sign * this.ROLL_SPEED;
    }

    const compPoint =
      direction === this.direction.rightroll ||
      direction === this.direction.leftroll
        ? this.droneBox.position.add(this.droneBox.right)
        : this.droneBox.position.add(this.droneBox.forward);
    // if (value && value !== 0 ) {
    this.droneAggregate.body.applyImpulse(compF1.scale(scale), compPoint);
    this.droneAggregate.body.applyImpulse(compF2.scale(-scale), compPoint);
    // }
  }

  public moveDroneUp(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedMoveUp = speed;
    this.stopers.stopMoveUp = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopMoveDroneUp();
      }, time);
    }
  }

  public stopMoveDroneUp(): void {
    this.stopers.stopMoveUp = true;
  }

  public moveDroneDown(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedMoveDown = speed;
    this.stopers.stopMoveDown = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopMoveDroneDown();
      }, time);
    }
  }

  public stopMoveDroneDown(): void {
    this.stopers.stopMoveDown = true;
  }

  public rollDroneForward(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRollForward = speed;
    this.stopers.stopRollForward = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRollDroneForward();
      }, time);
    }
  }

  public stopRollDroneForward(): void {
    this.stopers.stopRollForward = true;
  }

  public rollDroneBackward(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRollBackward = speed;
    this.stopers.stopRollBackward = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRollDroneBackward();
      }, time);
    }
  }

  public stopRollDroneBackward(): void {
    this.stopers.stopRollBackward = true;
  }

  public rollDroneLeft(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRollLeft = speed;
    this.stopers.stopRollLeft = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRollDroneLeft();
      }, time);
    }
  }

  public stopRollDroneLeft(): void {
    this.stopers.stopRollLeft = true;
  }

  public rollDroneRight(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRollRight = speed;
    this.stopers.stopRollRight = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRollDroneRight();
      }, time);
    }
  }

  public stopRollDroneRight(): void {
    this.stopers.stopRollRight = true;
  }

  public rotateDroneLeft(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRotateLeft = speed;
    this.stopers.stopRotateLeft = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRotateDroneLeft();
      }, time);
    }
  }

  public stopRotateDroneLeft(): void {
    this.stopers.stopRotateLeft = true;
  }

  public rotateDroneRight(speed: number, time?: number): void {
    speed = speed / 100;
    if (speed > 1) speed = 1;
    if (speed < 0) speed = 0;
    this.speeds.speedRotateRight = speed;
    this.stopers.stopRotateRight = false;

    if (time) {
      const moveDroneUpTimeout = setTimeout(() => {
        this.stopRotateDroneRight();
      }, time);
    }
  }

  public stopRotateDroneRight(): void {
    this.stopers.stopRotateRight = true;
  }

  public startStabMode(): void {
    this.stopers.stopStabMode = false;
    this.TAKEOFF_SPEED = 15 - 9.81;
    this.droneAggregate.body.setGravityFactor(0);
    this.droneAggregate.body.setLinearDamping(2);
  }

  public stopStabMode(): void {
    this.stopers.stopStabMode = true;
    this.TAKEOFF_SPEED = 15;
    this.droneAggregate.body.setGravityFactor(1);
    this.droneAggregate.body.setLinearDamping(1);
  }

  public async keyboardControl() {
    if (!this.isStabMode) {
      if (!this.isStopMode) {
        ///////////Вращение вправо-влево
        if (this.controls.rotateLeft) {
          this.rotate(this.direction.left);
        }
        if (this.controls.rotateRight) {
          this.rotate(this.direction.right);
        }
        if (!this.stabModeOn) {
          ///////// Наклон вправо-влево
          if (this.controls.left) {
            this.rotate(this.direction.leftroll);
          }
          if (this.controls.right) {
            this.rotate(this.direction.rightroll);
          }

          ///////// Наклон вперед-назад
          if (this.controls.forward) {
            this.rotate(this.direction.forward);
          }
          if (this.controls.back) {
            this.rotate(this.direction.back);
          }
        } else {
          this.rotateDroneInStabMode();
        }
      }
      if (!this.photoMode) {
        if (!this.isAirplaneMode) {
          if (!this.stabModeOn) {
            ///////// Вверх-вниз
            if (
              this.controls.up
              // && this.engineForce < 1
            ) {
              this.engineForce += 0.01;
              this.droneAggregate.body.applyImpulse(
                this.droneBox.up.scale(this.TAKEOFF_SPEED * this.deltaTime),
                this.droneBox.position.add(this.droneBox.up)
              );
            }
            if (
              this.controls.down
              // && this.engineForce > -1
            ) {
              this.engineForce -= 0.01;
              this.droneAggregate.body.applyImpulse(
                this.droneBox.up.scale(-this.TAKEOFF_SPEED * this.deltaTime),
                this.droneBox.position.add(this.droneBox.up)
              );
            }
          } else {
            ///////// Вверх-вниз
            if (
              this.controls.up
              // && this.engineForce < 1
            ) {
              this.engineForce += 0.01;
              this.droneAggregate.body.applyImpulse(
                Axis.Y.scale((this.TAKEOFF_SPEED + 9.81) * this.deltaTime),
                this.droneBox.position
              );
            }
            if (
              this.controls.down
              // && this.engineForce > -1
            ) {
              // this.engineForce -= 0.01;
              this.droneAggregate.body.applyImpulse(
                Axis.Y.scale(-(this.TAKEOFF_SPEED + 9.81) * this.deltaTime),
                this.droneBox.position
              );
            }
          }
        } else {
          ///////// Вперед-назад
          if (this.controls.up) {
            this.droneAggregate.body.applyImpulse(
              this.droneBox.forward.scale(
                -this.TAKEOFF_SPEED * 5 * this.deltaTime
              ),
              this.droneBox.position.add(this.droneBox.forward)
            );
          }
          if (this.controls.down) {
            this.droneAggregate.body.applyImpulse(
              this.droneBox.forward.scale(
                this.TAKEOFF_SPEED * 5 * this.deltaTime
              ),
              this.droneBox.position.add(this.droneBox.forward)
            );
          }
        }
        if (this.controls.firstEngine) {
          this.droneAggregate.body.applyImpulse(
            // this.droneBox.forward.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox.up.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox
              .getChildMeshes()
              .find((el) => el.name === "vintPlane4")
              .getAbsolutePosition()
          );
        }
        if (this.controls.secondEngine) {
          this.droneAggregate.body.applyImpulse(
            // this.droneBox.forward.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox.up.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox
              .getChildMeshes()
              .find((el) => el.name === "vintPlane1")
              .getAbsolutePosition()
          );
        }
        if (this.controls.thirdEngine) {
          this.droneAggregate.body.applyImpulse(
            // this.droneBox.forward.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox.up.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox
              .getChildMeshes()
              .find((el) => el.name === "vintPlane3")
              .getAbsolutePosition()
          );
        }
        if (this.controls.fourthEngine) {
          this.droneAggregate.body.applyImpulse(
            // this.droneBox.forward.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox.up.scale(this.TAKEOFF_SPEED * this.deltaTime),
            this.droneBox
              .getChildMeshes()
              .find((el) => el.name === "vintPlane2")
              .getAbsolutePosition()
          );
        }
      }
    }
  }

  protected rotateDroneInStabMode() {
    ///////// Наклон влево-вправо
    if (
      this.controls.left &&
      +Tools.ToDegrees(this.droneBox.rotation.z).toFixed(3) >= -20
    ) {
      this.rotate(this.direction.leftroll);
    }
    if (
      this.controls.right &&
      +Tools.ToDegrees(this.droneBox.rotation.z).toFixed(3) <= 20
    ) {
      this.rotate(this.direction.rightroll);
    }

    ///////// Наклон вперед-назад
    if (
      this.controls.forward &&
      +Tools.ToDegrees(this.droneBox.rotation.x).toFixed(3) >= -20
    ) {
      this.rotate(this.direction.forward);
    }
    if (
      this.controls.back &&
      +Tools.ToDegrees(this.droneBox.rotation.x).toFixed(3) <= 20
    ) {
      this.rotate(this.direction.back);
    }
  }

  protected gamepadControl(): void {
    const gamepadManager = new GamepadManager();
    this.gamepadManager = gamepadManager;
    gamepadManager.onGamepadConnectedObservable.add((gamepad, state) => {
      this.physicsGamepadObserver = this.scene.onBeforePhysicsObservable.add(
        () => {
          this.gamepadAxes = gamepad.browserGamepad.axes.map(
            (el, index) => `${index}) ${(el * 100).toFixed(1)}; `
          );

          this.gamepadJoysticks = [
            (gamepad.leftStick.x * 100).toFixed(1),
            (gamepad.leftStick.y * 100).toFixed(1),
            (gamepad.rightStick.x * 100).toFixed(1),
            (gamepad.rightStick.y * 100).toFixed(1),
          ];

          this.gamepadButtons = gamepad.browserGamepad.buttons.map((button) => {
            return button.pressed;
          });
          if (this.isActive) {
            if (!this.isCrushed) {
              if (!this.isStabMode) {
                if (!this.isStopMode) {
                  if (
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.leftX[0])
                    ] !== 0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.leftY[0])
                    ] !== 0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.rightX[0])
                    ] !== 0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.rightX[0])
                    ] !== 0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.leftX[0])
                    ] !== -0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.leftY[0])
                    ] !== -0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.rightX[0])
                    ] !== -0 ||
                    gamepad.browserGamepad.axes[
                      Number(this.gamepadSticks.rightX[0])
                    ] !== -0
                  ) {
                    if (gamepad.browserGamepad.axes) {
                      ///////// Наклон вправо-влево / вперед-назад

                      if (this.stabModeOn) {
                        this.rollLeftRightStabGamepad({
                          gamepad: gamepad,
                          inverted: this.gamepadSticks.rightX[1],
                        });
                      } else {
                        this.rollLeftRightGamepad({
                          gamepad: gamepad,
                          inverted: this.gamepadSticks.rightX[1],
                        });
                      }

                      if (this.stabModeOn) {
                        this.rollForwardBackwardStabGamepad({
                          gamepad: gamepad,
                          inverted: this.gamepadSticks.rightY[1],
                        });
                      } else {
                        this.rollForwardBackwardGamepad({
                          gamepad: gamepad,
                          inverted: this.gamepadSticks.rightY[1],
                        });
                      }

                      ///////////Вращение вправо-влево | вверх-вниз
                      this.rotateGamepad({
                        gamepad: gamepad,
                        inverted: this.gamepadSticks.leftX[1],
                      });

                      this.takeoffGamepad({
                        gamepad: gamepad,
                        inverted: this.gamepadSticks.leftY[1],
                      });
                    }
                  }
                }
              }
            }
          }
        }
      );
    });
  }

  protected rollLeftRightGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.rightX[3] =
      options.gamepad.browserGamepad.axes[Number(this.gamepadSticks.rightX[0])];

    this.stickY =
      options.gamepad.browserGamepad.axes[Number(this.gamepadSticks.rightX[0])];
    this.droneAggregate.body.applyImpulse(
      this.droneBox.up.scale(
        options.inverted
          ? -Number(this.gamepadSticks.rightX[3]) *
              Number(this.gamepadSticks.rightX[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
          : Number(this.gamepadSticks.rightX[3]) *
              Number(this.gamepadSticks.rightX[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
      ),
      this.droneBox.position.add(this.droneBox.right)
    );
  }

  protected rollForwardBackwardGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.rightY[3] =
      options.gamepad.browserGamepad.axes[
        Number(this.gamepadSticks.rightY[0])
      ] - Number(this.gamepadSticks.rightY[4]);

    this.stickX =
      options.gamepad.browserGamepad.axes[Number(this.gamepadSticks.rightY[0])];
    this.droneAggregate.body.applyImpulse(
      this.droneBox.up.scale(
        options.inverted
          ? -Number(this.gamepadSticks.rightY[3]) *
              Number(this.gamepadSticks.rightY[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
          : Number(this.gamepadSticks.rightY[3]) *
              Number(this.gamepadSticks.rightY[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
      ),
      this.droneBox.position.add(this.droneBox.forward)
    );
  }

  protected rollLeftRightStabGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.rightX[3] =
      options.gamepad.browserGamepad.axes[
        Number(this.gamepadSticks.rightX[0])
      ] * Number(this.gamepadSticks.rightX[2]);

    this.droneAggregate.body.disablePreStep = false;
    this.droneBox.rotationQuaternion = null;
    // this.droneBox.rotation.z = Scalar.Lerp(
    //   this.droneBox.rotation.z,
    //   options.inverted
    //     ? -Number(this.gamepadSticks.rightX[3])
    //     : Number(this.gamepadSticks.rightX[3]),
    //   5 * this.deltaTime
    // );
    this.droneBox.rotation.z = options.inverted
      ? -Number(this.gamepadSticks.rightX[3])
      : Number(this.gamepadSticks.rightX[3]);
  }

  protected rollForwardBackwardStabGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.rightY[3] =
      options.gamepad.browserGamepad.axes[
        Number(this.gamepadSticks.rightY[0])
      ] *
        Number(this.gamepadSticks.rightY[2]) -
      Number(this.gamepadSticks.rightY[4]);

    this.droneAggregate.body.disablePreStep = false;
    this.droneBox.rotationQuaternion = null;
    // this.droneBox.rotation.x = Scalar.Lerp(
    //   this.droneBox.rotation.x,
    //   options.inverted
    //     ? Number(this.gamepadSticks.rightY[3])
    //     : -Number(this.gamepadSticks.rightY[3]),
    //   5 * this.deltaTime
    // );
    this.droneBox.rotation.x = options.inverted
      ? Number(this.gamepadSticks.rightY[3])
      : -Number(this.gamepadSticks.rightY[3]);
  }

  protected takeoffGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.leftY[3] =
      options.gamepad.browserGamepad.axes[Number(this.gamepadSticks.leftY[0])] -
      Number(this.gamepadSticks.leftY[4]);

    this.droneAggregate.body.applyImpulse(
      this.droneBox.up.scale(
        options.inverted
          ? -Number(this.gamepadSticks.leftY[3]) *
              Number(this.gamepadSticks.leftY[2]) *
              this.TAKEOFF_SPEED *
              this.deltaTime
          : Number(this.gamepadSticks.leftY[3]) *
              Number(this.gamepadSticks.leftY[2]) *
              this.TAKEOFF_SPEED *
              this.deltaTime
      ),
      this.droneBox.position.add(this.droneBox.up)
    );
  }

  protected rotateGamepad(options: {
    gamepad: Gamepad;
    inverted: number | boolean;
  }): void {
    this.gamepadSticks.leftX[3] =
      options.gamepad.browserGamepad.axes[Number(this.gamepadSticks.leftX[0])] -
      Number(this.gamepadSticks.leftX[4]);

    this.droneAggregate.body.applyImpulse(
      this.droneBox.right.scale(
        options.inverted
          ? -Number(this.gamepadSticks.leftX[3]) *
              Number(this.gamepadSticks.leftX[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
          : Number(this.gamepadSticks.leftX[3]) *
              Number(this.gamepadSticks.leftX[2]) *
              this.ROLL_SPEED *
              this.deltaTime *
              2
      ),
      this.droneBox.position.add(this.droneBox.forward)
    );
  }

  public startPIDMode(): void {
    this.PIDModeOn = true;
  }
  public stopPIDMode(): void {
    this.PIDModeOn = false;
  }

  protected virtualStyle() {
    this.leftJoystick = new VirtualJoystick(true);
    this.leftJoystick.limitToContainer = true;
    this.leftJoystick.containerSize = 100;
    this.leftJoystick.setJoystickSensibility(11);
    this.rightJoystick = new VirtualJoystick(false);
    this.rightJoystick.limitToContainer = true;
    this.rightJoystick.containerSize = 100;
    this.rightJoystick.setJoystickSensibility(11);
  }

  public virtualControl() {
    if (this.stabModeOn) {
      // Левый джойстик
      if (this.leftJoystick.pressed) {
        const joystickValues = this.leftJoystick.deltaPosition;

        // Поворот влево-вправо
        // if (joystickValues.x > 0.01 || joystickValues.x < -0.01) {
        //   this.droneAggregate.body.applyImpulse(
        //     this.droneBox.right.scale(
        //       this.ROLL_SPEED * joystickValues.x * 1.5 * this.deltaTime
        //     ),
        //     this.droneBox.position.add(this.droneBox.forward)
        //   );
        // }

        if (joystickValues.x > 0.1 || joystickValues.x < -0.1) {
          if (this.isPhone) {
            this.droneBox.rotation.y +=
              this.leftJoystickTurnSpeed * joystickValues.x;
          } else {
            this.droneAggregate.body.applyImpulse(
              this.droneBox.right.scale(
                this.ROLL_SPEED * joystickValues.x * 1.5 * this.deltaTime
              ),
              this.droneBox.position.add(this.droneBox.forward)
            );
          }
        }

        // Подъём вверх-вниз
        if (joystickValues.y > 0.01 || joystickValues.y < -0.01) {
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED * joystickValues.y * this.deltaTime
            ),
            this.droneBox.position.add(this.droneBox.up)
          );
        }
      }

      // Правый джойстик
      if (this.rightJoystick.pressed) {
        // // Наклон влево-вправо
        // if (
        //   this.rightJoystick.deltaPosition.x > 0.01 ||
        //   this.rightJoystick.deltaPosition.x < -0.01
        // ) {
        //   this.droneAggregate.body.disablePreStep = false;
        //   this.droneBox.rotation.z = this.rightJoystick.deltaPosition.x * 0.5;
        // }
        // // Наклон вперёд-назад
        // if (
        //   this.rightJoystick.deltaPosition.y > 0.01 ||
        //   this.rightJoystick.deltaPosition.y < -0.01
        // ) {
        //   this.droneAggregate.body.disablePreStep = false;
        //   this.droneBox.rotation.x = -this.rightJoystick.deltaPosition.y * 0.5;
        // }

        if (
          this.rightJoystick.deltaPosition.x > 0.01 ||
          this.rightJoystick.deltaPosition.x < -0.01
        ) {
          this.droneAggregate.body.disablePreStep = false;

          const resultRotZ = this.rightJoystick.deltaPosition.x * 0.5;

          const delta = resultRotZ - this.droneBox.rotation.z;

          if (Math.abs(delta) > 0.01) {
            const sign = Math.sign(delta);

            let rotZ =
              this.droneBox.rotation.z + this.rightJoystickTurnSpeed * sign;

            if (
              (sign < 0 && resultRotZ < 0 && rotZ < resultRotZ) ||
              (sign > 0 && resultRotZ > 0 && rotZ > resultRotZ) ||
              (sign < 0 && resultRotZ > 0 && rotZ < resultRotZ) ||
              (sign > 0 && resultRotZ < 0 && rotZ > resultRotZ)
            ) {
              rotZ = resultRotZ;
            }

            this.droneBox.rotation.z = rotZ;
          }

          // this.droneAggregate.body.disablePreStep = false;
          // this.droneBox.rotation.z = this.rightJoystick.deltaPosition.x * 0.5;
        }

        // Наклон вперёд-назад
        if (
          this.rightJoystick.deltaPosition.y > 0.01 ||
          this.rightJoystick.deltaPosition.y < -0.01
        ) {
          this.droneAggregate.body.disablePreStep = false;

          const resultRotX = -this.rightJoystick.deltaPosition.y * 0.5;

          const delta = resultRotX - this.droneBox.rotation.x;

          if (Math.abs(delta) > 0.01) {
            const sign = Math.sign(delta);

            let rotX =
              this.droneBox.rotation.x + this.rightJoystickTurnSpeed * sign;

            if (
              (sign < 0 && resultRotX < 0 && rotX < resultRotX) ||
              (sign > 0 && resultRotX > 0 && rotX > resultRotX) ||
              (sign < 0 && resultRotX > 0 && rotX < resultRotX) ||
              (sign > 0 && resultRotX < 0 && rotX > resultRotX)
            ) {
              rotX = resultRotX;
            }

            this.droneBox.rotation.x = rotX;
          }

          // this.droneAggregate.body.disablePreStep = false;
          // this.droneBox.rotation.x = -this.rightJoystick.deltaPosition.y * 0.5;
        }
      } else {
        this.rightJoystick.deltaPosition.set(0, 0, 0);
      }
    } else {
      // Левый джойстик
      if (this.leftJoystick.pressed) {
        const joystickValues = this.leftJoystick.deltaPosition;

        // Поворот влево-вправо
        if (joystickValues.x > 0.01 || joystickValues.x < -0.01) {
          this.droneAggregate.body.applyImpulse(
            this.droneBox.right.scale(
              this.ROLL_SPEED * joystickValues.x * 1.5 * this.deltaTime
            ),
            this.droneBox.position.add(this.droneBox.forward)
          );
        }
        // Подъём вверх-вниз
        if (joystickValues.y > 0.01 || joystickValues.y < -0.01) {
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.TAKEOFF_SPEED * joystickValues.y * this.deltaTime
            ),
            this.droneBox.position.add(this.droneBox.up)
          );
        }
      }

      // Правый джойстик
      if (this.rightJoystick.pressed) {
        const joystickValues = this.rightJoystick.deltaPosition;

        // Наклон влево-вправо
        if (joystickValues.x > 0.01 || joystickValues.x < -0.01) {
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.ROLL_SPEED * joystickValues.x * this.deltaTime
            ),
            this.droneBox.position.add(this.droneBox.right)
          );
        }

        // Наклон вперёд-назад
        if (joystickValues.y > 0.1 || joystickValues.y < -0.1) {
          this.droneAggregate.body.applyImpulse(
            this.droneBox.up.scale(
              this.ROLL_SPEED * joystickValues.y * -this.deltaTime
            ),
            this.droneBox.position.add(this.droneBox.forward)
          );
        }
      }
    }
  }

  public delete(): void {
    this.scene.onKeyboardObservable.remove(this.controlObserver);
    this.scene.onBeforePhysicsObservable.remove(this.physicsObserver);
    this.scene.onBeforePhysicsObservable.remove(this.physicsGamepadObserver);
    this.scene.onBeforePhysicsObservable.remove(this.physicsGamepad1TObserver);
    // this.scene.unregisterBeforeRender(this.setDeltaTime);
  }
}
