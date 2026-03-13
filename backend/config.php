<?php
// ─── Database Configuration ───────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'stem_invoice');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_PORT', '3306');

// ─── Base URL ─────────────────────────────────────────────
if (!defined('BASE_URL')) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    define('BASE_URL', "{$protocol}://{$host}");
}
define('BRAND_DIR', __DIR__ . '/../brand/');

// ─── SMTP Config ──────────────────────────────────────────
define('SMTP_HOST',      'ns11-777.333servers.com');
define('SMTP_PORT',      465);
define('SMTP_USER',      'admin@isparklearning.com');
define('SMTP_PASS',      'admin@ispark');
define('SMTP_FROM',      'admin@isparklearning.com');
define('SMTP_FROM_NAME', 'iSpark Learning Solutions');

date_default_timezone_set('Asia/Kolkata');

// ─── PDO Connection ───────────────────────────────────────
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Sync MySQL timezone with PHP
        $pdo->exec("SET time_zone = '+05:30'");
    }
    return $pdo;
}

// ─── JSON Response Helpers ────────────────────────────────
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function jsonError($msg, $code = 400) {
    jsonResponse(['error' => $msg], $code);
}

// ─── CORS Headers ─────────────────────────────────────────
function setCORSHeaders() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ─── Auth: Generate Token ─────────────────────────────────
function generateToken($userId) {
    $token = bin2hex(random_bytes(32));
    $db    = getDB();
    $exp   = date('Y-m-d H:i:s', strtotime('+8 hours'));
    $stmt  = $db->prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $token, $exp]);
    return $token;
}

// ─── Auth: Validate Token ─────────────────────────────────
function validateToken() {
    $auth = '';
    // Check various sources for the Authorization header
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $auth = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $auth = $headers['authorization'];
        }
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $auth = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $auth = $headers['authorization'];
        }
    }

    if (!preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
        // Fallback to GET for PDF/Print links
        if (isset($_GET['token'])) {
            $token = $_GET['token'];
        } else {
            jsonError('Unauthorized', 401);
        }
    } else {
        $token = $m[1];
    }
    $db    = getDB();
    $stmt  = $db->prepare(
        "SELECT s.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.is_active
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()"
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonError('Unauthorized', 401);
    }
    if (!$user['is_active']) {
        jsonError('Account is inactive', 401);
    }
    return $user;
}

// ─── Amount in Words (PHP 7.4 compatible) ─────────────────
function numToWords($n, $ones, $tens) {
    if ($n === 0) return '';
    if ($n < 20)  return $ones[$n] . ' ';
    if ($n < 100) return $tens[(int)($n/10)] . ' ' . numToWords($n % 10, $ones, $tens);
    if ($n < 1000) return $ones[(int)($n/100)] . ' Hundred ' . numToWords($n % 100, $ones, $tens);
    if ($n < 100000) return numToWords((int)($n/1000), $ones, $tens) . 'Thousand ' . numToWords($n % 1000, $ones, $tens);
    if ($n < 10000000) return numToWords((int)($n/100000), $ones, $tens) . 'Lakh ' . numToWords($n % 100000, $ones, $tens);
    return numToWords((int)($n/10000000), $ones, $tens) . 'Crore ' . numToWords($n % 10000000, $ones, $tens);
}

function amountInWords($amount) {
    $ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
             'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
             'Seventeen','Eighteen','Nineteen'];
    $tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    $rupees = (int)$amount;
    $paise  = (int)round(($amount - $rupees) * 100);
    $result = trim(numToWords($rupees, $ones, $tens)) ?: 'Zero';
    if ($paise > 0) {
        $result .= ' and ' . trim(numToWords($paise, $ones, $tens)) . ' Paise';
    }
    return $result . ' Only';
}

// ─── Image to Base64 ──────────────────────────────────────
function imageToBase64($filename) {
    $path = BRAND_DIR . $filename;
    if (!file_exists($path)) return '';
    $data = file_get_contents($path);
    $ext  = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $mime = ($ext === 'png') ? 'image/png' : 'image/jpeg';
    return 'data:' . $mime . ';base64,' . base64_encode($data);
}