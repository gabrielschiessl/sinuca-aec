<?php

declare(strict_types=1);

namespace AecSinuca;

use PDO;
use PDOException;
use Throwable;

final class ScoreboardRoomService
{
    private readonly int $ttl;

    public function __construct(private readonly PDO $db, int $ttl = 86400)
    {
        $this->ttl = max(3600, min(604800, $ttl));
        $this->db->exec("SET time_zone = '+00:00'");
    }

    public function status(): array
    {
        // Falha de forma explícita se o schema necessário não estiver instalado.
        $this->db->query('SELECT control_password_hash, state_version FROM scoreboard_rooms LIMIT 0');
        $this->db->query('SELECT bucket_hash FROM scoreboard_rate_limits LIMIT 0');
        return ['status' => 'online', 'salas_habilitadas' => true, 'banco' => 'mysql', 'validade_segundos' => $this->ttl];
    }

    public function dispatch(string $action, array $input, string $ip): array
    {
        $this->rateLimit('requests:' . $ip, 1200, 60);
        return match ($action) {
            'criar' => $this->create($input, $ip),
            'consultar' => $this->read($input),
            'assumir_controle' => $this->takeControl($input, $ip),
            'atualizar' => $this->write($input, false),
            'encerrar' => $this->write($input, true),
            default => throw new ApiException('Ação de sala inválida.', 404),
        };
    }

    private function create(array $input, string $ip): array
    {
        $this->rateLimit('create:' . $ip, 5, 3600);
        $this->rateLimit('create:global', 100, 3600);
        $password = $this->password($input['senha'] ?? null);
        $state = ScoreboardState::normalize($input['estado'] ?? null);
        $json = $this->json($state);
        $token = bin2hex(random_bytes(32));
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $expires = gmdate('Y-m-d H:i:s', time() + $this->ttl);
        for ($attempt = 0; $attempt < 40; $attempt++) {
            $code = $attempt < 32
                ? sprintf('%06d', random_int(1, 999999))
                : $this->availableCode();
            if ($code === null) {
                throw new ApiException('Todas as salas estão ocupadas. Aguarde uma sala expirar.', 503);
            }
            try {
                $statement = $this->db->prepare('INSERT INTO scoreboard_rooms
                    (room_code, controller_token_hash, control_password_hash, state_json, expires_at)
                    VALUES (?, ?, ?, ?, ?)');
                $statement->execute([$code, hash('sha256', $token), $passwordHash, $json, $expires]);
                return $this->view($this->find($code)) + ['controller_token' => $token, 'controle_ativo' => true];
            } catch (PDOException $error) {
                if (($error->errorInfo[1] ?? null) !== 1062) {
                    throw $error;
                }
                // Atomic claim: never overwrite a live room. Version must not reset,
                // otherwise an old viewer could mistake the new room for cached state.
                if ($this->reuseExpiredCode($code, $token, $passwordHash, $json, $expires)) {
                    return $this->view($this->find($code)) + ['controller_token' => $token, 'controle_ativo' => true];
                }
            }
        }
        throw new ApiException('Não foi possível gerar o código da sala. Tente novamente.', 503);
    }

    private function reuseExpiredCode(string $code, string $token, string $passwordHash, string $json, string $expires): bool
    {
        $reuse = $this->db->prepare('UPDATE scoreboard_rooms SET
            controller_token_hash = ?, control_password_hash = ?, state_json = ?,
            state_version = state_version + 1, last_command_id = NULL, last_command_hash = NULL,
            closed_at = NULL, created_at = UTC_TIMESTAMP(), expires_at = ?
            WHERE room_code = ? AND expires_at <= UTC_TIMESTAMP()');
        $reuse->execute([hash('sha256', $token), $passwordHash, $json, $expires, $code]);
        return $reuse->rowCount() === 1;
    }

    private function availableCode(): ?string
    {
        $expired = $this->db->query("SELECT room_code FROM scoreboard_rooms
            WHERE room_code REGEXP '^[0-9]{6}$' AND room_code <> '000000'
            AND expires_at <= UTC_TIMESTAMP() ORDER BY expires_at LIMIT 1")->fetchColumn();
        if ($expired !== false) return (string) $expired;
        // Rare fallback near capacity: find a gap without generating a million rows.
        $gap = $this->db->query("SELECT LPAD(c.n, 6, '0') FROM
            (SELECT 1 AS n UNION SELECT CAST(room_code AS UNSIGNED) + 1
             FROM scoreboard_rooms WHERE room_code REGEXP '^[0-9]{6}$'
             AND room_code < '999999') c
            LEFT JOIN scoreboard_rooms r ON r.room_code = LPAD(c.n, 6, '0')
            WHERE c.n BETWEEN 1 AND 999999 AND r.id IS NULL ORDER BY c.n LIMIT 1")->fetchColumn();
        return $gap === false ? null : (string) $gap;
    }

    private function read(array $input): array
    {
        $room = $this->find($this->code($input['codigo'] ?? null));
        $this->checkAvailable($room, true);
        $knownVersion = isset($input['versao']) ? ScoreboardState::integer($input['versao'], PHP_INT_MAX) : null;
        $result = $this->view($room);
        $result['alterado'] = $knownVersion !== (int) $room['state_version'];
        if (!$result['alterado']) {
            unset($result['estado']);
        }
        if (isset($input['controller_token'])) {
            $result['controle_ativo'] = $room['closed_at'] === null && $this->owns($room, $input['controller_token']);
        }
        return $result;
    }

    private function takeControl(array $input, string $ip): array
    {
        // Consumir os limites antes da transação: senha incorreta não desfaz a tentativa.
        $this->rateLimit('takeover:' . $ip, 10, 900);
        $this->rateLimit('takeover:global', 300, 900);
        $code = $this->code($input['codigo'] ?? null);
        $this->rateLimit('takeover-room:' . $code, 30, 900);
        $password = $this->password($input['senha'] ?? null);
        // Check outside lock, then recheck identity after lock (code may be reused).
        $room = $this->find($code);
        $this->checkAvailable($room);
        if (!$room['control_password_hash'] || !password_verify($password, $room['control_password_hash'])) {
            throw new ApiException('Senha de controle incorreta.', 403);
        }
        $verifiedHash = $room['control_password_hash'];
        return $this->transaction(function () use ($code, $verifiedHash): array {
            $room = $this->find($code, true);
            $this->checkAvailable($room);
            if (!hash_equals($verifiedHash, (string) $room['control_password_hash'])) {
                throw new ApiException('Esta sala foi renovada. Entre novamente com a senha atual.', 409);
            }
            $token = bin2hex(random_bytes(32));
            $statement = $this->db->prepare('UPDATE scoreboard_rooms SET controller_token_hash = ?,
                state_version = state_version + 1, last_command_id = NULL, last_command_hash = NULL,
                expires_at = ? WHERE id = ?');
            $statement->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s', time() + $this->ttl), $room['id']]);
            return $this->view($this->find($code)) + ['controller_token' => $token, 'controle_ativo' => true];
        });
    }

    private function write(array $input, bool $close): array
    {
        $code = $this->code($input['codigo'] ?? null);
        $version = ScoreboardState::integer($input['versao'] ?? null, PHP_INT_MAX);
        $command = $input['comando_id'] ?? null;
        if (!is_string($command) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $command)) {
            throw new ApiException('Identificador do comando inválido.');
        }
        $command = strtolower($command);
        $state = $close ? null : ScoreboardState::normalize($input['estado'] ?? null);
        $fingerprint = hash('sha256', $this->json([$close ? 'encerrar' : 'atualizar', $version, $state]));
        return $this->transaction(function () use ($input, $code, $version, $command, $state, $close, $fingerprint): array {
            $room = $this->find($code, true);
            // Autorização sempre antes de deduplicação. Token anterior não pode escrever.
            if (!$this->owns($room, $input['controller_token'] ?? null)) {
                throw new ApiException('O controle desta sala foi assumido em outro dispositivo ou a chave é inválida.', 403);
            }
            $this->checkAvailable($room, true);
            if ($room['last_command_id'] === $command) {
                if (!hash_equals((string) $room['last_command_hash'], $fingerprint)) {
                    throw new ApiException('Identificador de comando já utilizado com outro conteúdo.', 409);
                }
                return $this->view($room) + ['repetido' => true];
            }
            $this->checkAvailable($room);
            if ((int) $room['state_version'] !== $version) {
                throw new ApiException('O placar mudou. Consulte a sala antes de tentar novamente.', 409);
            }
            $statement = $this->db->prepare('UPDATE scoreboard_rooms SET state_json = ?,
                state_version = state_version + 1, last_command_id = ?, last_command_hash = ?,
                expires_at = ?, closed_at = ? WHERE id = ?');
            $statement->execute([
                $close ? $room['state_json'] : $this->json($state), $command, $fingerprint,
                gmdate('Y-m-d H:i:s', time() + $this->ttl), $close ? gmdate('Y-m-d H:i:s') : null, $room['id'],
            ]);
            return $this->view($this->find($code)) + ['repetido' => false];
        });
    }

    private function find(string $code, bool $lock = false): array
    {
        $statement = $this->db->prepare('SELECT * FROM scoreboard_rooms WHERE room_code = ?' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$code]);
        $row = $statement->fetch();
        if (!$row) {
            throw new ApiException('Sala não encontrada.', 404);
        }
        return $row;
    }

    private function checkAvailable(array $room, bool $allowClosed = false): void
    {
        if ($room['expires_at'] <= gmdate('Y-m-d H:i:s')) {
            throw new ApiException('Esta sala expirou.', 410);
        }
        if (!$allowClosed && $room['closed_at'] !== null) {
            throw new ApiException('Esta sala foi encerrada.', 410);
        }
    }

    private function owns(array $room, mixed $token): bool
    {
        return is_string($token) && preg_match('/^[0-9a-f]{64}$/D', $token) === 1
            && hash_equals($room['controller_token_hash'], hash('sha256', $token));
    }

    private function view(array $room): array
    {
        return [
            'codigo' => $room['room_code'], 'versao' => (int) $room['state_version'],
            'estado' => json_decode($room['state_json'], true, 512, JSON_THROW_ON_ERROR),
            'expira_em' => $this->iso($room['expires_at']), 'encerrada' => $room['closed_at'] !== null,
        ];
    }

    private function password(mixed $value): string
    {
        if (!is_string($value) || !preg_match('/^[0-9]{4}$/D', $value)) {
            throw new ApiException('A senha deve conter exatamente 4 números.');
        }
        return $value;
    }

    private function code(mixed $value): string
    {
        if (!is_string($value)) {
            throw new ApiException('Código de sala inválido.');
        }
        $value = strtoupper(str_replace(['-', ' '], '', trim($value)));
        // Legacy codes remain readable until expiry; all new codes have six digits.
        if ((!preg_match('/^[0-9]{6}$/D', $value) || $value === '000000')
            && !preg_match('/^[A-HJ-NP-Z2-9]{12}$/D', $value)) {
            throw new ApiException('Código de sala inválido.');
        }
        return $value;
    }

    private function rateLimit(string $key, int $limit, int $seconds): void
    {
        $now = time();
        $start = intdiv($now, $seconds) * $seconds;
        $hash = hash('sha256', $key);
        // Lock por bucket e commit independente das operações de sala.
        $allowed = $this->transaction(function () use ($hash, $start, $seconds, $limit): bool {
            $statement = $this->db->prepare('INSERT INTO scoreboard_rate_limits
                (bucket_hash, window_started_at, attempts, expires_at) VALUES (?, ?, 1, ?)
                ON DUPLICATE KEY UPDATE
                attempts = IF(window_started_at = VALUES(window_started_at), LEAST(attempts + 1, 1000000), 1),
                window_started_at = VALUES(window_started_at), expires_at = VALUES(expires_at)');
            $statement->execute([$hash, $start, gmdate('Y-m-d H:i:s', $start + $seconds)]);
            $query = $this->db->prepare('SELECT attempts FROM scoreboard_rate_limits WHERE bucket_hash = ?');
            $query->execute([$hash]);
            return (int) $query->fetchColumn() <= $limit;
        });
        if (!$allowed) {
            throw new ApiException('Muitas tentativas. Aguarde antes de tentar novamente.', 429);
        }
    }

    private function transaction(callable $action): mixed
    {
        $this->db->beginTransaction();
        try {
            $result = $action();
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function iso(string $date): string
    {
        return str_replace(' ', 'T', $date) . 'Z';
    }
}
