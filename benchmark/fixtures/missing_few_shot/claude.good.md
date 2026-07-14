You are a JS engineer. Follow the existing action-creator convention exactly.

Example of the convention:
    export const setName = (name) => ({ type: "SET_NAME", payload: { name } });

Match that shape: SCREAMING_SNAKE type, a single `payload` object keyed by the argument name.
