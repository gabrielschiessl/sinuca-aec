/************************************************
 * PROJETO AEC SINUCA
 * Participantes
 ************************************************/

/************************************************
 * Retorna o participante de uma temporada
 ************************************************/

function getParticipante(temporada, divisao, numero) {

  const participantes = getSheetAsObjects(SHEETS.participantes);

  return participantes.find(p =>

    Number(p.temporada) === Number(temporada) &&
    p.divisao === divisao &&
    Number(p.numero) === Number(numero)

  );

}