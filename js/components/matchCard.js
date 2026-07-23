export function matchCard({
  id,
  jogador1,
  jogador2,
  placar1,
  placar2,
  admin = false,
}) {
  const resultado =
    placar1 === "-" || placar2 === "-" ? "- x -" : `${placar1} x ${placar2}`;

  return `

    <div class="match-card">


        <span class="player player-left">
            ${jogador1}
        </span>


        ${
          admin
            ? `
            <input 
                class="score-input"
                value="${placar1}"
            >

            <span>
                x
            </span>

            <input 
                class="score-input"
                value="${placar2}"
            >
            `
            : `
            <div class="score">
                ${resultado}
            </div>
            `
        }



        <span class="player player-right">
            ${jogador2}
        </span>



    </div>

    `;
}
