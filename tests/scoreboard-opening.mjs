import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/scoreboardOpening.js', import.meta.url), 'utf8');
const { openingPlayer, applyOpening } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const firstStarter of [0, 1]) {
  const state = { firstStarter, wins: [0, 0], breakPlayer: 1 - firstStarter };
  assert.equal(openingPlayer(state), firstStarter);
  applyOpening(state);
  assert.equal(state.breakPlayer, firstStarter);
  const before = structuredClone(state);
  state.wins[1]++;
  applyOpening(state);
  assert.equal(state.breakPlayer, 1 - firstStarter);
  state.wins[1]++;
  applyOpening(state);
  assert.equal(state.breakPlayer, firstStarter);
  state.breakPlayer = 1 - firstStarter; // falta/troca não muda saída
  assert.equal(openingPlayer(state), firstStarter);
  assert.equal(openingPlayer(before), firstStarter); // snapshot de desfazer
  state.wins = [0, 0];
  applyOpening(state);
  assert.equal(state.breakPlayer, firstStarter);
}
for (const firstStarter of [undefined, null, '0', 2]) {
  const state = { firstStarter, wins: [1, 0], breakPlayer: 1 };
  assert.equal(openingPlayer(state), null);
  applyOpening(state);
  assert.equal(state.breakPlayer, 1);
}
console.log('OK: saída alternada, resets, legado, não definido e independência da tacada/vencedor.');
