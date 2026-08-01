export function scoreBox({ value = "-", editable = false, player = "" }) {
  if (!editable) {
    return `

<div class="score-box">

    ${value}

</div>

`;
  }

  return `

<select class="score-box" data-player="${player}">

    <option value="-" ${value == "-" ? "selected" : ""}>-</option>

    <option value="0" ${value == "0" ? "selected" : ""}>0</option>

    <option value="1" ${value == "1" ? "selected" : ""}>1</option>

    <option value="2" ${value == "2" ? "selected" : ""}>2</option>

</select>

`;
}
