<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// POST auth.php?action=login
if ($method === 'POST' && $action === 'login') {
    $body     = json_decode(file_get_contents('php://input'), true);
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) jsonError('Username and password required');

    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Invalid username or password', 401);
    }

    $token = generateToken($user['id']);
    jsonResponse([
        'access'  => $token,
        'refresh' => $token,
        'user'    => [
            'id'        => $user['id'],
            'username'  => $user['username'],
            'email'     => $user['email'],
            'full_name' => trim($user['first_name'] . ' ' . $user['last_name']) ?: $user['username'],
            'role'      => $user['role'],
        ]
    ]);
}

// GET auth.php?action=me
if ($method === 'GET' && $action === 'me') {
    $user = validateToken();
    jsonResponse([
        'id'        => $user['user_id'],
        'username'  => $user['username'],
        'email'     => $user['email'],
        'full_name' => trim($user['first_name'] . ' ' . $user['last_name']) ?: $user['username'],
        'role'      => $user['role'],
    ]);
}

// POST auth.php?action=change-password
if ($method === 'POST' && $action === 'change-password') {
    $user   = validateToken();
    $body   = json_decode(file_get_contents('php://input'), true);
    $oldPwd = $body['old_password'] ?? '';
    $newPwd = $body['new_password'] ?? '';

    $db   = getDB();
    $stmt = $db->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$user['user_id']]);
    $row  = $stmt->fetch();

    if (!password_verify($oldPwd, $row['password'])) jsonError('Current password is incorrect');
    if (strlen($newPwd) < 6) jsonError('Password must be at least 6 characters');

    $hash = password_hash($newPwd, PASSWORD_BCRYPT);
    $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$hash, $user['user_id']]);
    jsonResponse(['message' => 'Password changed successfully']);
}

// POST auth.php?action=logout
if ($method === 'POST' && $action === 'logout') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
        getDB()->prepare("DELETE FROM sessions WHERE token = ?")->execute([$m[1]]);
    }
    jsonResponse(['message' => 'Logged out']);
}

jsonError('Not found', 404);
