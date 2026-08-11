<?php

declare(strict_types=1);

namespace AecSinuca;

final class StatisticsCalculator
{
    public static function calculate(
        int $year,
        string $division,
        array $participants,
        array $matches,
        int $totalRounds,
    ): array
    {
        $statistics = [];
        foreach ($participants as $participant) {
            $id = (int) $participant['participant_id'];
            $statistics[$id] = [
                'numero' => (int) $participant['number'],
                'jogador_id' => (int) $participant['player_id'],
                'nome' => $participant['name'],
                'exibicao' => $participant['display_name'],
                'apelido' => $participant['nickname'],
                'vitorias' => 0,
                'partidas_vencidas' => 0,
                'resultados' => [],
                '_prioridade' => $participant['tiebreak_priority'] === null
                    ? null : (int) $participant['tiebreak_priority'],
            ];
        }

        $direct = [];
        foreach ($matches as $match) {
            if ($match['score1'] === null || $match['score2'] === null) {
                continue;
            }
            $participant1 = (int) $match['participant1_id'];
            $participant2 = (int) $match['participant2_id'];
            if (!isset($statistics[$participant1], $statistics[$participant2])) {
                continue;
            }
            $score1 = (int) $match['score1'];
            $score2 = (int) $match['score2'];
            $round = (int) $match['round_number'];
            $statistics[$participant1]['partidas_vencidas'] += $score1;
            $statistics[$participant2]['partidas_vencidas'] += $score2;
            if ($score1 === 2) {
                $statistics[$participant1]['vitorias']++;
            }
            if ($score2 === 2) {
                $statistics[$participant2]['vitorias']++;
            }
            if (($score1 === 2) xor ($score2 === 2)) {
                $key = self::directKey($statistics[$participant1]['numero'], $statistics[$participant2]['numero']);
                $direct[$key] = $score1 === 2
                    ? $statistics[$participant1]['numero'] : $statistics[$participant2]['numero'];
            }
            self::addResult($statistics[$participant1], $statistics[$participant2], $round, $score1, $score2);
            self::addResult($statistics[$participant2], $statistics[$participant1], $round, $score2, $score1);
        }

        $players = array_values($statistics);
        foreach ($players as &$player) {
            usort($player['resultados'], fn ($a, $b) => $a['rodada'] <=> $b['rodada']);
        }
        unset($player);

        $classification = $players;
        usort($classification, function (array $a, array $b) use ($direct): int {
            $result = $b['vitorias'] <=> $a['vitorias']
                ?: $b['partidas_vencidas'] <=> $a['partidas_vencidas'];
            if ($result !== 0) {
                return $result;
            }
            $priorityA = $a['_prioridade'] ?? PHP_INT_MAX;
            $priorityB = $b['_prioridade'] ?? PHP_INT_MAX;
            if ($priorityA !== $priorityB) {
                return $priorityA <=> $priorityB;
            }
            $winner = $direct[self::directKey($a['numero'], $b['numero'])] ?? null;
            if ($winner !== null) {
                return $winner === $a['numero'] ? -1 : 1;
            }
            return $a['numero'] <=> $b['numero'];
        });

        $count = count($classification);
        foreach ($classification as $index => &$player) {
            $player['posicao'] = $index + 1;
            $player['zona'] = self::zone($division, $index + 1, $count);
            unset($player['_prioridade']);
        }
        unset($player);
        foreach ($players as &$player) {
            unset($player['_prioridade']);
        }

        return [
            'temporada' => $year,
            'divisao' => $division,
            'total_rodadas' => $totalRounds,
            'total_participantes' => count($players),
            'jogadores' => $players,
            'classificacao' => $classification,
        ];
    }

    private static function addResult(array &$player, array $opponent, int $round, int $own, int $away): void
    {
        $player['resultados'][] = [
            'rodada' => $round,
            'resultado' => $own === 2 ? 'V' : 'D',
            'placar' => "{$own} x {$away}",
            'placar_proprio' => $own,
            'placar_adversario' => $away,
            'adversario' => [
                'numero' => $opponent['numero'],
                'jogador_id' => $opponent['jogador_id'],
                'exibicao' => $opponent['exibicao'],
            ],
        ];
    }

    private static function directKey(int $number1, int $number2): string
    {
        return min($number1, $number2) . '-' . max($number1, $number2);
    }

    private static function zone(string $division, int $position, int $total): string
    {
        if ($division === 'A') {
            if ($position === 1) {
                return 'lider';
            }
            if ($position > $total - 4) {
                return 'rebaixamento';
            }
        }
        if ($division === 'B' && $position <= min(4, $total)) {
            return 'acesso';
        }
        return '';
    }
}
