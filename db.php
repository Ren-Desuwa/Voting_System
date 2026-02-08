<?php
// db.php
$host = 'db';   // <--- IMPORTANT: In Docker, this is 'db', NOT 'localhost' or '127.0.0.1'
$db   = 'voting_system';
$user = 'root';
$pass = 'root'; // Matches MYSQL_ROOT_PASSWORD in your docker-compose.yaml
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int)$e->getCode());
}
?>