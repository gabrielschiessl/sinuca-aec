<?php

declare(strict_types=1);

namespace AecSinuca;

use PDO;

final class AdminService
{
    public function __construct(
        private readonly PDO $db,
        private readonly AuthService $auth,
        private readonly PublicService $public,
    ) {
    }

    public function matches(string $token, string $division): array
    {
        $this->auth->administrator($token);
        $rounds = $this->public->rounds($division, null);
        foreach ($rounds as &$round) {
            foreach ($round['partidas'] as &$match) {
                $match['edicao'] = ['pode_editar' => true, 'pode_salvar' => true];
            }
            unset($match);
        }
        unset($round);
        return $rounds;
    }

    public function participants(string $token, string $division): array
    {
        $this->auth->administrator($token);
        $division = $this->division($division);
        $year = $this->public->currentSeason();
        $seasonId = $this->seasonId($year);

        $statement = $this->db->prepare(<<<'SQL'
            SELECT p.number, p.player_id, p.tiebreak_priority,
                   j.name, j.display_name, j.nickname, j.active
            FROM participants p
            JOIN players j ON j.id = p.player_id
            WHERE p.season_id = :season_id AND p.division = :division
            ORDER BY p.number
        SQL);
        $statement->execute(['season_id' => $seasonId, 'division' => $division]);
        $participants = array_map(
            fn ($row) => [
                'temporada' => $year,
                'divisao' => $division,
                'numero' => (int) $row['number'],
                'jogador_id' => (int) $row['player_id'],
                'desempate' => $row['tiebreak_priority'] === null
                    ? null : (int) $row['tiebreak_priority'],
                'jogador' => $this->player($row),
            ],
            $statement->fetchAll(),
        );

        $currentIds = array_column($participants, 'jogador_id');
        $occupiedStatement = $this->db->prepare(<<<'SQL'
            SELECT player_id FROM participants
            WHERE season_id = :season_id AND division <> :division
        SQL);
        $occupiedStatement->execute(['season_id' => $seasonId, 'division' => $division]);
        $occupiedIds = array_map('intval', $occupiedStatement->fetchAll(PDO::FETCH_COLUMN));
        $players = array_values(array_filter(
            $this->allPlayers(),
            fn ($player) => in_array($player['id'], $currentIds, true) ||
                ($player['ativo'] && !in_array($player['id'], $occupiedIds, true)),
        ));

        return [
            'temporada' => $year,
            'divisao' => $division,
            'participantes' => $participants,
            'jogadores' => $players,
        ];
    }

    public function players(string $token): array
    {
        $this->auth->administrator($token);
        $year = $this->public->currentSeason();
        $seasonId = $this->seasonId($year);
        $statement = $this->db->prepare(
            'SELECT player_id, division, number FROM participants WHERE season_id = :season_id'
        );
        $statement->execute(['season_id' => $seasonId]);
        $linked = [];
        foreach ($statement->fetchAll() as $row) {
            $linked[(int) $row['player_id']] = [
                'divisao' => $row['division'],
                'numero' => (int) $row['number'],
            ];
        }
        $players = $this->allPlayers();
        usort($players, fn ($a, $b) => strcasecmp($a['exibicao'], $b['exibicao']));
        foreach ($players as &$player) {
            $player['participante_atual'] = $linked[$player['id']] ?? null;
        }
        unset($player);

        return ['temporada' => $year, 'jogadores' => $players];
    }

    public function seasons(string $token): array
    {
        $this->auth->administrator($token);
        $currentYear = $this->public->currentSeason();
        $statement = $this->db->query(<<<'SQL'
            SELECT s.year, s.version, s.status, s.origin, s.created_at, s.updated_at,
                   SUM(CASE WHEN p.division = 'A' THEN 1 ELSE 0 END) AS participants_a,
                   SUM(CASE WHEN p.division = 'B' THEN 1 ELSE 0 END) AS participants_b
            FROM seasons s
            LEFT JOIN participants p ON p.season_id = s.id
            GROUP BY s.id, s.year, s.version, s.status, s.origin, s.created_at, s.updated_at
            ORDER BY s.year DESC, s.version DESC
        SQL);
        $seasons = array_map(fn ($row) => [
            'temporada' => (int) $row['year'],
            'versao' => (int) $row['version'],
            'status' => $row['status'],
            'tipo' => $row['origin'],
            'criado_em' => $row['created_at'],
            'atualizado_em' => $row['updated_at'],
            'participantes_a' => (int) $row['participants_a'],
            'participantes_b' => (int) $row['participants_b'],
        ], $statement->fetchAll());

        return [
            'temporada_atual' => $currentYear,
            'ano_minimo' => (int) gmdate('Y'),
            'temporadas' => $seasons,
        ];
    }

    public function prepareSeason(string $token, mixed $informedYear): array
    {
        $this->auth->administrator($token);
        $year = $this->newSeasonYear($informedYear);
        $exists = $this->db->prepare('SELECT 1 FROM seasons WHERE year = :year');
        $exists->execute(['year' => $year]);
        if ($exists->fetchColumn()) {
            throw new ApiException("A temporada {$year} já existe.");
        }

        $classificationA = $this->public->statistics('A', null)['classificacao'];
        $classificationB = $this->public->statistics('B', null)['classificacao'];
        $seriesA = [...array_slice($classificationA, 0, 16), ...array_slice($classificationB, 0, 4)];
        $seriesB = [...array_slice($classificationB, 4), ...array_slice($classificationA, -4)];
        $participants = [
            'A' => $this->suggestedParticipants($seriesA, 'A'),
            'B' => $this->suggestedParticipants($seriesB, 'B'),
        ];
        $rounds = [
            'A' => $this->roundRobinSchedule(count($participants['A']), 'A'),
            'B' => $this->roundRobinSchedule(count($participants['B']), 'B'),
        ];
        $rounds['A'] = $this->copyCurrentSchedule('A', count($participants['A']));
        $currentB = $this->participantCount($this->public->currentSeason(), 'B');
        if (count($participants['B']) === $currentB) {
            $rounds['B'] = $this->copyCurrentSchedule('B', count($participants['B']));
        }

        return [
            'persistida' => false,
            'modo' => 'NOVA',
            'temporada' => $year,
            'versao' => 1,
            'status' => 'PREPARACAO',
            'participantes' => $participants,
            'rodadas' => $rounds,
            'jogadores' => $this->sortedPlayers(),
        ];
    }

    public function prepareLegacySeason(string $token, mixed $informedYear): array
    {
        $this->auth->administrator($token);
        $year = $this->legacySeasonYear($informedYear, true);
        $currentYear = $this->public->currentSeason();
        $statement = $this->db->prepare(<<<'SQL'
            SELECT p.division, p.number, p.player_id, p.tiebreak_priority
            FROM participants p
            JOIN seasons s ON s.id = p.season_id
            WHERE s.year = :year
            ORDER BY p.division, p.number
        SQL);
        $statement->execute(['year' => $currentYear]);
        $participants = ['A' => [], 'B' => []];
        foreach ($statement->fetchAll() as $participant) {
            $division = $participant['division'];
            $participants[$division][] = [
                'temporada' => $year,
                'versao' => 1,
                'divisao' => $division,
                'numero' => (int) $participant['number'],
                'jogador_id' => (int) $participant['player_id'],
                'desempate' => $participant['tiebreak_priority'] === null
                    ? null : (int) $participant['tiebreak_priority'],
            ];
        }
        $rounds = [
            'A' => $this->roundRobinSchedule(count($participants['A']), 'A'),
            'B' => $this->roundRobinSchedule(count($participants['B']), 'B'),
        ];
        foreach (['A', 'B'] as $division) {
            foreach ($rounds[$division] as &$round) {
                foreach ($round['partidas'] as &$match) {
                    $match['status'] = 'E';
                    $match['placar1'] = '-';
                    $match['placar2'] = '-';
                    $match['observacao'] = '';
                }
                unset($match);
            }
            unset($round);
        }
        return [
            'persistida' => false,
            'modo' => 'LEGADA',
            'temporada' => $year,
            'versao' => 1,
            'status' => 'PREPARACAO',
            'tipo' => 'LEGADA',
            'participantes' => $participants,
            'rodadas' => $rounds,
            'jogadores' => $this->sortedPlayers(),
        ];
    }

    public function loadSeason(string $token, mixed $informedYear): array
    {
        $this->auth->administrator($token);
        $year = filter_var($informedYear, FILTER_VALIDATE_INT);
        if (!$year) {
            throw new ApiException('Temporada em preparação não encontrada.', 404);
        }
        $seasonStatement = $this->db->prepare(<<<'SQL'
            SELECT id, year, version, status, origin
            FROM seasons
            WHERE year = :year AND status = 'PREPARACAO'
            LIMIT 1
        SQL);
        $seasonStatement->execute(['year' => $year]);
        $season = $seasonStatement->fetch();
        if (!$season) {
            throw new ApiException('Temporada em preparação não encontrada.', 404);
        }

        $participantsStatement = $this->db->prepare(<<<'SQL'
            SELECT division, number, player_id, tiebreak_priority
            FROM participants
            WHERE season_id = :season_id
            ORDER BY division, number
        SQL);
        $participantsStatement->execute(['season_id' => $season['id']]);
        $participants = ['A' => [], 'B' => []];
        foreach ($participantsStatement->fetchAll() as $participant) {
            $division = $participant['division'];
            $participants[$division][] = [
                'temporada' => (int) $season['year'],
                'versao' => (int) $season['version'],
                'divisao' => $division,
                'numero' => (int) $participant['number'],
                'jogador_id' => (int) $participant['player_id'],
                'desempate' => $participant['tiebreak_priority'] === null
                    ? null : (int) $participant['tiebreak_priority'],
            ];
        }

        return [
            'persistida' => true,
            'modo' => strtoupper((string) $season['origin']) === 'LEGADA' ? 'LEGADA' : 'NOVA',
            'temporada' => (int) $season['year'],
            'versao' => (int) $season['version'],
            'status' => 'PREPARACAO',
            'participantes' => $participants,
            'rodadas' => $this->draftSchedule((int) $season['id']),
            'jogadores' => $this->sortedPlayers(),
        ];
    }

    public function saveSeason(
        string $token,
        mixed $informedYear,
        array $informedParticipants,
        array $informedRounds,
    ): array {
        $administrator = $this->auth->administrator($token);
        $year = $this->newSeasonYear($informedYear);
        $participants = $this->validateNewSeasonParticipants($informedParticipants);
        $rounds = $this->validateSeasonSchedule($informedRounds, $participants, true);

        $this->db->beginTransaction();
        try {
            $seasonStatement = $this->db->prepare(
                'SELECT id, version, status, origin FROM seasons WHERE year = :year LIMIT 1 FOR UPDATE'
            );
            $seasonStatement->execute(['year' => $year]);
            $current = $seasonStatement->fetch();
            if ($current && $current['status'] !== 'PREPARACAO') {
                throw new ApiException('Somente temporadas em preparação podem ser alteradas.');
            }

            if ($current) {
                $seasonId = (int) $current['id'];
                $this->clearSeasonContent($seasonId);
                $updateSeason = $this->db->prepare(<<<'SQL'
                    UPDATE seasons
                    SET origin = 'CRIADA', updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id
                SQL);
                $updateSeason->execute(['id' => $seasonId]);
            } else {
                $insertSeason = $this->db->prepare(<<<'SQL'
                    INSERT INTO seasons (year, version, status, origin)
                    VALUES (:year, 1, 'PREPARACAO', 'CRIADA')
                SQL);
                $insertSeason->execute(['year' => $year]);
                $seasonId = (int) $this->db->lastInsertId();
            }

            $this->persistSeasonContent($seasonId, $participants, $rounds, false);
            $after = [
                'temporada' => $year,
                'status' => 'PREPARACAO',
                'tipo' => 'CRIADA',
                'participantes_a' => count($participants['A']),
                'participantes_b' => count($participants['B']),
                'rodadas_a' => count($rounds['A']),
                'rodadas_b' => count($rounds['B']),
            ];
            $this->audit(
                (int) $administrator['administrator_id'],
                'salvar_temporada',
                'temporada',
                (string) $seasonId,
                $current ? [
                    'temporada' => $year,
                    'status' => $current['status'],
                    'tipo' => $current['origin'],
                ] : null,
                $after,
            );
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, ...$this->loadSeason($token, $year)];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function saveLegacySeason(
        string $token,
        mixed $informedYear,
        array $informedParticipants,
        array $informedRounds,
    ): array {
        $administrator = $this->auth->administrator($token);
        $year = $this->legacySeasonYear($informedYear, false);
        $participants = $this->validateLegacyParticipants($informedParticipants);
        $rounds = $this->validateSeasonSchedule($informedRounds, $participants, false);
        $rounds = $this->applyLegacyResults($rounds, $informedRounds);

        $this->db->beginTransaction();
        try {
            $seasonStatement = $this->db->prepare(
                'SELECT id, version, status, origin FROM seasons WHERE year = :year LIMIT 1 FOR UPDATE'
            );
            $seasonStatement->execute(['year' => $year]);
            $current = $seasonStatement->fetch();
            if ($current && ($current['status'] !== 'PREPARACAO' ||
                strtoupper((string) $current['origin']) !== 'LEGADA')) {
                throw new ApiException("A temporada {$year} já está cadastrada.");
            }
            if ($current) {
                $seasonId = (int) $current['id'];
                $this->clearSeasonContent($seasonId);
                $touchSeason = $this->db->prepare(
                    "UPDATE seasons SET updated_at = CURRENT_TIMESTAMP WHERE id = :id"
                );
                $touchSeason->execute(['id' => $seasonId]);
            } else {
                $insertSeason = $this->db->prepare(<<<'SQL'
                    INSERT INTO seasons (year, version, status, origin)
                    VALUES (:year, 1, 'PREPARACAO', 'LEGADA')
                SQL);
                $insertSeason->execute(['year' => $year]);
                $seasonId = (int) $this->db->lastInsertId();
            }
            $this->persistSeasonContent($seasonId, $participants, $rounds, true);
            $this->audit(
                (int) $administrator['administrator_id'],
                'salvar_temporada_legada',
                'temporada',
                (string) $seasonId,
                $current ? ['temporada' => $year, 'status' => $current['status']] : null,
                [
                    'temporada' => $year,
                    'status' => 'PREPARACAO',
                    'tipo' => 'LEGADA',
                    'participantes_a' => count($participants['A']),
                    'participantes_b' => count($participants['B']),
                ],
            );
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, ...$this->loadSeason($token, $year)];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function publishLegacySeason(string $token, mixed $informedYear): array
    {
        $administrator = $this->auth->administrator($token);
        $year = $this->legacySeasonYear($informedYear, false);
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(<<<'SQL'
                SELECT id, status, origin
                FROM seasons
                WHERE year = :year
                LIMIT 1
                FOR UPDATE
            SQL);
            $statement->execute(['year' => $year]);
            $season = $statement->fetch();
            if (!$season || $season['status'] !== 'PREPARACAO' ||
                strtoupper((string) $season['origin']) !== 'LEGADA') {
                throw new ApiException('Rascunho da temporada não encontrado.', 404);
            }
            $matches = $this->db->prepare(<<<'SQL'
                SELECT r.division, m.scheduled_date, m.scheduled_time
                FROM matches m
                JOIN rounds r ON r.id = m.round_id
                WHERE r.season_id = :season_id
            SQL);
            $matches->execute(['season_id' => $season['id']]);
            foreach ($matches->fetchAll() as $match) {
                if (!$match['scheduled_date'] || !$match['scheduled_time']) {
                    throw new ApiException(
                        "Preencha a data e o horário de todas as partidas da Série {$match['division']}."
                    );
                }
            }
            $update = $this->db->prepare(
                "UPDATE seasons SET status = 'ARQUIVADA' WHERE id = :id"
            );
            $update->execute(['id' => $season['id']]);
            $this->audit(
                (int) $administrator['administrator_id'],
                'publicar_temporada_legada',
                'temporada',
                (string) $season['id'],
                ['temporada' => $year, 'status' => 'PREPARACAO', 'tipo' => 'LEGADA'],
                ['temporada' => $year, 'status' => 'ARQUIVADA', 'tipo' => 'LEGADA'],
            );
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, 'temporada' => $year, 'status' => 'ARQUIVADA'];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function deleteSeason(string $token, mixed $informedYear): array
    {
        $administrator = $this->auth->administrator($token);
        $year = filter_var($informedYear, FILTER_VALIDATE_INT);
        if (!$year) {
            throw new ApiException('Temporada em preparação não encontrada.', 404);
        }

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(<<<'SQL'
                SELECT id, year, version, status, origin
                FROM seasons
                WHERE year = :year
                LIMIT 1
                FOR UPDATE
            SQL);
            $statement->execute(['year' => $year]);
            $season = $statement->fetch();
            if (!$season || $season['status'] !== 'PREPARACAO') {
                throw new ApiException('Temporada em preparação não encontrada.', 404);
            }
            $countsStatement = $this->db->prepare(<<<'SQL'
                SELECT
                  (SELECT COUNT(*) FROM participants WHERE season_id = :participants_season_id) AS participants,
                  (SELECT COUNT(*) FROM rounds WHERE season_id = :rounds_season_id) AS rounds,
                  (SELECT COUNT(*) FROM matches m
                     JOIN rounds r ON r.id = m.round_id
                    WHERE r.season_id = :matches_season_id) AS matches
            SQL);
            $countsStatement->execute([
                'participants_season_id' => $season['id'],
                'rounds_season_id' => $season['id'],
                'matches_season_id' => $season['id'],
            ]);
            $counts = $countsStatement->fetch();
            $this->clearSeasonContent((int) $season['id']);
            $delete = $this->db->prepare('DELETE FROM seasons WHERE id = :id');
            $delete->execute(['id' => $season['id']]);
            $this->audit(
                (int) $administrator['administrator_id'],
                'excluir_temporada',
                'temporada',
                (string) $season['id'],
                [
                    'temporada' => (int) $season['year'],
                    'versao' => (int) $season['version'],
                    'status' => $season['status'],
                    'tipo' => $season['origin'],
                    'participantes' => (int) $counts['participants'],
                    'rodadas' => (int) $counts['rounds'],
                    'partidas' => (int) $counts['matches'],
                ],
                null,
            );
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, ...$this->seasons($token)];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function saveParticipants(
        string $token,
        string $division,
        array $changes,
        array $temporarilyActivatedPlayers = [],
    ): array {
        $administrator = $this->auth->administrator($token);
        $division = $this->division($division);
        if ($changes === []) {
            throw new ApiException('Nenhuma alteração de participante foi informada.');
        }

        $activationIds = [];
        foreach ($temporarilyActivatedPlayers as $playerId) {
            $playerId = filter_var($playerId, FILTER_VALIDATE_INT);
            if ($playerId && $playerId > 0) {
                $activationIds[(int) $playerId] = true;
            }
        }

        $this->db->beginTransaction();
        try {
            $year = $this->public->currentSeason();
            $seasonId = $this->seasonId($year);
            $participantsStatement = $this->db->prepare(<<<'SQL'
                SELECT id, division, number, player_id, tiebreak_priority
                FROM participants
                WHERE season_id = :season_id
                ORDER BY division, number
                FOR UPDATE
            SQL);
            $participantsStatement->execute(['season_id' => $seasonId]);
            $currentParticipants = $participantsStatement->fetchAll();

            $playersStatement = $this->db->query(
                'SELECT id, active FROM players ORDER BY id FOR UPDATE'
            );
            $players = [];
            foreach ($playersStatement->fetchAll() as $player) {
                $players[(int) $player['id']] = (bool) $player['active'];
            }

            $byKey = [];
            foreach ($currentParticipants as $index => $participant) {
                $byKey[$participant['division'] . '-' . (int) $participant['number']] = $index;
            }

            $normalizedChanges = [];
            $changedNumbers = [];
            foreach ($changes as $change) {
                if (!is_array($change)) {
                    throw new ApiException('Um dos participantes informados é inválido ou está inativo.');
                }
                $number = filter_var($change['numero'] ?? null, FILTER_VALIDATE_INT);
                $playerId = filter_var($change['jogador_id'] ?? null, FILTER_VALIDATE_INT);
                if (!$number || !$playerId || isset($changedNumbers[(int) $number])) {
                    throw new ApiException('Um dos participantes informados é inválido ou está inativo.');
                }
                $key = $division . '-' . (int) $number;
                if (!isset($byKey[$key])) {
                    throw new ApiException("Participante nº {$number} não encontrado na Série {$division}.", 404);
                }
                if (!array_key_exists((int) $playerId, $players) ||
                    (!$players[(int) $playerId] && !isset($activationIds[(int) $playerId]))) {
                    throw new ApiException('Um dos participantes informados é inválido ou está inativo.');
                }
                $tiebreak = $this->tiebreakPriority($change['desempate'] ?? null);
                $normalizedChanges[] = [
                    'index' => $byKey[$key],
                    'numero' => (int) $number,
                    'jogador_id' => (int) $playerId,
                    'desempate' => $tiebreak,
                ];
                $changedNumbers[(int) $number] = true;
            }

            $beforeByIndex = [];
            foreach ($normalizedChanges as $change) {
                $index = $change['index'];
                $beforeByIndex[$index] = $currentParticipants[$index];
                $currentParticipants[$index]['player_id'] = $change['jogador_id'];
                $currentParticipants[$index]['tiebreak_priority'] = $change['desempate'];
            }
            $finalPlayerIds = array_map(
                fn ($participant) => (int) $participant['player_id'],
                $currentParticipants,
            );
            if (count(array_unique($finalPlayerIds)) !== count($finalPlayerIds)) {
                throw new ApiException('Um jogador não pode ocupar mais de uma vaga na mesma temporada.');
            }

            $updateParticipant = $this->db->prepare(<<<'SQL'
                UPDATE participants
                SET player_id = :player_id, tiebreak_priority = :tiebreak_priority
                WHERE id = :id
            SQL);
            $affectedPlayerIds = [];
            foreach ($normalizedChanges as $change) {
                $index = $change['index'];
                $before = $beforeByIndex[$index];
                $after = $currentParticipants[$index];
                $updateParticipant->execute([
                    'player_id' => $after['player_id'],
                    'tiebreak_priority' => $after['tiebreak_priority'],
                    'id' => $after['id'],
                ]);
                $affectedPlayerIds[(int) $before['player_id']] = true;
                $affectedPlayerIds[(int) $after['player_id']] = true;
                $this->audit(
                    (int) $administrator['administrator_id'],
                    'salvar_participante',
                    'participante',
                    (string) $after['id'],
                    $this->participantAuditState($before),
                    $this->participantAuditState($after),
                );
            }

            $linkedPlayerIds = array_fill_keys($finalPlayerIds, true);
            $updatePlayer = $this->db->prepare(
                'UPDATE players SET active = :active WHERE id = :id'
            );
            foreach (array_keys($affectedPlayerIds) as $playerId) {
                $updatePlayer->execute([
                    'active' => isset($linkedPlayerIds[$playerId]) ? 1 : 0,
                    'id' => $playerId,
                ]);
            }

            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, ...$this->participants($token, $division)];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function savePlayers(string $token, array $changes): array
    {
        $administrator = $this->auth->administrator($token);
        if ($changes === []) {
            throw new ApiException('Nenhuma alteração de jogador foi informada.');
        }

        $this->db->beginTransaction();
        try {
            $seasonId = $this->seasonId($this->public->currentSeason());
            $participantsStatement = $this->db->prepare(
                'SELECT player_id FROM participants WHERE season_id = :season_id FOR UPDATE'
            );
            $participantsStatement->execute(['season_id' => $seasonId]);
            $currentParticipantIds = array_fill_keys(
                array_map('intval', $participantsStatement->fetchAll(PDO::FETCH_COLUMN)),
                true,
            );

            $playersStatement = $this->db->query(<<<'SQL'
                SELECT id, name, display_name, nickname, active
                FROM players
                ORDER BY id
                FOR UPDATE
            SQL);
            $players = [];
            foreach ($playersStatement->fetchAll() as $player) {
                $players[(int) $player['id']] = $player;
            }

            $seenIds = [];
            $temporaryActivations = [];
            $insert = $this->db->prepare(<<<'SQL'
                INSERT INTO players (name, display_name, nickname, active)
                VALUES (:name, :display_name, :nickname, :active)
            SQL);
            $update = $this->db->prepare(<<<'SQL'
                UPDATE players
                SET name = :name, display_name = :display_name,
                    nickname = :nickname, active = :active
                WHERE id = :id
            SQL);

            foreach ($changes as $change) {
                if (!is_array($change)) {
                    throw new ApiException('Uma das alterações de jogador é inválida.');
                }
                $informedId = filter_var($change['id'] ?? null, FILTER_VALIDATE_INT);
                $isNew = !$informedId;
                $id = $isNew ? null : (int) $informedId;
                if (!$isNew && (isset($seenIds[$id]) || !isset($players[$id]))) {
                    throw new ApiException(
                        isset($seenIds[$id])
                            ? 'Um jogador foi informado mais de uma vez.'
                            : "Jogador nº {$id} não encontrado.",
                        isset($players[$id]) ? 400 : 404,
                    );
                }

                $name = trim((string) ($change['nome'] ?? ''));
                $displayName = trim((string) ($change['exibicao'] ?? $name));
                $nickname = trim((string) ($change['apelido'] ?? $displayName));
                if ($name === '' || $displayName === '' || $nickname === '') {
                    throw new ApiException(
                        'Nome, nome de exibição e apelido são obrigatórios.'
                    );
                }
                if (mb_strlen($name) > 80 || mb_strlen($displayName) > 80 ||
                    mb_strlen($nickname) > 80) {
                    throw new ApiException(
                        'Os campos do jogador devem possuir no máximo 80 caracteres.'
                    );
                }

                $requestedActive = ($change['ativo'] ?? false) === true ||
                    strtoupper(trim((string) ($change['ativo'] ?? ''))) === 'S';
                if (!$isNew && !$requestedActive && isset($currentParticipantIds[$id])) {
                    throw new ApiException(
                        "O jogador {$displayName} participa da temporada atual e não pode ser inativado."
                    );
                }
                $persistedActive = !$isNew && $requestedActive &&
                    isset($currentParticipantIds[$id]);

                if ($isNew) {
                    $insert->execute([
                        'name' => $name,
                        'display_name' => $displayName,
                        'nickname' => $nickname,
                        'active' => 0,
                    ]);
                    $id = (int) $this->db->lastInsertId();
                    $before = null;
                } else {
                    $before = $this->playerAuditState($players[$id]);
                    $update->execute([
                        'name' => $name,
                        'display_name' => $displayName,
                        'nickname' => $nickname,
                        'active' => $persistedActive ? 1 : 0,
                        'id' => $id,
                    ]);
                    $seenIds[$id] = true;
                }

                if ($requestedActive && !$persistedActive) {
                    $temporaryActivations[] = $id;
                }
                $after = [
                    'id' => $id,
                    'nome' => $name,
                    'exibicao' => $displayName,
                    'apelido' => $nickname,
                    'ativo' => $persistedActive,
                ];
                $this->audit(
                    (int) $administrator['administrator_id'],
                    $isNew ? 'cadastrar_jogador' : 'salvar_jogador',
                    'jogador',
                    (string) $id,
                    $before,
                    $after,
                );
            }

            $this->bumpDataVersion();
            $this->db->commit();
            return [
                'sucesso' => true,
                'ativacoes_temporarias' => $temporaryActivations,
                ...$this->players($token),
            ];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function saveMatch(string $token, array $match): array
    {
        $result = $this->saveMatches($token, [$match]);
        return $result['partidas'][0];
    }

    public function saveMatches(string $token, array $matches): array
    {
        $administrator = $this->auth->administrator($token);
        if ($matches === []) {
            throw new ApiException('Nenhuma partida foi informada.');
        }

        $this->db->beginTransaction();
        try {
            $results = [];
            foreach ($matches as $match) {
                if (!is_array($match)) {
                    throw new ApiException('Uma das partidas está inválida ou incompleta.');
                }
                $results[] = $this->persistMatch($administrator, $match);
            }
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, 'partidas' => $results];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function saveRoundDate(string $token, array $round): array
    {
        $result = $this->saveRoundDates($token, [$round]);
        return $result['rodadas'][0];
    }

    public function saveRoundDates(string $token, array $rounds): array
    {
        $administrator = $this->auth->administrator($token);
        if ($rounds === []) {
            throw new ApiException('Nenhuma data de rodada foi informada.');
        }

        $this->db->beginTransaction();
        try {
            $results = [];
            foreach ($rounds as $round) {
                if (!is_array($round)) {
                    throw new ApiException('Uma das rodadas está inválida ou incompleta.');
                }
                $results[] = $this->persistRoundDate($administrator, $round);
            }
            $this->bumpDataVersion();
            $this->db->commit();
            return ['sucesso' => true, 'rodadas' => $results];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function persistMatch(array $administrator, array $data): array
    {
        $division = $this->division((string) ($data['divisao'] ?? ''));
        $roundNumber = filter_var($data['rodada'] ?? null, FILTER_VALIDATE_INT);
        $number1 = filter_var($data['numero1'] ?? null, FILTER_VALIDATE_INT);
        $number2 = filter_var($data['numero2'] ?? null, FILTER_VALIDATE_INT);
        if (!$roundNumber || !$number1 || !$number2 || $number1 === $number2) {
            throw new ApiException('Partida inválida ou incompleta.');
        }

        $statement = $this->db->prepare(<<<'SQL'
            SELECT m.id, m.status, m.score1, m.score2, m.notes, m.row_version,
                   p1.number AS number1, p2.number AS number2,
                   j1.display_name AS player1_name, j2.display_name AS player2_name
            FROM matches m
            JOIN rounds r ON r.id = m.round_id
            JOIN seasons s ON s.id = r.season_id
            JOIN participants p1 ON p1.id = m.participant1_id
            JOIN players j1 ON j1.id = p1.player_id
            JOIN participants p2 ON p2.id = m.participant2_id
            JOIN players j2 ON j2.id = p2.player_id
            WHERE s.year = :year AND s.status = 'ATIVA'
              AND r.division = :division AND r.number = :round_number
              AND p1.number = :number1 AND p2.number = :number2
            LIMIT 1
            FOR UPDATE
        SQL);
        $statement->execute([
            'year' => $this->public->currentSeason(),
            'division' => $division,
            'round_number' => $roundNumber,
            'number1' => $number1,
            'number2' => $number2,
        ]);
        $current = $statement->fetch();
        if (!$current) {
            throw new ApiException('Partida não encontrada.', 404);
        }

        $state = $this->matchState($data, $current);
        $update = $this->db->prepare(<<<'SQL'
            UPDATE matches
            SET status = :status, score1 = :score1, score2 = :score2,
                notes = :notes, row_version = row_version + 1
            WHERE id = :id
        SQL);
        $update->execute([
            'status' => $state['status'],
            'score1' => $state['placar1'],
            'score2' => $state['placar2'],
            'notes' => $state['observacao'],
            'id' => $current['id'],
        ]);
        $after = [
            'status' => $state['status'],
            'placar1' => $state['placar1'] ?? '-',
            'placar2' => $state['placar2'] ?? '-',
            'observacao' => $state['observacao'],
            'versao' => (int) $current['row_version'] + 1,
        ];
        $this->audit(
            (int) $administrator['administrator_id'],
            'salvar_partida',
            'partida',
            (string) $current['id'],
            [
                'status' => $current['status'],
                'placar1' => $current['score1'],
                'placar2' => $current['score2'],
                'observacao' => $current['notes'],
                'versao' => (int) $current['row_version'],
            ],
            [
                'status' => $state['status'],
                'placar1' => $state['placar1'],
                'placar2' => $state['placar2'],
                'observacao' => $state['observacao'],
                'versao' => (int) $current['row_version'] + 1,
            ],
        );

        return [
            'divisao' => $division,
            'rodada' => (int) $roundNumber,
            'numero1' => (int) $number1,
            'numero2' => (int) $number2,
            'sucesso' => true,
            ...$after,
        ];
    }

    private function matchState(array $data, array $current): array
    {
        $bothWalkover = filter_var($data['wo_ambos'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($bothWalkover) {
            return [
                'status' => 'E',
                'placar1' => 0,
                'placar2' => 0,
                'observacao' => 'W.O.: ambos abandonaram a competição',
            ];
        }

        $walkoverLoser = filter_var($data['wo_perdedor'] ?? null, FILTER_VALIDATE_INT);
        if ($walkoverLoser) {
            if (!in_array($walkoverLoser, [(int) $current['number1'], (int) $current['number2']], true)) {
                throw new ApiException('O jogador indicado para o W.O. não pertence à partida.');
            }
            $loserName = $walkoverLoser === (int) $current['number1']
                ? $current['player1_name'] : $current['player2_name'];
            return [
                'status' => 'E',
                'placar1' => $walkoverLoser === (int) $current['number1'] ? 0 : 2,
                'placar2' => $walkoverLoser === (int) $current['number2'] ? 0 : 2,
                'observacao' => "W.O.: {$loserName}",
            ];
        }

        $status = strtoupper(trim((string) ($data['status'] ?? '')));
        if (!in_array($status, ['A', 'V', 'E'], true)) {
            throw new ApiException('Selecione um status válido para a partida.');
        }
        $score1 = $this->score($data['placar1'] ?? null);
        $score2 = $this->score($data['placar2'] ?? null);
        if ($status === 'A') {
            if ($score1 !== null || $score2 !== null) {
                throw new ApiException('Partida agendada não pode possuir placar.');
            }
        } elseif ($score1 === null || $score2 === null) {
            throw new ApiException('Informe os dois placares para uma partida ao vivo ou encerrada.');
        }
        if ($score1 === 2 || $score2 === 2) {
            $status = 'E';
        }
        if ($status === 'V' && ($score1 > 1 || $score2 > 1)) {
            throw new ApiException('Partida ao vivo aceita somente placares até 1 ponto.');
        }
        if ($status === 'E') {
            $winners = (int) ($score1 === 2) + (int) ($score2 === 2);
            if ($winners !== 1 || $score1 === $score2) {
                throw new ApiException('Partida encerrada exige exatamente um jogador com 2 pontos.');
            }
        }
        $notes = trim((string) ($data['observacao'] ?? ''));
        if (mb_strlen($notes) > 300) {
            throw new ApiException('A observação da partida deve possuir no máximo 300 caracteres.');
        }
        return [
            'status' => $status,
            'placar1' => $score1,
            'placar2' => $score2,
            'observacao' => $notes,
        ];
    }

    private function persistRoundDate(array $administrator, array $data): array
    {
        $division = $this->division((string) ($data['divisao'] ?? ''));
        $roundNumber = filter_var($data['rodada'] ?? null, FILTER_VALIDATE_INT);
        $date = trim((string) ($data['data'] ?? ''));
        $dateObject = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$roundNumber || !$dateObject || $dateObject->format('Y-m-d') !== $date) {
            throw new ApiException('Informe uma data válida para a rodada.');
        }

        $statement = $this->db->prepare(<<<'SQL'
            SELECT r.id, r.scheduled_date
            FROM rounds r
            JOIN seasons s ON s.id = r.season_id
            WHERE s.year = :year AND s.status = 'ATIVA'
              AND r.division = :division AND r.number = :round_number
            LIMIT 1
            FOR UPDATE
        SQL);
        $statement->execute([
            'year' => $this->public->currentSeason(),
            'division' => $division,
            'round_number' => $roundNumber,
        ]);
        $current = $statement->fetch();
        if (!$current) {
            throw new ApiException('Rodada não encontrada.', 404);
        }
        $updateRound = $this->db->prepare(
            'UPDATE rounds SET scheduled_date = :scheduled_date WHERE id = :id'
        );
        $updateRound->execute(['scheduled_date' => $date, 'id' => $current['id']]);
        $updateMatches = $this->db->prepare(
            'UPDATE matches SET scheduled_date = :scheduled_date, row_version = row_version + 1 WHERE round_id = :round_id'
        );
        $updateMatches->execute(['scheduled_date' => $date, 'round_id' => $current['id']]);
        $this->audit(
            (int) $administrator['administrator_id'],
            'salvar_data_rodada',
            'rodada',
            (string) $current['id'],
            ['data' => $current['scheduled_date']],
            ['data' => $date],
        );
        return [
            'sucesso' => true,
            'divisao' => $division,
            'rodada' => (int) $roundNumber,
            'data' => $date,
        ];
    }

    private function score(mixed $value): ?int
    {
        if ($value === null || $value === '' || $value === '-') {
            return null;
        }
        $score = filter_var($value, FILTER_VALIDATE_INT);
        if ($score === false || $score < 0 || $score > 2) {
            throw new ApiException('O placar deve conter valores inteiros entre 0 e 2.');
        }
        return $score;
    }

    private function tiebreakPriority(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $priority = filter_var($value, FILTER_VALIDATE_INT);
        if ($priority === false || $priority < 1 || $priority > 65535) {
            throw new ApiException(
                'A prioridade de desempate deve ser um número inteiro a partir de 1.'
            );
        }
        return $priority;
    }

    private function participantAuditState(array $participant): array
    {
        return [
            'divisao' => $participant['division'],
            'numero' => (int) $participant['number'],
            'jogador_id' => (int) $participant['player_id'],
            'desempate' => $participant['tiebreak_priority'] === null
                ? null : (int) $participant['tiebreak_priority'],
        ];
    }

    private function playerAuditState(array $player): array
    {
        return [
            'id' => (int) $player['id'],
            'nome' => $player['name'],
            'exibicao' => $player['display_name'],
            'apelido' => $player['nickname'],
            'ativo' => (bool) $player['active'],
        ];
    }

    private function bumpDataVersion(): void
    {
        $this->db->exec(
            "INSERT INTO data_versions (scope_key, version) VALUES ('global', 2) " .
            "ON DUPLICATE KEY UPDATE version = version + 1"
        );
    }

    private function audit(
        int $administratorId,
        string $action,
        string $entityType,
        string $entityId,
        mixed $before,
        mixed $after,
    ): void {
        $statement = $this->db->prepare(<<<'SQL'
            INSERT INTO audit_log
              (administrator_id, action, entity_type, entity_id,
               before_data, after_data, ip_address, user_agent)
            VALUES
              (:administrator_id, :action, :entity_type, :entity_id,
               :before_data, :after_data, :ip_address, :user_agent)
        SQL);
        $statement->execute([
            'administrator_id' => $administratorId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_data' => json_encode($before, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'after_data' => json_encode($after, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'ip_address' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45) ?: null,
            'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500) ?: null,
        ]);
    }

    private function newSeasonYear(mixed $value): int
    {
        $year = filter_var($value, FILTER_VALIDATE_INT);
        $currentYear = $this->public->currentSeason();
        $minimumYear = (int) gmdate('Y');
        if (!$year || $year < $minimumYear || $year <= $currentYear) {
            throw new ApiException(
                "Informe um ano posterior à temporada atual e não inferior a {$minimumYear}."
            );
        }
        return (int) $year;
    }

    private function legacySeasonYear(mixed $value, bool $requireAvailable): int
    {
        $year = filter_var($value, FILTER_VALIDATE_INT);
        $currentYear = $this->public->currentSeason();
        if (!$year || $year < 1900 || $year >= $currentYear) {
            throw new ApiException("Informe um ano anterior à temporada atual ({$currentYear}).");
        }
        if ($requireAvailable) {
            $statement = $this->db->prepare('SELECT 1 FROM seasons WHERE year = :year');
            $statement->execute(['year' => $year]);
            if ($statement->fetchColumn()) {
                throw new ApiException("A temporada {$year} já está cadastrada.");
            }
        }
        return (int) $year;
    }

    private function validateNewSeasonParticipants(array $value): array
    {
        $result = ['A' => [], 'B' => []];
        $allIds = [];
        foreach (['A', 'B'] as $division) {
            $list = isset($value[$division]) && is_array($value[$division])
                ? array_values($value[$division]) : [];
            foreach ($list as $index => $participant) {
                if (!is_array($participant)) {
                    throw new ApiException("A Série {$division} possui um jogador inválido.");
                }
                $playerId = filter_var($participant['jogador_id'] ?? null, FILTER_VALIDATE_INT);
                if (!$playerId) {
                    throw new ApiException("A Série {$division} possui um jogador inválido.");
                }
                $result[$division][] = [
                    'divisao' => $division,
                    'numero' => $index + 1,
                    'jogador_id' => (int) $playerId,
                    'desempate' => $this->tiebreakPriority($participant['desempate'] ?? null),
                ];
                $allIds[] = (int) $playerId;
            }
        }
        if (count($result['A']) !== 20) {
            throw new ApiException('A Série A deve possuir exatamente 20 participantes.');
        }
        if (count($result['B']) < 2) {
            throw new ApiException('A Série B deve possuir pelo menos 2 participantes.');
        }
        if (count(array_unique($allIds)) !== count($allIds)) {
            throw new ApiException('Um jogador não pode participar de duas vagas na mesma temporada.');
        }
        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $players = $this->db->prepare("SELECT id FROM players WHERE id IN ({$placeholders})");
        $players->execute($allIds);
        if (count($players->fetchAll(PDO::FETCH_COLUMN)) !== count($allIds)) {
            throw new ApiException('Uma das séries possui um jogador inválido.');
        }
        return $result;
    }

    private function validateLegacyParticipants(array $value): array
    {
        $result = ['A' => [], 'B' => []];
        $allIds = [];
        foreach (['A', 'B'] as $division) {
            $list = isset($value[$division]) && is_array($value[$division])
                ? array_values($value[$division]) : [];
            foreach ($list as $index => $participant) {
                if (!is_array($participant)) {
                    throw new ApiException("A Série {$division} possui um jogador inválido.");
                }
                $playerId = filter_var($participant['jogador_id'] ?? null, FILTER_VALIDATE_INT);
                if (!$playerId) {
                    throw new ApiException("A Série {$division} possui um jogador inválido.");
                }
                $result[$division][] = [
                    'divisao' => $division,
                    'numero' => $index + 1,
                    'jogador_id' => (int) $playerId,
                    'desempate' => $this->tiebreakPriority($participant['desempate'] ?? null),
                ];
                $allIds[] = (int) $playerId;
            }
        }
        if (count($result['A']) < 2) {
            throw new ApiException('A Série A deve possuir pelo menos 2 participantes.');
        }
        if (count($result['B']) === 1) {
            throw new ApiException('Quando informada, a Série B deve possuir pelo menos 2 participantes.');
        }
        if (count(array_unique($allIds)) !== count($allIds)) {
            throw new ApiException('Um jogador não pode participar de duas vagas na mesma temporada.');
        }
        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $players = $this->db->prepare("SELECT id FROM players WHERE id IN ({$placeholders})");
        $players->execute($allIds);
        if (count($players->fetchAll(PDO::FETCH_COLUMN)) !== count($allIds)) {
            throw new ApiException('Uma das séries possui um jogador inválido.');
        }
        return $result;
    }

    private function applyLegacyResults(array $rounds, array $informedRounds): array
    {
        foreach (['A', 'B'] as $division) {
            foreach ($rounds[$division] as $roundIndex => &$round) {
                foreach ($round['partidas'] as $matchIndex => &$match) {
                    $informed = $informedRounds[$division][$roundIndex]['partidas'][$matchIndex] ?? [];
                    $match['status'] = 'E';
                    $match['placar1'] = $this->legacyScore($informed['placar1'] ?? '-');
                    $match['placar2'] = $this->legacyScore($informed['placar2'] ?? '-');
                    $notes = trim((string) ($informed['observacao'] ?? ''));
                    if (mb_strlen($notes) > 300) {
                        throw new ApiException(
                            'A observação da partida deve possuir no máximo 300 caracteres.'
                        );
                    }
                    $match['observacao'] = $notes;
                }
                unset($match);
            }
            unset($round);
        }
        return $rounds;
    }

    private function legacyScore(mixed $value): ?int
    {
        if ($value === null || $value === '' || $value === '-') {
            return null;
        }
        $score = filter_var($value, FILTER_VALIDATE_INT);
        if ($score === false || $score < 0 || $score > 2) {
            throw new ApiException('Uma partida histórica possui um placar inválido.');
        }
        return (int) $score;
    }

    private function validateSeasonSchedule(
        array $value,
        array $participants,
        bool $requireNumberedBye,
    ): array {
        $result = ['A' => [], 'B' => []];
        foreach (['A', 'B'] as $division) {
            $totalParticipants = count($participants[$division]);
            $informed = isset($value[$division]) && is_array($value[$division])
                ? array_values($value[$division]) : [];
            if ($informed === []) {
                $result[$division] = $this->roundRobinSchedule($totalParticipants, $division);
                continue;
            }
            $expectedRounds = $totalParticipants % 2 === 0
                ? $totalParticipants - 1 : $totalParticipants;
            if (count($informed) !== $expectedRounds) {
                throw new ApiException(
                    "A Série {$division} deve possuir {$expectedRounds} rodadas regulares numeradas em sequência."
                );
            }
            $confrontations = [];
            foreach ($informed as $roundIndex => $round) {
                if (!is_array($round)) {
                    throw new ApiException("O chaveamento da Série {$division} contém uma rodada inválida.");
                }
                $roundNumber = $roundIndex + 1;
                $matches = isset($round['partidas']) && is_array($round['partidas'])
                    ? array_values($round['partidas']) : [];
                $expectedMatches = intdiv($totalParticipants, 2);
                if (count($matches) !== $expectedMatches) {
                    throw new ApiException(
                        "A rodada {$roundNumber} da Série {$division} não contém todas as partidas necessárias."
                    );
                }
                $used = [];
                $normalizedMatches = [];
                foreach ($matches as $match) {
                    if (!is_array($match)) {
                        throw new ApiException("O chaveamento da Série {$division} contém uma partida inválida.");
                    }
                    $number1 = filter_var($match['numero1'] ?? null, FILTER_VALIDATE_INT);
                    $number2 = filter_var($match['numero2'] ?? null, FILTER_VALIDATE_INT);
                    if (!$number1 || !$number2 || $number1 === $number2 ||
                        $number1 > $totalParticipants || $number2 > $totalParticipants) {
                        throw new ApiException("O chaveamento da Série {$division} contém uma partida inválida.");
                    }
                    if (isset($used[$number1]) || isset($used[$number2])) {
                        throw new ApiException(
                            "Um participante da Série {$division} aparece duas vezes na mesma rodada."
                        );
                    }
                    $used[$number1] = true;
                    $used[$number2] = true;
                    $key = min($number1, $number2) . '-' . max($number1, $number2);
                    if (isset($confrontations[$key])) {
                        throw new ApiException("O confronto {$key} está duplicado na Série {$division}.");
                    }
                    $confrontations[$key] = true;
                    $normalizedMatches[] = [
                        'numero1' => (int) $number1,
                        'numero2' => (int) $number2,
                        'data' => $this->draftDate($match['data'] ?? ''),
                        'hora' => $this->draftTime($match['hora'] ?? '19:00'),
                        'status' => 'A',
                        'placar1' => null,
                        'placar2' => null,
                        'observacao' => '',
                    ];
                }
                $bye = null;
                if ($totalParticipants % 2 === 1) {
                    for ($number = 1; $number <= $totalParticipants; $number++) {
                        if (!isset($used[$number])) {
                            $bye = $number;
                            break;
                        }
                    }
                    if ($requireNumberedBye && $division === 'B' && $bye !== $roundNumber) {
                        throw new ApiException(
                            'Na Série B ímpar, a rodada N deve dar folga exclusivamente ao participante nº N.'
                        );
                    }
                }
                $result[$division][] = [
                    'rodada' => $roundNumber,
                    'tipo' => 'REGULAR',
                    'folga' => $bye,
                    'partidas' => $normalizedMatches,
                ];
            }
            $expectedConfrontations = intdiv(
                $totalParticipants * ($totalParticipants - 1),
                2,
            );
            if (count($confrontations) !== $expectedConfrontations) {
                throw new ApiException(
                    "O chaveamento da Série {$division} não contém todos os confrontos necessários."
                );
            }
        }
        return $result;
    }

    private function draftDate(mixed $value): ?string
    {
        $date = trim((string) $value);
        if ($date === '') {
            return null;
        }
        $object = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$object || $object->format('Y-m-d') !== $date) {
            throw new ApiException('Uma das partidas possui uma data inválida.');
        }
        return $date;
    }

    private function draftTime(mixed $value): string
    {
        $time = trim((string) $value) ?: '19:00';
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
            throw new ApiException('Uma das partidas possui um horário inválido.');
        }
        return $time;
    }

    private function clearSeasonContent(int $seasonId): void
    {
        foreach (['rounds', 'participants', 'season_divisions'] as $table) {
            $statement = $this->db->prepare("DELETE FROM {$table} WHERE season_id = :season_id");
            $statement->execute(['season_id' => $seasonId]);
        }
    }

    private function persistSeasonContent(
        int $seasonId,
        array $participants,
        array $rounds,
        bool $preserveResults,
    ): void {
        $insertDivision = $this->db->prepare(
            'INSERT INTO season_divisions (season_id, division) VALUES (:season_id, :division)'
        );
        $insertParticipant = $this->db->prepare(<<<'SQL'
            INSERT INTO participants
              (season_id, division, number, player_id, tiebreak_priority)
            VALUES
              (:season_id, :division, :number, :player_id, :tiebreak_priority)
        SQL);
        $participantIds = ['A' => [], 'B' => []];
        foreach (['A', 'B'] as $division) {
            if ($participants[$division] === []) {
                continue;
            }
            $insertDivision->execute(['season_id' => $seasonId, 'division' => $division]);
            foreach ($participants[$division] as $participant) {
                $insertParticipant->execute([
                    'season_id' => $seasonId,
                    'division' => $division,
                    'number' => $participant['numero'],
                    'player_id' => $participant['jogador_id'],
                    'tiebreak_priority' => $participant['desempate'],
                ]);
                $participantIds[$division][$participant['numero']] =
                    (int) $this->db->lastInsertId();
            }
        }

        $insertRound = $this->db->prepare(<<<'SQL'
            INSERT INTO rounds
              (season_id, division, number, type, scheduled_date,
               scheduled_time, bye_participant_id)
            VALUES
              (:season_id, :division, :number, :type, :scheduled_date,
               :scheduled_time, :bye_participant_id)
        SQL);
        $insertMatch = $this->db->prepare(<<<'SQL'
            INSERT INTO matches
              (round_id, match_order, participant1_id, participant2_id,
               scheduled_date, scheduled_time, status, score1, score2, notes)
            VALUES
              (:round_id, :match_order, :participant1_id, :participant2_id,
               :scheduled_date, :scheduled_time, :status, :score1, :score2, :notes)
        SQL);
        foreach (['A', 'B'] as $division) {
            foreach ($rounds[$division] as $round) {
                $firstMatch = $round['partidas'][0] ?? null;
                $insertRound->execute([
                    'season_id' => $seasonId,
                    'division' => $division,
                    'number' => $round['rodada'],
                    'type' => $round['tipo'],
                    'scheduled_date' => $firstMatch['data'] ?? null,
                    'scheduled_time' => $firstMatch['hora'] ?? '19:00',
                    'bye_participant_id' => $round['folga'] === null
                        ? null : $participantIds[$division][$round['folga']],
                ]);
                $roundId = (int) $this->db->lastInsertId();
                foreach ($round['partidas'] as $index => $match) {
                    $insertMatch->execute([
                        'round_id' => $roundId,
                        'match_order' => $index + 1,
                        'participant1_id' => $participantIds[$division][$match['numero1']],
                        'participant2_id' => $participantIds[$division][$match['numero2']],
                        'scheduled_date' => $match['data'],
                        'scheduled_time' => $match['hora'],
                        'status' => $preserveResults ? $match['status'] : 'A',
                        'score1' => $preserveResults ? $match['placar1'] : null,
                        'score2' => $preserveResults ? $match['placar2'] : null,
                        'notes' => $preserveResults ? $match['observacao'] : '',
                    ]);
                }
            }
        }
    }

    private function suggestedParticipants(array $classification, string $division): array
    {
        return array_map(
            fn ($player, $index) => [
                'temporada' => null,
                'versao' => 1,
                'divisao' => $division,
                'numero' => $index + 1,
                'jogador_id' => (int) $player['jogador_id'],
                'desempate' => null,
            ],
            $classification,
            array_keys($classification),
        );
    }

    private function participantCount(int $year, string $division): int
    {
        $statement = $this->db->prepare(<<<'SQL'
            SELECT COUNT(*)
            FROM participants p
            JOIN seasons s ON s.id = p.season_id
            WHERE s.year = :year AND p.division = :division
        SQL);
        $statement->execute(['year' => $year, 'division' => $division]);
        return (int) $statement->fetchColumn();
    }

    private function copyCurrentSchedule(string $division, int $totalParticipants): array
    {
        $current = $this->public->rounds($division, null);
        $expectedRounds = $totalParticipants % 2 === 0
            ? $totalParticipants - 1 : $totalParticipants;
        $rounds = [];
        foreach (array_slice($current, 0, $expectedRounds) as $round) {
            $matches = array_map(fn ($match) => [
                'numero1' => (int) $match['jogador1']['numero'],
                'numero2' => (int) $match['jogador2']['numero'],
                'data' => '',
                'hora' => '19:00',
            ], $round['partidas']);
            $used = [];
            foreach ($matches as $match) {
                $used[$match['numero1']] = true;
                $used[$match['numero2']] = true;
            }
            $bye = null;
            if ($totalParticipants % 2 === 1) {
                for ($number = 1; $number <= $totalParticipants; $number++) {
                    if (!isset($used[$number])) {
                        $bye = $number;
                        break;
                    }
                }
            }
            $rounds[] = [
                'rodada' => count($rounds) + 1,
                'tipo' => 'REGULAR',
                'folga' => $bye,
                'partidas' => $matches,
            ];
        }
        if (count($rounds) !== $expectedRounds) {
            return $this->roundRobinSchedule($totalParticipants, $division);
        }
        return $division === 'B' && $totalParticipants % 2 === 1
            ? $this->orderRoundsByBye($rounds, $totalParticipants)
            : $rounds;
    }

    private function roundRobinSchedule(int $totalParticipants, string $division): array
    {
        if ($totalParticipants < 2) {
            return [];
        }
        $numbers = range(1, $totalParticipants);
        $rotation = $totalParticipants % 2 === 0 ? $numbers : [...$numbers, null];
        $totalRounds = count($rotation) - 1;
        $rounds = [];
        for ($roundIndex = 0; $roundIndex < $totalRounds; $roundIndex++) {
            $matches = [];
            for ($index = 0; $index < count($rotation) / 2; $index++) {
                $number1 = $rotation[$index];
                $number2 = $rotation[count($rotation) - 1 - $index];
                if ($number1 === null || $number2 === null) {
                    continue;
                }
                if (($roundIndex + $index) % 2 === 1) {
                    [$number1, $number2] = [$number2, $number1];
                }
                $matches[] = [
                    'numero1' => $number1,
                    'numero2' => $number2,
                    'data' => '',
                    'hora' => '19:00',
                ];
            }
            $used = [];
            foreach ($matches as $match) {
                $used[$match['numero1']] = true;
                $used[$match['numero2']] = true;
            }
            $bye = null;
            foreach ($numbers as $number) {
                if (!isset($used[$number])) {
                    $bye = $number;
                    break;
                }
            }
            $rounds[] = [
                'rodada' => $roundIndex + 1,
                'tipo' => 'REGULAR',
                'folga' => $bye,
                'partidas' => $matches,
            ];
            $last = array_pop($rotation);
            array_splice($rotation, 1, 0, [$last]);
        }
        return $division === 'B' && $totalParticipants % 2 === 1
            ? $this->orderRoundsByBye($rounds, $totalParticipants)
            : $rounds;
    }

    private function orderRoundsByBye(array $rounds, int $totalParticipants): array
    {
        $byBye = [];
        foreach ($rounds as $round) {
            $byBye[(int) $round['folga']] = $round;
        }
        $ordered = [];
        for ($number = 1; $number <= $totalParticipants; $number++) {
            if (!isset($byBye[$number])) {
                throw new ApiException('Não foi possível organizar as folgas da Série B.');
            }
            $round = $byBye[$number];
            $round['rodada'] = $number;
            $round['folga'] = $number;
            $ordered[] = $round;
        }
        return $ordered;
    }

    private function draftSchedule(int $seasonId): array
    {
        $statement = $this->db->prepare(<<<'SQL'
            SELECT r.id AS round_id, r.division, r.number AS round_number,
                   r.type, bp.number AS bye_number,
                   m.match_order, p1.number AS number1, p2.number AS number2,
                   DATE_FORMAT(COALESCE(m.scheduled_date, r.scheduled_date), '%Y-%m-%d') AS scheduled_date,
                   TIME_FORMAT(COALESCE(m.scheduled_time, r.scheduled_time), '%H:%i') AS scheduled_time,
                   m.status, m.score1, m.score2, m.notes
            FROM rounds r
            LEFT JOIN participants bp ON bp.id = r.bye_participant_id
            LEFT JOIN matches m ON m.round_id = r.id
            LEFT JOIN participants p1 ON p1.id = m.participant1_id
            LEFT JOIN participants p2 ON p2.id = m.participant2_id
            WHERE r.season_id = :season_id
            ORDER BY r.division, r.number, m.match_order, m.id
        SQL);
        $statement->execute(['season_id' => $seasonId]);
        $result = ['A' => [], 'B' => []];
        $roundIndexes = [];
        foreach ($statement->fetchAll() as $row) {
            $division = $row['division'];
            $key = $division . '-' . (int) $row['round_id'];
            if (!isset($roundIndexes[$key])) {
                $roundIndexes[$key] = count($result[$division]);
                $result[$division][] = [
                    'rodada' => (int) $row['round_number'],
                    'tipo' => $row['type'],
                    'folga' => $row['bye_number'] === null ? null : (int) $row['bye_number'],
                    'partidas' => [],
                ];
            }
            if ($row['number1'] === null || $row['number2'] === null) {
                continue;
            }
            $result[$division][$roundIndexes[$key]]['partidas'][] = [
                'numero1' => (int) $row['number1'],
                'numero2' => (int) $row['number2'],
                'data' => $row['scheduled_date'] ?? '',
                'hora' => $row['scheduled_time'] ?: '19:00',
                'status' => $row['status'],
                'placar1' => $row['score1'] === null ? '-' : (string) $row['score1'],
                'placar2' => $row['score2'] === null ? '-' : (string) $row['score2'],
                'observacao' => $row['notes'] ?? '',
            ];
        }
        return $result;
    }

    private function sortedPlayers(): array
    {
        $players = $this->allPlayers();
        usort($players, fn ($a, $b) => strcasecmp($a['exibicao'], $b['exibicao']));
        return $players;
    }

    private function allPlayers(): array
    {
        return array_map(
            fn ($row) => $this->player($row),
            $this->db->query(<<<'SQL'
                SELECT id AS player_id, name, display_name, nickname, active
                FROM players
                ORDER BY display_name
            SQL)->fetchAll(),
        );
    }

    private function player(array $row): array
    {
        return [
            'id' => (int) $row['player_id'],
            'nome' => $row['name'],
            'exibicao' => $row['display_name'] ?: $row['name'],
            'apelido' => $row['nickname'] ?: ($row['display_name'] ?: $row['name']),
            'ativo' => (bool) $row['active'],
        ];
    }

    private function seasonId(int $year): int
    {
        $statement = $this->db->prepare('SELECT id FROM seasons WHERE year = :year LIMIT 1');
        $statement->execute(['year' => $year]);
        $id = $statement->fetchColumn();
        if ($id === false) {
            throw new ApiException('Temporada não encontrada.', 404);
        }
        return (int) $id;
    }

    private function division(string $division): string
    {
        $division = strtoupper(trim($division));
        if (!in_array($division, ['A', 'B'], true)) {
            throw new ApiException('Divisão inválida.');
        }
        return $division;
    }
}
