<?php

declare(strict_types=1);

namespace AecSinuca;

final class GoogleTokenVerifier
{
    public function __construct(private readonly string $clientId)
    {
    }

    public function verify(string $credential): array
    {
        if ($credential === '') {
            throw new ApiException('Credencial Google não informada.', 401);
        }
        if (!function_exists('curl_init')) {
            throw new ApiException('A extensão cURL não está disponível no servidor.', 503);
        }

        $curl = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($credential));
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);

        if ($body === false || $status !== 200) {
            $message = $curlError !== '' ? " ({$curlError})" : '';
            throw new ApiException("Não foi possível validar a conta Google.{$message}", 401);
        }

        $identity = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        $issuers = ['accounts.google.com', 'https://accounts.google.com'];
        $verified = $identity['email_verified'] ?? false;
        if (
            !in_array($identity['iss'] ?? '', $issuers, true) ||
            !hash_equals($this->clientId, (string) ($identity['aud'] ?? '')) ||
            !in_array($verified, [true, 'true', 1, '1'], true) ||
            empty($identity['sub']) ||
            empty($identity['email']) ||
            (int) ($identity['exp'] ?? 0) <= time()
        ) {
            throw new ApiException('Credencial Google inválida ou expirada.', 401);
        }

        return [
            'sub' => (string) $identity['sub'],
            'email' => strtolower(trim((string) $identity['email'])),
            'name' => trim((string) ($identity['name'] ?? $identity['email'])),
            'picture' => trim((string) ($identity['picture'] ?? '')),
        ];
    }
}

