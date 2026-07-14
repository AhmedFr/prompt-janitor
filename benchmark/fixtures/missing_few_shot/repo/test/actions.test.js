import { test } from "node:test";
import assert from "node:assert/strict";
import { setAge } from "../src/actions.js";

test("setAge follows the action-creator convention", () => {
  assert.deepEqual(setAge(30), { type: "SET_AGE", payload: { age: 30 } });
});
