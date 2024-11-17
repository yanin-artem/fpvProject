import { KeyboardInfo } from "@babylonjs/core/Events/keyboardEvents";

export default class ControlEvents {
  public up = false;
  public rotateRight = false;
  public down = false;
  public rotateLeft = false;
  public forward = false;
  public back = false;
  public left = false;
  public right = false;
  public firstEngine = false;
  public secondEngine = false;
  public thirdEngine = false;
  public fourthEngine = false;
  public fifthEngine = false;
  public sixthEngine = false;
  public seventhEngine = false;
  public eighthEngine = false;
  public keysPressed = {};
  public axesXUsed = false;
  public axesYUsed = false;

  public getPressedKeys(): string[] {
    return Object.keys(this.keysPressed).filter((key) => this.keysPressed[key]);
  }

  public handleControlEvents(event: KeyboardInfo) {
    if (this.forward || this.back) this.axesXUsed = true;
    else this.axesXUsed = false;

    if (this.left || this.right) this.axesYUsed = true;
    else this.axesYUsed = false;

    if (event.type === 1) {
      this.keysPressed[event.event.key] = true;
    } else if (event.type === 2) {
      this.keysPressed[event.event.key] = false;
    }
    if (event.event.code === "KeyW") {
      this.up = event.type === 1;
    }
    if (event.event.code === "KeyS") {
      this.down = event.type === 1;
    }
    if (event.event.code === "KeyD") {
      this.rotateRight = event.type === 1;
    }
    if (event.event.code === "KeyA") {
      this.rotateLeft = event.type === 1;
    }
    // if (event.event.code === 'Digit1') {
    //   this.firstEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit2') {
    //   this.secondEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit3') {
    //   this.thirdEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit4') {
    //   this.fourthEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit5') {
    //   this.fifthEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit6') {
    //   this.sixthEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit7') {
    //   this.seventhEngine = event.type === 1;
    // }
    // if (event.event.code === 'Digit8') {
    //   this.eighthEngine = event.type === 1;
    // }
    if (
      event.event.code === "ArrowUp" ||
      event.event.code === "Numpad8" ||
      event.event.code === "KeyO"
    ) {
      this.forward = event.type === 1;
    }
    if (
      event.event.code === "ArrowDown" ||
      event.event.code === "Numpad2" ||
      event.event.code === "KeyL"
    ) {
      this.back = event.type === 1;
    }
    if (
      event.event.code === "ArrowRight" ||
      event.event.code === "Numpad6" ||
      event.event.code === "Semicolon"
    ) {
      this.right = event.type === 1;
    }
    if (
      event.event.code === "ArrowLeft" ||
      event.event.code === "Numpad4" ||
      event.event.code === "KeyK"
    ) {
      this.left = event.type === 1;
    }
  }
}
