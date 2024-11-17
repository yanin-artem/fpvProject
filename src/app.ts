import { Engine } from "@babylonjs/core/Engines/engine";
import MainScene from "./scene/scene";

const canvas = document.querySelector("canvas")!;
const engine = new Engine(canvas, true, { stencil: true, timeStep: 0 });
const currentScene = new MainScene(engine);

window.addEventListener("resize", function () {
  engine.resize();
});

engine.runRenderLoop(() => {
  currentScene.scene.render();
});
document.getElementById("fps").style.display = "block";
