import { playQuacks } from './sound.js';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target === 'offscreen' && msg.action === 'quack') playQuacks(2);
});
