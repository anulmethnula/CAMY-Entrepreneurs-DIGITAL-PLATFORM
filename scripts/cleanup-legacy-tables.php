<?php

declare(strict_types=1);

require __DIR__ . '/../api/config.php';

const LEGACY_TABLES = [
    'customer_addresses',
    'customer_checkout_requests',
    'customer_favourites',
    'customer_reviews',
    'customers',
    'order_items',
    'orders',
    'settlements',
    'exit_requests',
];

const MIGRATION_KEY = 'schema.retired_table_cleanup_20260928';

function quoteIdentifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function findExistingLegacyTables(PDO $pdo): array
{
    $placeholders = implode(', ', array_fill(0, count(LEGACY_TABLES), '?'));
    $statement = $pdo->prepare(
        "SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME IN ($placeholders)"
    );

    $statement->execute([DB_NAME, ...LEGACY_TABLES]);

    return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
}

function tableRowCount(PDO $pdo, string $table): int
{
    return (int) $pdo
        ->query('SELECT COUNT(*) FROM ' . quoteIdentifier($table))
        ->fetchColumn();
}

function buildTableBackup(PDO $pdo, string $table): string
{
    $quotedTable = quoteIdentifier($table);
    $createRow = $pdo->query("SHOW CREATE TABLE $quotedTable")->fetch(PDO::FETCH_NUM);

    if (!is_array($createRow) || !isset($createRow[1])) {
        throw new RuntimeException("Unable to read the schema for $table.");
    }

    $sql = "DROP TABLE IF EXISTS $quotedTable;\n";
    $sql .= $createRow[1] . ";\n\n";

    $rows = $pdo->query("SELECT * FROM $quotedTable");

    while ($row = $rows->fetch(PDO::FETCH_ASSOC)) {
        $columns = array_map(
            static fn (string $column): string => quoteIdentifier($column),
            array_keys($row)
        );
        $values = array_map(
            static fn (mixed $value): string => $value === null ? 'NULL' : $pdo->quote((string) $value),
            array_values($row)
        );

        $sql .= "INSERT INTO $quotedTable (" . implode(', ', $columns) . ") VALUES (";
        $sql .= implode(', ', $values) . ");\n";
    }

    return $sql . "\n";
}

function writeBackup(PDO $pdo, array $tables): string
{
    $backupDirectory = __DIR__ . '/../private/database-backups';

    if (!is_dir($backupDirectory) && !mkdir($backupDirectory, 0700, true) && !is_dir($backupDirectory)) {
        throw new RuntimeException('Unable to create the private database backup directory.');
    }

    $backupPath = $backupDirectory . '/legacy-tables-' . date('Ymd-His') . '.sql';
    $sql = "-- CAMY legacy-table backup\n";
    $sql .= '-- Database: ' . DB_NAME . "\n";
    $sql .= '-- Created: ' . date(DATE_ATOM) . "\n\n";
    $sql .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

    foreach ($tables as $table) {
        $sql .= buildTableBackup($pdo, $table);
    }

    $sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";

    if (file_put_contents($backupPath, $sql, LOCK_EX) === false || filesize($backupPath) === 0) {
        throw new RuntimeException('The legacy-table backup could not be written safely.');
    }

    return $backupPath;
}

function recordMigration(PDO $pdo, array $removedTables, string $backupPath): void
{
    $value = json_encode(
        [
            'completedAt' => date(DATE_ATOM),
            'removedTables' => $removedTables,
            'backupFile' => basename($backupPath),
        ],
        JSON_THROW_ON_ERROR
    );

    $statement = $pdo->prepare(
        'INSERT INTO platform_settings (setting_key, value_json)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)'
    );
    $statement->execute([MIGRATION_KEY, $value]);
}

try {
    $pdo = database();
    $existingTables = findExistingLegacyTables($pdo);

    if ($existingTables === []) {
        fwrite(STDOUT, "Database is already clean. No legacy tables were found.\n");
        exit(0);
    }

    $rowCounts = [];

    foreach ($existingTables as $table) {
        $rowCounts[$table] = tableRowCount($pdo, $table);
    }

    $backupPath = writeBackup($pdo, $existingTables);
    $tablesWithData = array_filter(
        $rowCounts,
        static fn (int $rowCount): bool => $rowCount > 0
    );

    if ($tablesWithData !== [] && !in_array('--allow-data', $argv, true)) {
        fwrite(STDERR, "Cleanup stopped because legacy tables contain data.\n");
        fwrite(STDERR, 'Backup created: ' . $backupPath . "\n");
        fwrite(STDERR, "Review the backup, then rerun with --allow-data if removal is intentional.\n");
        exit(2);
    }

    foreach (LEGACY_TABLES as $table) {
        if (!in_array($table, $existingTables, true)) {
            continue;
        }

        $pdo->exec('DROP TABLE ' . quoteIdentifier($table));
    }

    recordMigration($pdo, $existingTables, $backupPath);

    fwrite(STDOUT, 'Removed legacy tables: ' . implode(', ', $existingTables) . "\n");
    fwrite(STDOUT, 'Recoverable backup: ' . $backupPath . "\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'Database cleanup failed: ' . $error->getMessage() . "\n");
    exit(1);
}
