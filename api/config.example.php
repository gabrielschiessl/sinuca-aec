<?php

declare(strict_types=1);

return [
    'environment' => 'production',
    'debug' => false,
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'SEU_BANCO',
        'user' => 'SEU_USUARIO',
        'password' => 'SUA_SENHA',
        'charset' => 'utf8mb4',
    ],
    'google_client_id' => 'SEU_CLIENT_ID.apps.googleusercontent.com',
    'admin_emails' => [
        'administrador@exemplo.com',
    ],
    'session_duration_seconds' => 60 * 60 * 24 * 30,
];
