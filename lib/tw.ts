// lib/tw.ts
import { create } from 'twrnc';
const config = require('../tailwind.config.js');

const tw = create(config);

// Handy export so we can use your hex colours in JS styles
export const palette = (config?.theme?.extend?.colors ?? {}) as {
  background: string;
  accent: string;
  primary: string;
  secondary: string;
  text: string;
};

export default tw;
