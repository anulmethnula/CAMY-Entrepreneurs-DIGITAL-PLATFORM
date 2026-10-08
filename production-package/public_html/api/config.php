<?php
declare(strict_types=1);

function load_environment_file(string $file): void
{
    if (!is_file($file) || !is_readable($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line=trim($line);
        if ($line==='' || str_starts_with($line,'#') || !str_contains($line,'=')) continue;
        [$key,$value]=array_map('trim',explode('=',$line,2));
        if (!preg_match('/^[A-Z][A-Z0-9_]*$/',$key) || getenv($key)!==false) continue;
        if (strlen($value)>=2 && (($value[0]==='"' && str_ends_with($value,'"')) || ($value[0]==="'" && str_ends_with($value,"'")))) $value=substr($value,1,-1);
        putenv($key.'='.$value);$_ENV[$key]=$value;
    }
}

$defaultEnvironmentFile=dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__.'/..')).'/private/camy.env';
load_environment_file((string)(getenv('CAMY_ENV_FILE') ?: $defaultEnvironmentFile));

define('CAMY_ENV',(string)(getenv('CAMY_ENV') ?: 'development'));
define('CAMY_PRIVATE_ROOT',rtrim((string)(getenv('CAMY_PRIVATE_PATH') ?: __DIR__.'/../private'),'\\/'));
define('CAMY_DATA_ROOT',rtrim((string)(getenv('CAMY_DATA_PATH') ?: (CAMY_ENV==='production' ? CAMY_PRIVATE_ROOT.'/catalogue' : __DIR__.'/../database')),'\\/'));
define('DB_HOST',(string)(getenv('DB_HOST') ?: getenv('CAMY_DB_HOST') ?: '127.0.0.1'));
define('DB_PORT',(int)(getenv('DB_PORT') ?: getenv('CAMY_DB_PORT') ?: 3306));
define('DB_NAME',(string)(getenv('DB_NAME') ?: getenv('CAMY_DB_NAME') ?: 'camy_new'));
define('DB_USER',(string)(getenv('DB_USER') ?: getenv('CAMY_DB_USER') ?: 'root'));
define('DB_PASS',(string)(getenv('DB_PASS') ?: getenv('CAMY_DB_PASSWORD') ?: ''));

function private_path(string $path=''): string
{
    return CAMY_PRIVATE_ROOT.($path===''?'':'/'.ltrim($path,'/\\'));
}

function data_path(string $path): string
{
    return CAMY_DATA_ROOT.'/'.ltrim($path,'/\\');
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    if(!preg_match('/^[a-zA-Z0-9_]+$/',DB_NAME))throw new RuntimeException('Invalid database name.');
    if(CAMY_ENV==='production' && (DB_NAME===''||DB_USER===''||DB_USER==='root'||DB_PASS===''))throw new RuntimeException('Production requires a cPanel database name, dedicated user and password.');

    $server = new PDO(
        'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    if(CAMY_ENV!=='production')$server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $server->exec('USE `' . DB_NAME . '`');
    $pdo = $server;
    initialise_database($pdo);
    return $pdo;
}

function initialise_database(PDO $pdo): void
{
    $schemaFile=(string)(getenv('CAMY_SCHEMA_PATH') ?: (CAMY_ENV==='production' ? private_path('schema.sql') : __DIR__.'/../database/schema.sql'));
    $schema = file_get_contents($schemaFile);
    if ($schema === false) throw new RuntimeException('Database schema could not be loaded.');
    $pdo->exec($schema);
    // Numeric primary keys begin at 1000. MySQL keeps a higher existing sequence,
    // so this safely updates established databases without renumbering records.
    foreach (['users','staff_access_roles','entrepreneurs','products','audit_logs','entrepreneur_payouts','credit_tiers','registration_requests','login_attempts'] as $table) {
        $pdo->exec("ALTER TABLE `$table` AUTO_INCREMENT = 1000");
    }
    foreach(['must_change_password'=>'TINYINT(1) NOT NULL DEFAULT 0','session_version'=>'INT UNSIGNED NOT NULL DEFAULT 1','access_role'=>'VARCHAR(40) NULL','permissions_json'=>'TEXT NULL'] as $field=>$definition){
        if(!$pdo->query("SHOW COLUMNS FROM users LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE users ADD COLUMN $field $definition");
    }
    foreach(['products'=>['record_json'=>'LONGTEXT NULL','billing_price'=>'DECIMAL(14,2) NULL AFTER price','delivery_cost'=>'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER billing_price','packaging_cost'=>'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER delivery_cost','free_delivery'=>'TINYINT(1) NOT NULL DEFAULT 1 AFTER packaging_cost'],'stock_supply_requests'=>['record_json'=>'LONGTEXT NULL'],'shop_orders'=>['record_json'=>'LONGTEXT NULL'],'credit_tiers'=>['record_json'=>'LONGTEXT NULL'],'entrepreneur_shop_items'=>['visible'=>'TINYINT(1) NOT NULL DEFAULT 1']] as $table=>$fields){
        foreach($fields as $field=>$definition)if(!$pdo->query("SHOW COLUMNS FROM $table LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE $table ADD COLUMN $field $definition");
    }
    // Backfill normalized pricing columns for catalogues created before the cost
    // breakdown became relational. Future saves keep both these columns and the
    // complete JSON product record synchronized.
    $productPricing=$pdo->prepare('UPDATE products SET billing_price=?,delivery_cost=?,packaging_cost=?,free_delivery=? WHERE id=?');
    foreach($pdo->query('SELECT id,price,record_json,billing_price FROM products')->fetchAll() as $row){
        if($row['billing_price']!==null)continue;
        $record=$row['record_json']?json_decode((string)$row['record_json'],true):[];
        $billing=round((float)($record['billingPrice'] ?? $row['price']),2);$delivery=round((float)($record['deliveryCost'] ?? 0),2);$packaging=round((float)($record['packagingCost'] ?? 0),2);$free=($record['freeDelivery'] ?? true)===true?1:0;
        $productPricing->execute([$billing,$delivery,$packaging,$free,$row['id']]);
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
    foreach([
        'full_name'=>'VARCHAR(150) NULL AFTER member_id',
        'email'=>'VARCHAR(190) NULL AFTER full_name',
        'nic_image_path'=>'VARCHAR(255) NULL AFTER nic',
    ] as $field=>$definition){
        if(!$pdo->query("SHOW COLUMNS FROM entrepreneurs LIKE '$field'")->fetch())$pdo->exec("ALTER TABLE entrepreneurs ADD COLUMN $field $definition");
    }
    // Keep a complete entrepreneur record for administration/reporting while the
    // users table remains the authentication source of truth.
    $pdo->exec("UPDATE entrepreneurs e JOIN users u ON u.id=e.user_id SET e.full_name=u.full_name,e.email=u.email WHERE u.role='entrepreneur'");

    foreach(['stock_supply_requests','shop_orders'] as $table){$column=$pdo->query("SHOW COLUMNS FROM $table LIKE 'status'")->fetch();if(!str_contains($column['Type'],'varchar'))$pdo->exec("ALTER TABLE $table MODIFY status VARCHAR(40) NOT NULL DEFAULT 'Pending'");}
    if(!$pdo->query("SHOW COLUMNS FROM shop_orders LIKE 'delivered_at'")->fetch())$pdo->exec('ALTER TABLE shop_orders ADD COLUMN delivered_at DATETIME NULL AFTER status');
    $pdo->exec("UPDATE shop_orders SET delivered_at=created_at WHERE status='Delivered' AND delivered_at IS NULL");
    if(!$pdo->query("SHOW COLUMNS FROM entrepreneur_payouts LIKE 'payout_due_at'")->fetch())$pdo->exec('ALTER TABLE entrepreneur_payouts ADD COLUMN payout_due_at DATETIME NULL AFTER collected_at');
    $payoutDueIndex=$pdo->prepare("SHOW INDEX FROM entrepreneur_payouts WHERE Key_name=?");$payoutDueIndex->execute(['payout_due_status']);
    if(!$payoutDueIndex->fetch())$pdo->exec('ALTER TABLE entrepreneur_payouts ADD INDEX payout_due_status (payout_status,payout_due_at)');
    // Commissions have no fixed payment deadline. CAMY may record the transfer
    // at any time after delivery and COD collection.
    $pdo->exec('UPDATE entrepreneur_payouts SET payout_due_at=NULL WHERE payout_due_at IS NOT NULL');

    // Operational indexes are also applied to existing local databases. These keep
    // entrepreneur/state refreshes and the 90-day activity check responsive as data grows.
    foreach([
        'users'=>['users_role_status_member'=>'(role,status,member_id)'],
        'stock_supply_requests'=>['supply_member_status_created'=>'(entrepreneur_member_id,status,created_at)'],
        'shop_orders'=>['shop_orders_member_status_delivery'=>'(entrepreneur_member_id,status,delivered_at)'],
    ] as $table=>$indexes){
        foreach($indexes as $name=>$columns){
            $check=$pdo->prepare("SHOW INDEX FROM `$table` WHERE Key_name=?");$check->execute([$name]);
            if(!$check->fetch())$pdo->exec("ALTER TABLE `$table` ADD INDEX `$name` $columns");
        }
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count === 0) {
        $password=getenv('CAMY_BOOTSTRAP_PASSWORD') ?: (CAMY_ENV==='production' ? '' : 'Camy!'.bin2hex(random_bytes(12)).'7');
        if(CAMY_ENV==='production' && $password==='')throw new RuntimeException('Set CAMY_BOOTSTRAP_PASSWORD before the first production request.');
        if(strlen($password)<12)throw new RuntimeException('The bootstrap password must have at least 12 characters.');
        $directory=private_path();if(!is_dir($directory))mkdir($directory,0700,true);
        if(!getenv('CAMY_BOOTSTRAP_PASSWORD') && file_put_contents($directory.'/bootstrap-credentials.txt',"Email: admin@camy.lk\nTemporary password: $password\nChange this password at first sign-in.\n")===false)throw new RuntimeException('Could not save bootstrap credentials.');
        $insert=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status,must_change_password) VALUES('CAMY Administrator','admin@camy.lk',?,'admin','active',1)");
        $insert->execute([password_hash($password,PASSWORD_DEFAULT)]);
    }
    foreach($pdo->query("SELECT id,password_hash FROM users WHERE must_change_password=0 AND email IN ('admin@camy.lk','supun@camy.lk')")->fetchAll() as $user){
        if(password_verify('Admin@123',$user['password_hash'])||password_verify('Entrepreneur@123',$user['password_hash']))$pdo->prepare('UPDATE users SET must_change_password=1 WHERE id=?')->execute([$user['id']]);
    }
}
