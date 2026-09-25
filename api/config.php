<?php
declare(strict_types=1);

define('DB_HOST',getenv('CAMY_DB_HOST') ?: '127.0.0.1');
define('DB_PORT',(int)(getenv('CAMY_DB_PORT') ?: 3306));
define('DB_NAME',getenv('CAMY_DB_NAME') ?: 'camy_new');
define('DB_USER',getenv('CAMY_DB_USER') ?: 'root');
define('DB_PASS',getenv('CAMY_DB_PASSWORD') ?: '');

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    if(!preg_match('/^[a-zA-Z0-9_]+$/',DB_NAME))throw new RuntimeException('Invalid database name.');
    if(getenv('CAMY_ENV')==='production' && (DB_USER==='root'||DB_PASS===''))throw new RuntimeException('Production requires a dedicated database user and password.');

    $server = new PDO(
        'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $server->exec('USE `' . DB_NAME . '`');
    $pdo = $server;
    initialise_database($pdo);
    return $pdo;
}

function initialise_database(PDO $pdo): void
{
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    if ($schema === false) throw new RuntimeException('Database schema could not be loaded.');
    $pdo->exec($schema);
    if(!$pdo->query("SHOW COLUMNS FROM customers LIKE 'session_version'")->fetch())$pdo->exec('ALTER TABLE customers ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1');
    foreach(['must_change_password'=>'TINYINT(1) NOT NULL DEFAULT 0','session_version'=>'INT UNSIGNED NOT NULL DEFAULT 1','access_role'=>'VARCHAR(40) NULL','permissions_json'=>'TEXT NULL'] as $field=>$definition){
        if(!$pdo->query("SHOW COLUMNS FROM users LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE users ADD COLUMN $field $definition");
    }
    foreach(['products'=>['record_json'=>'LONGTEXT NULL'],'stock_supply_requests'=>['record_json'=>'LONGTEXT NULL'],'shop_orders'=>['record_json'=>'LONGTEXT NULL'],'credit_tiers'=>['record_json'=>'LONGTEXT NULL'],'entrepreneur_shop_items'=>['visible'=>'TINYINT(1) NOT NULL DEFAULT 1']] as $table=>$fields){
        foreach($fields as $field=>$definition)if(!$pdo->query("SHOW COLUMNS FROM $table LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE $table ADD COLUMN $field $definition");
    }
    foreach([
        'address'=>'TEXT NULL',
        'occupation'=>'VARCHAR(150) NULL',
        'has_online_business'=>"ENUM('yes','no') NOT NULL DEFAULT 'no'",
        'online_business_products'=>'VARCHAR(255) NULL',
        'online_business_duration'=>'VARCHAR(120) NULL',
        'monthly_income'=>'VARCHAR(120) NULL',
        'social_media_url'=>'VARCHAR(500) NULL',
        'followers_count'=>'INT UNSIGNED NULL',
        'facebook_marketing'=>"ENUM('yes','a_little','no') NOT NULL DEFAULT 'no'",
        'join_reason'=>'TEXT NULL',
        'agreement_accepted'=>'TINYINT(1) NOT NULL DEFAULT 0',
        'nic_image_path'=>'VARCHAR(255) NULL',
        'nic_front_path'=>'VARCHAR(255) NULL',
        'nic_back_path'=>'VARCHAR(255) NULL',
    ] as $field=>$definition){
        if(!$pdo->query("SHOW COLUMNS FROM registration_requests LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE registration_requests ADD COLUMN $field $definition");
    }
    $identityColumn=$pdo->query("SHOW COLUMNS FROM entrepreneurs LIKE 'nic_image_path'")->fetchAll();
    if(!$identityColumn)$pdo->exec('ALTER TABLE entrepreneurs ADD COLUMN nic_image_path VARCHAR(255) NULL AFTER nic');

    foreach(['stock_supply_requests','shop_orders'] as $table){$column=$pdo->query("SHOW COLUMNS FROM $table LIKE 'status'")->fetch();if(!str_contains($column['Type'],'varchar'))$pdo->exec("ALTER TABLE $table MODIFY status VARCHAR(40) NOT NULL DEFAULT 'Pending'");}
    if(!$pdo->query("SHOW COLUMNS FROM shop_orders LIKE 'delivered_at'")->fetch())$pdo->exec('ALTER TABLE shop_orders ADD COLUMN delivered_at DATETIME NULL AFTER status');
    $pdo->exec("UPDATE shop_orders SET delivered_at=created_at WHERE status='Delivered' AND delivered_at IS NULL");
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count === 0) {
        $password=getenv('CAMY_BOOTSTRAP_PASSWORD') ?: 'Camy!'.bin2hex(random_bytes(12)).'7';
        if(strlen($password)<12)throw new RuntimeException('The bootstrap password must have at least 12 characters.');
        $directory=__DIR__.'/../private';if(!is_dir($directory))mkdir($directory,0700,true);
        if(!getenv('CAMY_BOOTSTRAP_PASSWORD') && file_put_contents($directory.'/bootstrap-credentials.txt',"Email: admin@camy.lk\nTemporary password: $password\nChange this password at first sign-in.\n")===false)throw new RuntimeException('Could not save bootstrap credentials.');
        $insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status,must_change_password) VALUES('CAMY Administrator','admin@camy.lk',?,'admin','active',1)");
        $insert->execute([password_hash($password,PASSWORD_DEFAULT)]);
    }
    foreach($pdo->query("SELECT id,password_hash FROM users WHERE must_change_password=0 AND email IN ('admin@camy.lk','supun@camy.lk')")->fetchAll() as $user){
        if(password_verify('Admin@123',$user['password_hash'])||password_verify('Entrepreneur@123',$user['password_hash']))$pdo->prepare('UPDATE users SET must_change_password=1 WHERE id=?')->execute([$user['id']]);
    }
}
