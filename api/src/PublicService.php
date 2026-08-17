<?php

declare(strict_types=1);

namespace AecSinuca;

use PDO;

final class PublicService
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function seasons(): array
    {
        $current = $this->currentSeason();
        $years = $this->db->query(
            "SELECT year FROM seasons WHERE status IN ('ATIVA', 'ARQUIVADA') ORDER BY year DESC"
        )->fetchAll(PDO::FETCH_COLUMN);

        $feeStatement = $this->db->prepare(
            'SELECT setting_value FROM settings WHERE setting_key = :setting_key'
        );
        $feeStatement->execute(['setting_key' => 'taxa_inscricao_' . $current]);
        $fee = $feeStatement->fetchColumn();

        return [
            'temporada_atual' => $current,
            'temporadas' => array_map('intval', $years),
            'taxa_inscricao' => $fee === false || $fee === '' ? null : (float) $fee,
        ];
    }

    public function rounds(string $division, mixed $season): array
    {
        $division = $this->division($division);
        $year = $this->publicSeason($season);
        $statement = $this->db->prepare(<<<'SQL'
            SELECT
              s.year AS season_year,
              r.id AS round_id,
              r.number AS round_number,
              DATE_FORMAT(r.scheduled_date, '%d/%m/%Y') AS round_date,
              TIME_FORMAT(r.scheduled_time, '%H:%i') AS round_time,
              bp.number AS bye_number,
              bpj.id AS bye_player_id,
              bpj.name AS bye_name,
              bpj.display_name AS bye_display_name,
              bpj.nickname AS bye_nickname,
              m.id AS match_id,
              DATE_FORMAT(COALESCE(m.scheduled_date, r.scheduled_date), '%d/%m/%Y') AS scheduled_date,
              TIME_FORMAT(COALESCE(m.scheduled_time, r.scheduled_time), '%H:%i') AS scheduled_time,
              m.status,
              m.score1,
              m.score2,
              m.notes,
              m.updated_at,
              p1.number AS number1,
              j1.id AS player1_id,
              j1.name AS player1_name,
              j1.display_name AS player1_display_name,
              j1.nickname AS player1_nickname,
              p2.number AS number2,
              j2.id AS player2_id,
              j2.name AS player2_name,
              j2.display_name AS player2_display_name,
              j2.nickname AS player2_nickname
            FROM seasons s
            JOIN rounds r ON r.season_id = s.id AND r.division = :division
            LEFT JOIN participants bp ON bp.id = r.bye_participant_id
            LEFT JOIN players bpj ON bpj.id = bp.player_id
            LEFT JOIN matches m ON m.round_id = r.id
            LEFT JOIN participants p1 ON p1.id = m.participant1_id
            LEFT JOIN players j1 ON j1.id = p1.player_id
            LEFT JOIN participants p2 ON p2.id = m.participant2_id
            LEFT JOIN players j2 ON j2.id = p2.player_id
            WHERE s.year = :year AND s.status IN ('ATIVA', 'ARQUIVADA')
            ORDER BY r.number, m.match_order, m.id
        SQL);
        $statement->execute(['division' => $division, 'year' => $year]);

        return $this->groupRounds($statement->fetchAll(), $year, $division);
    }

    public function statistics(string $division, mixed $season): array
    {
        $division = $this->division($division);
        $year = $this->publicSeason($season);
        $participants = $this->participants($year, $division);
        $matches = $this->finishedMatches($year, $division);

        return StatisticsCalculator::calculate(
            $year,
            $division,
            $participants,
            $matches,
            $this->totalRounds($year, $division),
        );
    }

    public function ranking(): array
    {
        $currentYear = $this->currentSeason();
        $configured = $this->db->query(
            "SELECT setting_value FROM settings WHERE setting_key = 'ranking_reference_year'"
        )->fetchColumn();
        $referenceYear = $configured !== false && ctype_digit((string) $configured)
            ? (int) $configured
            : $currentYear - 1;

        return [
            'temporada_atual' => $currentYear,
            'referencia_automatica' => !($configured !== false && ctype_digit((string) $configured)),
            ...$this->rankingForReference($referenceYear),
        ];
    }

    public function rankingForReference(int $referenceYear): array
    {

        $seasonStatement = $this->db->prepare(<<<'SQL'
            SELECT DISTINCT s.year
            FROM seasons s
            JOIN participants p ON p.season_id = s.id AND p.division = 'A'
            WHERE s.status IN ('ATIVA', 'ARQUIVADA') AND s.year <= :reference_year
            GROUP BY s.id, s.year
            HAVING COUNT(p.id) >= 2
            ORDER BY s.year
        SQL);
        $seasonStatement->execute(['reference_year' => $referenceYear]);
        $seasonYears = array_map('intval', $seasonStatement->fetchAll(PDO::FETCH_COLUMN));
        $classifications = [];
        $players = [];

        foreach ($seasonYears as $year) {
            $statistics = StatisticsCalculator::calculate(
                $year,
                'A',
                $this->participants($year, 'A'),
                $this->finishedMatches($year, 'A'),
                $this->totalRounds($year, 'A'),
            );
            $total = count($statistics['classificacao']);
            foreach ($statistics['classificacao'] as $index => $player) {
                $playerId = (int) $player['jogador_id'];
                $players[$playerId] = [
                    'jogador_id' => $playerId,
                    'nome' => $player['nome'],
                    'exibicao' => $player['exibicao'],
                    'apelido' => $player['apelido'],
                ];
                $classifications[$year][$playerId] = [
                    'posicao' => $index + 1,
                    'pontos' => !empty($player['wo_direto']) ? 0 : $total - $index,
                    'wo_direto' => !empty($player['wo_direto']),
                ];
            }
        }

        $previousRanking = [];
        $ranking = [];
        $rankingDetails = [];
        $firstEvaluationYear = $seasonYears ? min($seasonYears) : $referenceYear;
        foreach (range($firstEvaluationYear, $referenceYear) as $evaluationYear) {
            $windowStart = $evaluationYear - 4;
            $points = [];
            $directWo = [];
            foreach ($classifications as $seasonYear => $classification) {
                if ($seasonYear < $windowStart || $seasonYear > $evaluationYear) {
                    continue;
                }
                foreach ($classification as $playerId => $result) {
                    $points[$playerId] = ($points[$playerId] ?? 0) + $result['pontos'];
                    if (!empty($result['wo_direto'])) {
                        $directWo[$playerId] = true;
                    }
                }
            }
            $candidateIds = array_values(array_unique([
                ...array_keys($points),
                ...array_keys($previousRanking),
            ]));
            usort($candidateIds, function (int $playerA, int $playerB) use ($points, $directWo, $previousRanking, $players): int {
                $difference = ($points[$playerB] ?? 0) <=> ($points[$playerA] ?? 0);
                if ($difference !== 0) {
                    return $difference;
                }
                if (($points[$playerA] ?? 0) === 0 && isset($directWo[$playerA]) !== isset($directWo[$playerB])) {
                    return isset($directWo[$playerA]) ? 1 : -1;
                }
                $previousA = $previousRanking[$playerA] ?? PHP_INT_MAX;
                $previousB = $previousRanking[$playerB] ?? PHP_INT_MAX;
                if ($previousA !== $previousB) {
                    return $previousA <=> $previousB;
                }
                $nameDifference = strcasecmp(
                    (string) ($players[$playerA]['exibicao'] ?? ''),
                    (string) ($players[$playerB]['exibicao'] ?? ''),
                );
                return $nameDifference !== 0 ? $nameDifference : $playerA <=> $playerB;
            });
            if ($evaluationYear === $referenceYear) {
                $rankingDetails = $candidateIds;
            }
            $candidateIds = array_slice($candidateIds, 0, 30);
            $previousRanking = [];
            foreach ($candidateIds as $index => $playerId) {
                $previousRanking[$playerId] = $index + 1;
            }
            if ($evaluationYear === $referenceYear) {
                $ranking = $candidateIds;
            }
        }

        $period = range($referenceYear - 4, $referenceYear);
        $buildRows = static function (array $playerIds) use ($period, $classifications, $players): array {
            $rows = [];
            foreach ($playerIds as $index => $playerId) {
                $seasons = [];
                $totalPoints = 0;
                foreach ($period as $year) {
                    $result = $classifications[$year][$playerId] ?? null;
                    $points = (int) ($result['pontos'] ?? 0);
                    $totalPoints += $points;
                    $seasons[] = [
                        'temporada' => $year,
                        'posicao' => $result['posicao'] ?? null,
                        'pontos' => $points,
                    ];
                }
                $rows[] = [
                    'posicao' => $index + 1,
                    ...$players[$playerId],
                    'pontos' => $totalPoints,
                    'temporadas' => $seasons,
                ];
            }
            return $rows;
        };

        return [
            'referencia' => $referenceYear,
            'periodo' => $period,
            'ranking' => $buildRows($ranking),
            'detalhes' => $buildRows($rankingDetails),
        ];
    }

    public function currentSeason(): int
    {
        $value = $this->db->query("SELECT setting_value FROM settings WHERE setting_key = 'temporada_atual'")
            ->fetchColumn();
        if ($value !== false && ctype_digit((string) $value)) {
            return (int) $value;
        }

        $value = $this->db->query("SELECT year FROM seasons WHERE status = 'ATIVA' ORDER BY year DESC LIMIT 1")
            ->fetchColumn();
        if ($value === false) {
            throw new ApiException('Temporada atual não configurada.', 503);
        }
        return (int) $value;
    }

    private function publicSeason(mixed $season): int
    {
        $year = $season === null || $season === '' ? $this->currentSeason() : filter_var($season, FILTER_VALIDATE_INT);
        if (!$year) {
            throw new ApiException('Temporada não encontrada no histórico.', 404);
        }
        $statement = $this->db->prepare(
            "SELECT 1 FROM seasons WHERE year = :year AND status IN ('ATIVA', 'ARQUIVADA')"
        );
        $statement->execute(['year' => $year]);
        if (!$statement->fetchColumn()) {
            throw new ApiException('Temporada não encontrada no histórico.', 404);
        }
        return (int) $year;
    }

    private function division(string $division): string
    {
        $division = strtoupper(trim($division));
        if (!in_array($division, ['A', 'B'], true)) {
            throw new ApiException('Divisão inválida.');
        }
        return $division;
    }

    private function participants(int $year, string $division): array
    {
        $statement = $this->db->prepare(<<<'SQL'
            SELECT p.id AS participant_id, p.number, p.tiebreak_priority, p.direct_wo,
                   j.id AS player_id, j.name, j.display_name, j.nickname
            FROM participants p
            JOIN seasons s ON s.id = p.season_id
            JOIN players j ON j.id = p.player_id
            WHERE s.year = :year AND p.division = :division
            ORDER BY p.number
        SQL);
        $statement->execute(['year' => $year, 'division' => $division]);
        return $statement->fetchAll();
    }

    private function finishedMatches(int $year, string $division): array
    {
        $statement = $this->db->prepare(<<<'SQL'
            SELECT r.number AS round_number, m.participant1_id, m.participant2_id,
                   m.score1, m.score2
            FROM matches m
            JOIN rounds r ON r.id = m.round_id
            JOIN seasons s ON s.id = r.season_id
            WHERE s.year = :year AND r.division = :division AND m.status = 'E'
            ORDER BY r.number, m.match_order
        SQL);
        $statement->execute(['year' => $year, 'division' => $division]);
        return $statement->fetchAll();
    }

    private function totalRounds(int $year, string $division): int
    {
        $statement = $this->db->prepare(<<<'SQL'
            SELECT COALESCE(MAX(r.number), 0)
            FROM rounds r
            JOIN seasons s ON s.id = r.season_id
            WHERE s.year = :year AND r.division = :division
        SQL);
        $statement->execute(['year' => $year, 'division' => $division]);
        return (int) $statement->fetchColumn();
    }

    private function groupRounds(array $rows, int $year, string $division): array
    {
        $rounds = [];
        foreach ($rows as $row) {
            $roundNumber = (int) $row['round_number'];
            if (!isset($rounds[$roundNumber])) {
                $rounds[$roundNumber] = [
                    'rodada' => $roundNumber,
                    'data' => $row['round_date'] ?? '',
                    'hora' => $row['round_time'] ?? '',
                    'status' => ['codigo' => '', 'descricao' => '', 'classe' => ''],
                    'partidas' => [],
                ];
                if ($row['bye_number'] !== null) {
                    $rounds[$roundNumber]['folga'] = [
                        'id' => (int) $row['bye_player_id'],
                        'numero' => (int) $row['bye_number'],
                        'nome' => $row['bye_name'],
                        'exibicao' => $row['bye_display_name'],
                        'apelido' => $row['bye_nickname'],
                    ];
                }
            }
            if ($row['match_id'] === null) {
                continue;
            }
            $match = $this->formatMatch($row, $year, $division);
            $rounds[$roundNumber]['partidas'][] = $match;
        }

        foreach ($rounds as &$round) {
            $statuses = array_column(array_column($round['partidas'], 'status'), 'codigo');
            $round['status'] = $round['partidas'][0]['status']
                ?? ['codigo' => '', 'descricao' => '', 'classe' => ''];
            $round['total_partidas'] = count($round['partidas']);
            $round['partidas_encerradas'] = count(array_filter($statuses, fn ($value) => $value === 'E'));
            $round['partidas_ao_vivo'] = count(array_filter($statuses, fn ($value) => $value === 'V'));
            $round['partidas_agendadas'] = count(array_filter($statuses, fn ($value) => $value === 'A'));
        }
        unset($round);
        return array_values($rounds);
    }

    private function formatMatch(array $row, int $year, string $division): array
    {
        return [
            'rodada' => (int) $row['round_number'],
            'data' => $row['scheduled_date'] ?? '',
            'hora' => $row['scheduled_time'] ?? '',
            'status' => $this->statusInfo($row['status']),
            'jogador1' => $this->formatPlayer($row, '1'),
            'jogador2' => $this->formatPlayer($row, '2'),
            'placar1' => $row['score1'] === null ? '-' : (string) $row['score1'],
            'placar2' => $row['score2'] === null ? '-' : (string) $row['score2'],
            'observacao' => ['texto' => $row['notes'] ?? '', 'tipo' => ''],
            'atualizado_em' => $row['updated_at'],
            'id' => sprintf('%d-%s-%d-%d-%d', $year, $division, $row['round_number'], $row['number1'], $row['number2']),
            'edicao' => ['pode_editar' => false, 'pode_salvar' => false],
        ];
    }

    private function formatPlayer(array $row, string $suffix): array
    {
        return [
            'id' => (int) $row["player{$suffix}_id"],
            'numero' => (int) $row["number{$suffix}"],
            'nome' => $row["player{$suffix}_name"],
            'exibicao' => $row["player{$suffix}_display_name"],
            'apelido' => $row["player{$suffix}_nickname"],
        ];
    }

    private function statusInfo(string $status): array
    {
        return match ($status) {
            'A' => ['codigo' => 'A', 'descricao' => 'Agendado', 'classe' => 'status-soon'],
            'V' => ['codigo' => 'V', 'descricao' => 'Em andamento', 'classe' => 'status-live'],
            'E' => ['codigo' => 'E', 'descricao' => 'Encerrado', 'classe' => 'status-done'],
            default => ['codigo' => '', 'descricao' => '', 'classe' => ''],
        };
    }
}
