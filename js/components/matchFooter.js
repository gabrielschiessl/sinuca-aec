export function matchFooter(observacao) {

  return `

    <div class="match-footer">

      ${observacao?.texto || "Sem observações"}

    </div>

  `;

}