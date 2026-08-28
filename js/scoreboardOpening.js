// A saída depende das partidas concluídas, nunca de quem venceu ou da tacada atual.
export function openingPlayer(state) {
  if (state.firstStarter !== 0 && state.firstStarter !== 1) return null;
  return (state.firstStarter + state.wins[0] + state.wins[1]) % 2;
}

export function applyOpening(state) {
  const player = openingPlayer(state);
  if (player !== null) state.breakPlayer = player;
}
