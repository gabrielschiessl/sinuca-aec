/************************************************
 * PROJETO AEC SINUCA
 * Paridade de contrato com a API PHP/MySQL
 ************************************************/

function obterConfiguracaoApi(chave) {
  const registro = getSheetAsObjects(SHEETS.configuracao).find(
    (item) => String(item.chave).trim() === String(chave).trim(),
  );
  return registro ? String(registro.valor ?? "").trim() : "";
}

function salvarConfiguracaoApi(chave, valor) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const aba = planilha.getSheetByName(SHEETS.configuracao);
  const valores = aba.getDataRange().getDisplayValues();
  const cabecalhos = valores[0].map((item) => String(item).trim().toLowerCase());
  const colunaChave = cabecalhos.indexOf("chave");
  const colunaValor = cabecalhos.indexOf("valor");
  if (colunaChave < 0 || colunaValor < 0) {
    throw new Error("A estrutura da aba Configuração está incompleta.");
  }
  const indice = valores.findIndex((linha, linhaIndice) =>
    linhaIndice > 0 && String(linha[colunaChave]).trim() === String(chave).trim(),
  );
  if (indice > 0) {
    aba.getRange(indice + 1, colunaValor + 1).setValue(valor);
  } else {
    const linha = Array(cabecalhos.length).fill("");
    linha[colunaChave] = chave;
    linha[colunaValor] = valor;
    aba.appendRow(linha);
  }
  delete CACHE[SHEETS.configuracao];
}

function salvarTaxaInscricaoAdmin(temporadaInformada, taxaInformada) {
  const temporada = Number(temporadaInformada);
  if (!Number.isInteger(temporada) || !getSheetAsObjects(SHEETS.temporadas)
    .some((item) => Number(item.temporada) === temporada)) {
    throw new Error("Temporada não encontrada.");
  }
  const texto = String(taxaInformada ?? "").trim().replace(",", ".");
  if (texto && (!Number.isFinite(Number(texto)) || Number(texto) < 0)) {
    throw new Error("Informe uma taxa de inscrição válida.");
  }
  const taxa = texto === "" ? null : Number(Number(texto).toFixed(2));
  salvarConfiguracaoApi(`taxa_inscricao_${temporada}`, taxa === null ? "" : taxa.toFixed(2));
  return { sucesso: true, temporada, taxa_inscricao: taxa };
}

function salvarReferenciaRankingAdmin(temporadaInformada) {
  const texto = String(temporadaInformada ?? "").trim();
  const temporada = texto === "" ? null : Number(texto);
  if (temporada !== null && (!Number.isInteger(temporada) ||
    getEstatisticas("A", temporada).total_participantes < 2)) {
    throw new Error("A referência precisa possuir uma Série A publicada.");
  }
  salvarConfiguracaoApi("ranking_reference_year", temporada === null ? "" : temporada);
  return {
    sucesso: true,
    referencia_ranking: temporada,
    referencia_ranking_efetiva: temporada ?? (getTemporadaAtual() - 1),
  };
}

function getRankingPublico() {
  const temporadaAtual = getTemporadaAtual();
  const configurada = Number(obterConfiguracaoApi("ranking_reference_year"));
  const automatica = !Number.isInteger(configurada) || configurada < 1900;
  const referencia = automatica ? temporadaAtual - 1 : configurada;
  return {
    temporada_atual: temporadaAtual,
    referencia_automatica: automatica,
    ...calcularRankingReferenciaPlanilha(referencia),
  };
}

function calcularRankingReferenciaPlanilha(referencia) {
  const temporadas = getSheetAsObjects(SHEETS.temporadas)
    .filter((item) => Number(item.temporada) <= referencia &&
      [TEMPORADA_STATUS.ATIVA, TEMPORADA_STATUS.ARQUIVADA].includes(
        String(item.status).trim().toUpperCase(),
      ))
    .map((item) => Number(item.temporada))
    .filter((ano, indice, lista) => Number.isInteger(ano) && lista.indexOf(ano) === indice)
    .sort((a, b) => a - b);
  const participantes = getSheetAsObjects(SHEETS.participantes);
  const classificacoes = {};
  const jogadores = {};
  temporadas.forEach((ano) => {
    const classificacao = getEstatisticas("A", ano).classificacao;
    const total = classificacao.length;
    classificacoes[ano] = {};
    classificacao.forEach((jogador, indice) => {
      jogadores[jogador.jogador_id] = {
        jogador_id: jogador.jogador_id,
        nome: jogador.nome,
        exibicao: jogador.exibicao,
        apelido: jogador.apelido,
      };
      const participante = participantes.find((item) =>
        Number(item.temporada) === ano &&
        String(item.divisao).trim().toUpperCase() === "A" &&
        Number(item.jogador_id) === Number(jogador.jogador_id),
      );
      const woDireto = normalizarBooleanoApi(participante?.wo_direto);
      classificacoes[ano][jogador.jogador_id] = {
        posicao: indice + 1,
        pontos: woDireto ? 0 : total - indice,
        wo_direto: woDireto,
      };
    });
  });

  let rankingAnterior = {};
  let ranking = [];
  let detalhes = [];
  const primeiroAno = temporadas.length ? temporadas[0] : referencia;
  for (let anoAvaliacao = primeiroAno; anoAvaliacao <= referencia; anoAvaliacao += 1) {
    const inicio = anoAvaliacao - 4;
    const pontos = {};
    const woDireto = {};
    Object.keys(classificacoes).forEach((anoTexto) => {
      const ano = Number(anoTexto);
      if (ano < inicio || ano > anoAvaliacao) return;
      Object.entries(classificacoes[ano]).forEach(([id, resultado]) => {
        pontos[id] = (pontos[id] || 0) + resultado.pontos;
        if (resultado.wo_direto) woDireto[id] = true;
      });
    });
    const candidatos = [...new Set([...Object.keys(pontos), ...Object.keys(rankingAnterior)])];
    candidatos.sort((idA, idB) =>
      (pontos[idB] || 0) - (pontos[idA] || 0) ||
      (((pontos[idA] || 0) === 0 && Boolean(woDireto[idA]) !== Boolean(woDireto[idB]))
        ? (woDireto[idA] ? 1 : -1) : 0) ||
      (rankingAnterior[idA] || Number.MAX_SAFE_INTEGER) -
        (rankingAnterior[idB] || Number.MAX_SAFE_INTEGER) ||
      String(jogadores[idA]?.exibicao || "").localeCompare(
        String(jogadores[idB]?.exibicao || ""), "pt-BR",
      ) || Number(idA) - Number(idB),
    );
    if (anoAvaliacao === referencia) detalhes = [...candidatos];
    ranking = candidatos.slice(0, 30);
    rankingAnterior = {};
    ranking.forEach((id, indice) => { rankingAnterior[id] = indice + 1; });
  }
  const periodo = Array.from({ length: 5 }, (_, indice) => referencia - 4 + indice);
  const montar = (ids) => ids.map((id, indice) => {
    const temporadasJogador = periodo.map((ano) => ({
      temporada: ano,
      posicao: classificacoes[ano]?.[id]?.posicao ?? null,
      pontos: classificacoes[ano]?.[id]?.pontos || 0,
    }));
    return {
      posicao: indice + 1,
      ...jogadores[id],
      pontos: temporadasJogador.reduce((total, item) => total + item.pontos, 0),
      temporadas: temporadasJogador,
    };
  });
  return { referencia, periodo, ranking: montar(ranking), detalhes: montar(detalhes) };
}

function normalizarBooleanoApi(valor) {
  return [true, 1, "1", "S", "SIM", "TRUE"].includes(
    typeof valor === "string" ? valor.trim().toUpperCase() : valor,
  );
}

function getDadosPlanilhaAdmin(temporadaInformada, divisaoInformada) {
  const temporada = Number(temporadaInformada);
  const divisao = String(divisaoInformada || "").trim().toUpperCase();
  const registro = getSheetAsObjects(SHEETS.temporadas)
    .find((item) => Number(item.temporada) === temporada);
  if (!registro || !["A", "B"].includes(divisao)) {
    throw new Error("Temporada ou divisão inválida.");
  }
  const emPreparacao = String(registro.status).trim().toUpperCase() === TEMPORADA_STATUS.PREPARACAO;
  const versao = Number(registro.versao) || 1;
  const participantesFonte = getSheetAsObjects(
    emPreparacao ? SHEETS.temporadasParticipantes : SHEETS.participantes,
  );
  const partidasFonte = getSheetAsObjects(
    emPreparacao ? SHEETS.temporadasRodadas : SHEETS.rodadas,
  );
  const participantes = participantesFonte
    .filter((item) => Number(item.temporada) === temporada &&
      (!emPreparacao || (Number(item.versao) || 1) === versao) &&
      String(item.divisao).trim().toUpperCase() === divisao)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  if (participantes.length < 2) {
    throw new Error(`Não há Série ${divisao} registrada nesta temporada.`);
  }
  const jogadores = Object.fromEntries(getJogadores().map((item) => [Number(item.id), item]));
  const lista = participantes.map((item) => {
    const jogador = jogadores[Number(item.jogador_id)];
    return {
      numero: Number(item.numero),
      jogador_id: Number(item.jogador_id),
      nome: jogador?.nome || "",
      exibicao: jogador?.exibicao || jogador?.nome || "",
      apelido: jogador?.apelido || jogador?.exibicao || jogador?.nome || "",
    };
  });
  const porNumero = Object.fromEntries(lista.map((item) => [item.numero, item]));
  const partidasTemporada = partidasFonte.filter((item) =>
    Number(item.temporada) === temporada &&
    (!emPreparacao || (Number(item.versao) || 1) === versao),
  );
  const partidasDivisao = partidasTemporada
    .filter((item) => String(item.divisao).trim().toUpperCase() === divisao)
    .map(normalizarRodadaTemporada);
  const participantesNormalizados = { A: [], B: [] };
  participantesFonte.filter((item) =>
    Number(item.temporada) === temporada &&
    (!emPreparacao || (Number(item.versao) || 1) === versao),
  ).forEach((item) => {
    const serie = String(item.divisao).trim().toUpperCase();
    if (participantesNormalizados[serie]) participantesNormalizados[serie].push(item);
  });
  const agrupadas = agruparChaveamentoTemporada(partidasDivisao)[divisao];
  const numerosParticipantes = participantes.map((item) => Number(item.numero));
  const rodadas = agrupadas.map((rodada) => ({
    ...rodada,
    folga: Number(rodada.folga) || numerosParticipantes.find((numero) =>
      !rodada.partidas.some((partida) =>
        Number(partida.numero1) === numero || Number(partida.numero2) === numero,
      ),
    ) || null,
    partidas: rodada.partidas.map((partida) => ({
      ...partida,
      jogador1: porNumero[partida.numero1],
      jogador2: porNumero[partida.numero2],
    })),
  })).map((rodada) => ({
    ...rodada,
    jogador_folga: rodada.folga ? porNumero[rodada.folga] || null : null,
  }));
  const calcular = (serie) => calcularEstatisticasSerie({
    temporada,
    divisao: serie,
    participantes: participantesFonte,
    jogadores: getSheetAsObjects(SHEETS.jogadores),
    partidas: partidasFonte,
  });
  const estatisticas = calcular(divisao);
  const estatisticasA = calcular("A");
  const estatisticasB = participantesNormalizados.B.length >= 2 ? calcular("B") : null;
  return {
    temporada,
    divisao,
    status: String(registro.status).trim().toUpperCase(),
    tipo: normalizarTipoTemporada(registro.tipo),
    taxa_inscricao: obterTaxaInscricaoApi(temporada),
    participantes: lista,
    rodadas,
    estatisticas,
    ranking_exportacao: divisao === "A" ? {
      anterior: calcularRankingReferenciaPlanilha(temporada - 1),
      atualizado: calcularRankingReferenciaPlanilha(temporada),
    } : null,
    movimentacoes: {
      subiram: (estatisticasB?.classificacao || []).slice(0, 4).map((item) => item.exibicao),
      cairam: estatisticasA.classificacao.slice(-4).map((item) => item.exibicao),
    },
  };
}

function obterTaxaInscricaoApi(temporada) {
  const valor = obterConfiguracaoApi(`taxa_inscricao_${temporada}`);
  return valor === "" || !Number.isFinite(Number(valor)) ? null : Number(valor);
}

function getRegulamentoAdmin(temporadaInformada) {
  const temporada = Number(temporadaInformada);
  const registro = getSheetAsObjects(SHEETS.temporadas)
    .find((item) => Number(item.temporada) === temporada);
  if (!Number.isInteger(temporada) || !registro) {
    throw new Error("Temporada não encontrada.");
  }
  const taxa = obterTaxaInscricaoApi(temporada);
  if (taxa === null) {
    throw new Error(`Informe a taxa de inscrição de ${temporada} antes de gerar o regulamento.`);
  }
  const emPreparacao = String(registro.status).trim().toUpperCase() === TEMPORADA_STATUS.PREPARACAO;
  const versao = Number(registro.versao) || 1;
  const datas = getSheetAsObjects(emPreparacao ? SHEETS.temporadasRodadas : SHEETS.rodadas)
    .filter((item) => Number(item.temporada) === temporada &&
      (!emPreparacao || (Number(item.versao) || 1) === versao))
    .map((item) => normalizarDataPreparacaoLida(item.data))
    .filter(Boolean)
    .sort();
  if (!datas.length) {
    throw new Error(`Cadastre as datas das rodadas de ${temporada} antes de gerar o regulamento.`);
  }
  let modelo;
  if (String(REGULATION_TEMPLATE_FILE_ID || "").trim()) {
    modelo = DriveApp.getFileById(REGULATION_TEMPLATE_FILE_ID).getBlob();
  } else {
    const resposta = UrlFetchApp.fetch(REGULATION_TEMPLATE_URL, { muteHttpExceptions: true });
    if (resposta.getResponseCode() < 200 || resposta.getResponseCode() >= 300) {
      throw new Error("O modelo do regulamento não pôde ser carregado no QAS.");
    }
    modelo = resposta.getBlob();
  }
  const blobs = Utilities.unzip(modelo);
  const inicio = datas[0].split("-").reverse().join("/");
  const fim = datas[datas.length - 1].split("-").reverse().join("/");
  const taxaFormatada = `R$ ${taxa.toFixed(2).replace(".", ",")}`;
  const taxaPorExtenso = valorMonetarioPorExtensoApi(taxa);
  let substituicoes = 0;
  const atualizados = blobs.map((blob) => {
    if (blob.getName() === "word/numbering.xml") {
      return Utilities.newBlob(
        ajustarNumeracaoRegulamentoApi(blob.getDataAsString("UTF-8")),
        "application/xml",
        blob.getName(),
      );
    }
    if (blob.getName() !== "word/document.xml") return blob;
    let xml = blob.getDataAsString("UTF-8");
    xml = xml.replace(/(<w:t[^>]*>)(ANO|\d{4})(<\/w:t>)/, (_, antes, __, depois) => {
      substituicoes += 1;
      return `${antes}${temporada}${depois}`;
    });
    xml = xml.replace(/Participarão do campeonato os jogadores do ranking[\s\S]*?turno único(?:, com início em \d{2}\/\d{2}\/\d{4} e término em \d{2}\/\d{2}\/\d{4})?\./,
      (texto) => {
        substituicoes += 1;
        return texto.replace(/(?:, com início[\s\S]*?)?\.$/,
          `, com início em ${inicio} e término em ${fim}.`);
      });
    xml = xml.replace(/R\$\s*[\d.]+,\d{2}/g, () => {
      substituicoes += 1;
      return taxaFormatada;
    });
    xml = xml.replace(/\([^<)]*reais(?: e [^<)]*centavos)?\)/, `(${taxaPorExtenso})`);
    [
      "Oséas — presidente;",
      "Gáz — vice-presidente;",
      "Toninho;",
      "Hélcio;",
      "Maia.",
    ].forEach((membro) => {
      const textoEscapado = membro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const padrao = new RegExp(`(<w:p\\b(?:(?!<\\/w:p>)[\\s\\S])*?<w:t[^>]*>${textoEscapado}<\\/w:t>[\\s\\S]*?<\\/w:p>)`);
      xml = xml.replace(padrao, (paragrafo) =>
        paragrafo.replace(/<w:numId w:val="2"\/>/, '<w:numId w:val="3"/>'),
      );
    });
    return Utilities.newBlob(xml, "application/xml", blob.getName());
  });
  if (substituicoes < 4) {
    throw new Error("O modelo do regulamento não possui todos os campos parametrizados.");
  }
  const arquivo = Utilities.zip(atualizados, `AEC-Sinuca-Regulamento-${temporada}.docx`);
  return {
    nome_arquivo: `AEC-Sinuca-Regulamento-${temporada}.docx`,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    conteudo_base64: Utilities.base64Encode(arquivo.getBytes()),
  };
}

function ajustarNumeracaoRegulamentoApi(xml) {
  let nivelComissao = "";
  xml = xml.replace(/<w:abstractNum w:abstractNumId="2">[\s\S]*?<\/w:abstractNum>/, (abstrata) => {
    let atualizada = abstrata.replace(
      /(<w:lvl w:ilvl="0">[\s\S]*?<\/w:lvl>)/,
      (nivel) => nivel
        .replace(/<w:sz w:val="\d+"\/>/, '<w:sz w:val="24"/>')
        .replace(/<w:szCs w:val="\d+"\/>/, '<w:szCs w:val="24"/>'),
    );
    atualizada = atualizada.replace(
      /(<w:lvl w:ilvl="1">[\s\S]*?<\/w:lvl>)/,
      (nivel) => {
        const letras = nivel
          .replace(/<w:numFmt w:val="[^"]+"\/>/, '<w:numFmt w:val="lowerLetter"/>')
          .replace(/<w:lvlText w:val="[^"]+"\/>/, '<w:lvlText w:val="%2."/>');
        nivelComissao = letras.replace(
          /<w:numFmt w:val="[^"]+"\/>/,
          '<w:numFmt w:val="decimal"/>',
        );
        return letras;
      },
    );
    return atualizada;
  });
  if (!nivelComissao) throw new Error("A numeração do regulamento está incompleta.");
  xml = xml.replace(/<w:num w:numId="3">[\s\S]*?<\/w:num>/g, "");
  const numeroComissao = `<w:num w:numId="3"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="1">${nivelComissao}</w:lvlOverride></w:num>`;
  return xml.replace(/<\/w:numbering>$/, `${numeroComissao}</w:numbering>`);
}

function valorMonetarioPorExtensoApi(valor) {
  const centavosTotais = Math.round(Number(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  const partes = [`${numeroPorExtensoApi(reais)} ${reais === 1 ? "real" : "reais"}`];
  if (centavos) {
    partes.push(`${numeroPorExtensoApi(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return partes.join(" e ");
}

function numeroPorExtensoApi(valor) {
  const unidades = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  if (valor < 10) return unidades[valor];
  if (valor < 20) return especiais[valor - 10];
  if (valor < 100) return dezenas[Math.floor(valor / 10)] + (valor % 10 ? ` e ${unidades[valor % 10]}` : "");
  if (valor < 1000) {
    const resto = valor % 100;
    const prefixo = valor < 200 && resto ? "cento" : centenas[Math.floor(valor / 100)];
    return prefixo + (resto ? ` e ${numeroPorExtensoApi(resto)}` : "");
  }
  if (valor < 1000000) {
    const milhares = Math.floor(valor / 1000);
    const resto = valor % 1000;
    const prefixo = milhares === 1 ? "mil" : `${numeroPorExtensoApi(milhares)} mil`;
    return prefixo + (resto ? ` e ${numeroPorExtensoApi(resto)}` : "");
  }
  return String(valor);
}

function salvarTemporadaAtualAdmin(dados) {
  garantirEstruturaTemporadas();
  const temporada = getTemporadaAtual();
  const participantes = validarParticipantesTemporada(dados.participantes);
  const rodadasBase = validarRodadasTemporadaInformadas(dados.rodadas, participantes);
  const rodadasNormalizadas = ["A", "B"].reduce((resultado, divisao) => {
    resultado[divisao] = rodadasBase[divisao].map((rodada, indiceRodada) => ({
      ...rodada,
      partidas: rodada.partidas.map((partida, indicePartida) => {
        const original = dados.rodadas?.[divisao]?.[indiceRodada]?.partidas?.[indicePartida] || {};
        return {
          ...partida,
          status: String(original.status || "A").trim().toUpperCase(),
          placar1: original.placar1 ?? "-",
          placar2: original.placar2 ?? "-",
          observacao: String(original.observacao || "").trim(),
        };
      }),
    }));
    return resultado;
  }, {});
  const rodadas = aplicarWoDiretoConteudoApi(rodadasNormalizadas, participantes);
  validarAgendaPublicacaoTemporada(rodadas);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const abaParticipantes = planilha.getSheetByName(SHEETS.participantes);
    const abaRodadas = planilha.getSheetByName(SHEETS.rodadas);
    const agora = new Date();
    excluirLinhasPorTemporada(abaParticipantes, temporada);
    excluirLinhasPorTemporada(abaRodadas, temporada);
    adicionarObjetosAba(abaParticipantes, ["A", "B"].flatMap((divisao) =>
      participantes[divisao].map((item, indice) => ({
        temporada, divisao, numero: indice + 1, jogador_id: item.jogador_id,
        desempate: item.desempate || "", wo_direto: item.wo_direto ? "S" : "N",
      })),
    ));
    adicionarObjetosAba(abaRodadas, ["A", "B"].flatMap((divisao) =>
      rodadas[divisao].flatMap((rodada) => rodada.partidas.map((partida) => ({
        temporada, divisao, rodada: rodada.rodada,
        numero1: partida.numero1, numero2: partida.numero2,
        data: formatarDataPublicadaTemporada(partida.data), hora: partida.hora,
        status: partida.status, placar1: partida.placar1, placar2: partida.placar2,
        observacao: partida.observacao, atualizado_em: agora,
      }))),
    ));
    sincronizarAtividadeJogadoresTemporada(
      planilha,
      new Set([...participantes.A, ...participantes.B].map((item) => Number(item.jogador_id))),
    );
    Object.keys(CACHE).forEach((chave) => { delete CACHE[chave]; });
    return { sucesso: true, ...getTemporadaAtualParaEdicaoApi() };
  } finally {
    lock.releaseLock();
  }
}

function getTemporadaAtualParaEdicaoApi() {
  const temporada = getTemporadaAtual();
  const participantes = { A: [], B: [] };
  getSheetAsObjects(SHEETS.participantes)
    .filter((item) => Number(item.temporada) === temporada)
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .forEach((item) => participantes[String(item.divisao).trim().toUpperCase()]
      .push(normalizarParticipanteTemporada(item)));
  const partidas = getSheetAsObjects(SHEETS.rodadas)
    .filter((item) => Number(item.temporada) === temporada)
    .map(normalizarRodadaTemporada);
  return {
    persistida: true, modo: "ATUAL", temporada, versao: 1,
    status: TEMPORADA_STATUS.ATIVA, participantes,
    rodadas: corrigirFolgasChaveamentoCarregado(
      agruparChaveamentoTemporada(partidas), participantes,
    ),
    jogadores: getJogadores().sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR")),
  };
}

function getTemporadaArquivadaParaEdicaoApi(temporada, registro) {
  const participantes = { A: [], B: [] };
  getSheetAsObjects(SHEETS.participantes)
    .filter((item) => Number(item.temporada) === temporada)
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .forEach((item) => participantes[String(item.divisao).trim().toUpperCase()]
      .push(normalizarParticipanteTemporada(item)));
  const partidas = getSheetAsObjects(SHEETS.rodadas)
    .filter((item) => Number(item.temporada) === temporada)
    .map(normalizarRodadaTemporada);
  return {
    persistida: true,
    modo: "LEGADA",
    temporada,
    versao: Number(registro.versao) || 1,
    status: TEMPORADA_STATUS.ARQUIVADA,
    participantes,
    rodadas: corrigirFolgasChaveamentoCarregado(
      agruparChaveamentoTemporada(partidas), participantes,
    ),
    jogadores: getJogadores().sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR")),
  };
}

function aplicarWoDiretoConteudoApi(rodadasInformadas, participantes) {
  const rodadas = { A: [], B: [] };
  const jogadores = Object.fromEntries(getJogadores().map((item) => [Number(item.id), item]));
  ["A", "B"].forEach((divisao) => {
    const porNumero = {};
    participantes[divisao].forEach((item, indice) => {
      const numero = Number(item.numero) || indice + 1;
      porNumero[numero] = {
        wo: normalizarBooleanoApi(item.wo_direto),
        nome: jogadores[Number(item.jogador_id)]?.exibicao || `Jogador ${numero}`,
      };
    });
    rodadas[divisao] = (rodadasInformadas[divisao] || []).map((rodada) => ({
      ...rodada,
      partidas: rodada.partidas.map((partida) => {
        const direto1 = Boolean(porNumero[Number(partida.numero1)]?.wo);
        const direto2 = Boolean(porNumero[Number(partida.numero2)]?.wo);
        if (!direto1 && !direto2) return { ...partida };
        const ambos = direto1 && direto2;
        return {
          ...partida,
          status: "E",
          placar1: ambos || direto1 ? 0 : 2,
          placar2: ambos || direto2 ? 0 : 2,
          observacao: ambos
            ? "W.O.: ambos abandonaram a competição"
            : `W.O.: ${direto1 ? porNumero[Number(partida.numero1)].nome : porNumero[Number(partida.numero2)].nome}`,
        };
      }),
    }));
  });
  return rodadas;
}

function aplicarWoDiretoPlanilha(divisaoInformada) {
  const divisao = String(divisaoInformada || "").trim().toUpperCase();
  const temporada = getTemporadaAtual();
  const participantes = getSheetAsObjects(SHEETS.participantes)
    .filter((item) => Number(item.temporada) === temporada &&
      String(item.divisao).trim().toUpperCase() === divisao);
  const diretos = Object.fromEntries(participantes.map((item) => [
    Number(item.numero), normalizarBooleanoApi(item.wo_direto),
  ]));
  if (!Object.values(diretos).some(Boolean)) return;
  const jogadores = Object.fromEntries(getJogadores().map((item) => [Number(item.id), item]));
  const nomes = Object.fromEntries(participantes.map((item) => [
    Number(item.numero), jogadores[Number(item.jogador_id)]?.exibicao || `Jogador ${item.numero}`,
  ]));
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const aba = planilha.getSheetByName(SHEETS.rodadas);
  const valores = aba.getDataRange().getDisplayValues();
  const cabecalhos = valores[0].map((item) => String(item).trim().toLowerCase());
  const coluna = (nome) => cabecalhos.indexOf(nome);
  valores.slice(1).forEach((linha, indice) => {
    if (Number(linha[coluna("temporada")]) !== temporada ||
      String(linha[coluna("divisao")]).trim().toUpperCase() !== divisao) return;
    const numero1 = Number(linha[coluna("numero1")]);
    const numero2 = Number(linha[coluna("numero2")]);
    const direto1 = Boolean(diretos[numero1]);
    const direto2 = Boolean(diretos[numero2]);
    if (!direto1 && !direto2) return;
    const linhaAba = indice + 2;
    const ambos = direto1 && direto2;
    aba.getRange(linhaAba, coluna("status") + 1).setValue("E");
    aba.getRange(linhaAba, coluna("placar1") + 1).setValue(ambos || direto1 ? 0 : 2);
    aba.getRange(linhaAba, coluna("placar2") + 1).setValue(ambos || direto2 ? 0 : 2);
    aba.getRange(linhaAba, coluna("observacao") + 1).setValue(
      ambos ? "W.O.: ambos abandonaram a competição" : `W.O.: ${direto1 ? nomes[numero1] : nomes[numero2]}`,
    );
    const atualizada = coluna("atualizado_em");
    if (atualizada >= 0) aba.getRange(linhaAba, atualizada + 1).setValue(new Date());
  });
  delete CACHE[SHEETS.rodadas];
}

function salvarTemporadaLegadaArquivadaApi(dados, registro) {
  const temporada = Number(dados.temporada);
  const conteudo = normalizarRascunhoTemporadaLegada(dados);
  validarAgendaPublicacaoTemporada(conteudo.rodadas);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const agora = new Date();
    const abaParticipantes = planilha.getSheetByName(SHEETS.participantes);
    const abaRodadas = planilha.getSheetByName(SHEETS.rodadas);
    excluirLinhasPorTemporada(abaParticipantes, temporada);
    excluirLinhasPorTemporada(abaRodadas, temporada);
    adicionarObjetosAba(abaParticipantes, ["A", "B"].flatMap((divisao) =>
      conteudo.participantes[divisao].map((item, indice) => ({
        temporada,
        divisao,
        numero: indice + 1,
        jogador_id: item.jogador_id,
        desempate: item.desempate || "",
        wo_direto: item.wo_direto ? "S" : "N",
      })),
    ));
    adicionarObjetosAba(abaRodadas, ["A", "B"].flatMap((divisao) =>
      conteudo.rodadas[divisao].flatMap((rodada) => rodada.partidas.map((partida) => ({
        temporada,
        divisao,
        rodada: rodada.rodada,
        numero1: partida.numero1,
        numero2: partida.numero2,
        data: formatarDataPublicadaTemporada(partida.data),
        hora: partida.hora,
        status: partida.status,
        placar1: partida.placar1,
        placar2: partida.placar2,
        observacao: partida.observacao || "",
        atualizado_em: agora,
      }))),
    ));
    const abaTemporadas = planilha.getSheetByName(SHEETS.temporadas);
    const valores = abaTemporadas.getDataRange().getDisplayValues();
    const indice = valores.findIndex((linha, linhaIndice) =>
      linhaIndice > 0 && Number(linha[0]) === temporada,
    );
    if (indice > 0) abaTemporadas.getRange(indice + 1, 6).setValue(agora);
    Object.keys(CACHE).forEach((chave) => { delete CACHE[chave]; });
    return {
      sucesso: true,
      ...getTemporadaArquivadaParaEdicaoApi(temporada, registro),
    };
  } finally {
    lock.releaseLock();
  }
}
