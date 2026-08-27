<?php

declare(strict_types=1);

namespace AecSinuca;

final class ScoreboardState
{
    public static function normalize(mixed $value): array
    {
        if (!is_array($value) || array_is_list($value)) {
            throw new ApiException('Estado do placar inválido.');
        }
        $names = self::pair($value['names'] ?? null);
        foreach ($names as &$name) {
            if (!is_string($name) || preg_match('//u', $name) !== 1) {
                throw new ApiException('Nome de jogador inválido.');
            }
            $name = trim($name);
            if ($name === '' || preg_match('/^[^\p{C}]{1,40}$/u', $name) !== 1) {
                throw new ApiException('Informe nomes de 1 a 40 caracteres.');
            }
        }
        unset($name);
        $points = array_map(fn ($v) => self::integer($v, 999999), self::pair($value['points'] ?? null));
        $wins = array_map(fn ($v) => self::integer($v, 9999), self::pair($value['wins'] ?? null));
        $history = $value['history'] ?? null;
        if (!is_array($history) || !array_is_list($history) || count($history) > 500) {
            throw new ApiException('Histórico inválido ou acima de 500 partidas.');
        }
        $frames = [];
        foreach ($history as $frame) {
            if (!is_array($frame)) {
                throw new ApiException('Partida do histórico inválida.');
            }
            $date = $frame['date'] ?? null;
            // Mesmo ISO UTC produzido por Date.toISOString() no placar local.
            if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/D', $date)) {
                throw new ApiException('Data do histórico inválida.');
            }
            $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s.v\Z', $date, new \DateTimeZone('UTC'));
            if (!$parsed || $parsed->format('Y-m-d\TH:i:s.v\Z') !== $date) {
                throw new ApiException('Data do histórico inválida.');
            }
            $scores = array_map(fn ($v) => self::integer($v, 999999), self::pair($frame['points'] ?? null));
            $winner = self::integer($frame['winner'] ?? null, 1);
            if ($scores[$winner] <= $scores[1 - $winner]) {
                throw new ApiException('Vencedor do histórico incompatível com os pontos.');
            }
            $frames[] = ['date' => $date, 'points' => $scores, 'winner' => $winner];
        }
        return [
            'names' => $names, 'points' => $points, 'wins' => $wins,
            'history' => $frames,
            'breakPlayer' => self::integer($value['breakPlayer'] ?? null, 1),
            'strokeScore' => self::integer($value['strokeScore'] ?? null, 999999),
        ];
    }

    private static function pair(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) !== 2) {
            throw new ApiException('Informe exatamente dois jogadores/placares.');
        }
        return $value;
    }

    public static function integer(mixed $value, int $max): int
    {
        if (!is_int($value) || $value < 0 || $value > $max) {
            throw new ApiException('Valor numérico do placar inválido.');
        }
        return $value;
    }
}
