<?php
declare(strict_types=1);

require __DIR__ . '/../api/config.php';

if (getenv('CAMY_ENV') === 'production') {
    fwrite(STDERR, "Refusing to run the local database setup while CAMY_ENV=production.\n");
    exit(1);
}

$reset = in_array('--reset', $argv, true);

try {
    if ($reset) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', DB_NAME)) {
            throw new RuntimeException('Invalid database name.');
        }
        $server = new PDO(
            'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $server->exec('DROP DATABASE IF EXISTS `' . DB_NAME . '`');
        fwrite(STDOUT, "Removed old local database: " . DB_NAME . "\n");
    }

    $pdo = database();
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);

    fwrite(STDOUT, "Database ready: " . DB_NAME . "\n");
    fwrite(STDOUT, "Schema applied successfully. Tables: " . count($tables) . "\n");

    $credentials = __DIR__ . '/../private/bootstrap-credentials.txt';
    if (is_file($credentials)) {
        fwrite(STDOUT, "Bootstrap admin credentials: private/bootstrap-credentials.txt\n");
    } else {
        fwrite(STDOUT, "Existing administrator account retained.\n");
    }
} catch (Throwable $error) {
    fwrite(STDERR, "Database setup failed: " . $error->getMessage() . "\n");
    fwrite(STDERR, "Make sure MySQL is running in XAMPP and that local root access uses the configured credentials.\n");
    exit(1);
}
