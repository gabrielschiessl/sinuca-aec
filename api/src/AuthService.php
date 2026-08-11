<?php

declare(strict_types=1);

namespace AecSinuca;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class AuthService
{
    private readonly GoogleTokenVerifier $google;
    private readonly array $bootstrapEmails;

    public function __construct(
        private readonly PDO $db,
        string $googleClientId,
        array $bootstrapEmails,
        private readonly int $sessionDurationSeconds,
    ) {
        $this->google = new GoogleTokenVerifier($googleClientId);
        $this->bootstrapEmails = array_values(array_filter(array_map(
            fn ($email) => strtolower(trim((string) $email)),
            $bootstrapEmails,
        )));
    }

    public function loginGoogle(string $credential): array
    {
        $identity = $this->google->verify($credential);
        $administrator = $this->findAdministrator($identity['email']);
        if (!$administrator && !in_array($identity['email'], $this->bootstrapEmails, true)) {
            throw new ApiException(
                "A conta autenticada ({$identity['email']}) não possui acesso administrativo.",
                403,
            );
        }

        $this->db->beginTransaction();
        try {
            if (!$administrator) {
                $statement = $this->db->prepare(<<<'SQL'
                    INSERT INTO administrators (google_subject, email, name, picture_url, active)
                    VALUES (:subject, :email, :name, :picture, 1)
                SQL);
                $statement->execute([
                    'subject' => $identity['sub'],
                    'email' => $identity['email'],
                    'name' => $identity['name'],
                    'picture' => $identity['picture'],
                ]);
                $administratorId = (int) $this->db->lastInsertId();
            } else {
                if (!(bool) $administrator['active']) {
                    throw new ApiException('A conta não possui mais acesso administrativo.', 403);
                }
                $administratorId = (int) $administrator['id'];
                $statement = $this->db->prepare(<<<'SQL'
                    UPDATE administrators
                    SET google_subject = :subject, name = :name, picture_url = :picture
                    WHERE id = :id
                SQL);
                $statement->execute([
                    'subject' => $identity['sub'],
                    'name' => $identity['name'],
                    'picture' => $identity['picture'],
                    'id' => $administratorId,
                ]);
            }

            $token = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $token);
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $expiresAt = $now->modify("+{$this->sessionDurationSeconds} seconds");
            $statement = $this->db->prepare(<<<'SQL'
                INSERT INTO admin_sessions
                  (administrator_id, token_hash, expires_at, last_used_at)
                VALUES (:administrator_id, :token_hash, :expires_at, :last_used_at)
            SQL);
            $statement->execute([
                'administrator_id' => $administratorId,
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
                'last_used_at' => $now->format('Y-m-d H:i:s'),
            ]);
            $this->db->commit();

            return [
                'autenticado' => true,
                'token' => $token,
                'administrador' => [
                    'email' => $identity['email'],
                    'nome' => $identity['name'],
                    'foto' => $identity['picture'],
                ],
                'expira_em' => $expiresAt->getTimestamp() * 1000,
            ];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function validate(string $token): array
    {
        $session = $this->session($token);
        $statement = $this->db->prepare(
            'UPDATE admin_sessions SET last_used_at = UTC_TIMESTAMP() WHERE id = :id'
        );
        $statement->execute(['id' => $session['session_id']]);

        return [
            'autenticado' => true,
            'administrador' => [
                'email' => $session['email'],
                'nome' => $session['name'],
                'foto' => $session['picture_url'],
            ],
            'expira_em' => (int) $session['expires_ms'],
        ];
    }

    public function logout(string $token): array
    {
        if ($token !== '') {
            $statement = $this->db->prepare(<<<'SQL'
                UPDATE admin_sessions
                SET revoked_at = UTC_TIMESTAMP()
                WHERE token_hash = :token_hash AND revoked_at IS NULL
            SQL);
            $statement->execute(['token_hash' => hash('sha256', $token)]);
        }
        return ['sucesso' => true];
    }

    public function administrator(string $token): array
    {
        return $this->session($token);
    }

    private function session(string $token): array
    {
        if ($token === '') {
            throw new ApiException('Sessão administrativa não informada.', 401);
        }
        $statement = $this->db->prepare(<<<'SQL'
            SELECT
              s.id AS session_id,
              a.id AS administrator_id,
              a.email,
              a.name,
              a.picture_url,
              UNIX_TIMESTAMP(s.expires_at) * 1000 AS expires_ms
            FROM admin_sessions s
            JOIN administrators a ON a.id = s.administrator_id
            WHERE s.token_hash = :token_hash
              AND s.revoked_at IS NULL
              AND s.expires_at > UTC_TIMESTAMP()
              AND a.active = 1
            LIMIT 1
        SQL);
        $statement->execute(['token_hash' => hash('sha256', $token)]);
        $session = $statement->fetch();
        if (!$session) {
            throw new ApiException('Sessão inválida, expirada ou encerrada.', 401);
        }
        return $session;
    }

    private function findAdministrator(string $email): array|false
    {
        $statement = $this->db->prepare(
            'SELECT id, active FROM administrators WHERE email = :email LIMIT 1'
        );
        $statement->execute(['email' => $email]);
        return $statement->fetch();
    }
}

