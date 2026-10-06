import { describe, expect, it } from "vitest";
import { shouldIgnoreKeyboard } from "../game/controls";

describe("game keyboard focus", () => {
  it("does not send game shortcuts through editable fields or interactive controls", () => {
    document.body.innerHTML = `
      <input id="input" />
      <textarea id="textarea"></textarea>
      <select id="select"><option>One</option></select>
      <button id="button">Save</button>
      <a id="link" href="#">Link</a>
      <div id="editable" contenteditable="true"><span id="editable-child">Text</span></div>
    `;

    for (const id of [
      "input",
      "textarea",
      "select",
      "button",
      "link",
      "editable",
      "editable-child",
    ]) {
      expect(shouldIgnoreKeyboard(document.getElementById(id))).toBe(true);
    }
  });

  it("keeps keyboard controls active when the game has focus", () => {
    expect(shouldIgnoreKeyboard(document.createElement("div"))).toBe(false);
    expect(shouldIgnoreKeyboard(null)).toBe(false);
  });
});
