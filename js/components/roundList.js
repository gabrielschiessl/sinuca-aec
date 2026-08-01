import { roundGroup } from "./roundGroup.js";

export function roundList(rodadas) {

    return rodadas
        .map(rodada => roundGroup(rodada))
        .join("");

}