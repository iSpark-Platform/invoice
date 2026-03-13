<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

$user   = validateToken();
$method = $_SERVER['REQUEST_METHOD'];

// Parse ID from URL like /api/users.php?id=5 or /api/reset-password.php?user_id=5
$id       = isset($_GET['id'])      ? (int)$_GET['id']      : 0;
$userId   = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$action   = $_GET['action']         ?? '';
$db       = getDB();

// ── POST /api/users/reset-password?user_id=X ──
if ($method === 'POST' && $action === 'reset-password') {
    if ($user['role'] !== 'admin') jsonError('Permission denied', 403);
    if (!$userId) jsonError('User ID required');

    $body    = json_decode(file_get_contents('php://input'), true);
    $newPwd  = $body['new_password'] ?? '';
    if (strlen($newPwd) < 6) jsonError('Password must be at least 6 characters');

    $stmt = $db->prepare("SELECT id, username FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $target = $stmt->fetch();
    if (!$target) jsonError('User not found', 404);

    $hash = password_hash($newPwd, PASSWORD_BCRYPT);
    $db->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$hash, $userId]);
    jsonResponse(['message' => 'Password reset for ' . $target['username']]);
}

// ── GET /api/users.php  (list all) ──
if ($method === 'GET' && !$id) {
    $stmt = $db->query(
        "SELECT id, username, email, first_name, last_name, role, phone, is_active, created_at FROM users ORDER BY id"
    );
    $users = $stmt->fetchAll();
    foreach ($users as &$u) {
        $u['full_name'] = trim($u['first_name'] . ' ' . $u['last_name']) ?: $u['username'];
        $u['is_active'] = (bool)$u['is_active'];
        $u['profile']   = ['role' => $u['role'], 'phone' => $u['phone']];
    }
    jsonResponse($users);
}

// ── GET /api/users.php?id=X ──
if ($method === 'GET' && $id) {
    $stmt = $db->prepare("SELECT id, username, email, first_name, last_name, role, phone, is_active FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    if (!$u) jsonError('Not found', 404);
    $u['full_name'] = trim($u['first_name'] . ' ' . $u['last_name']) ?: $u['username'];
    $u['is_active'] = (bool)$u['is_active'];
    $u['profile']   = ['role' => $u['role'], 'phone' => $u['phone']];
    jsonResponse($u);
}

// ── POST /api/users.php (create) ──
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $required = ['username', 'email', 'password', 'role'];
    foreach ($required as $f) {
        if (empty($body[$f])) jsonError("Field '$f' is required");
    }
    if (strlen($body['password']) < 6) jsonError('Password must be at least 6 characters');

    $hash = password_hash($body['password'], PASSWORD_BCRYPT);
    $stmt = $db->prepare(
        "INSERT INTO users (username, email, password, first_name, last_name, role, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    try {
        $stmt->execute([
            $body['username'],
            $body['email'],
            $hash,
            $body['first_name'] ?? '',
            $body['last_name']  ?? '',
            $body['role']       ?? 'manager',
            $body['phone']      ?? '',
        ]);
        $newId = $db->lastInsertId();
        $u = $db->prepare("SELECT id, username, email, first_name, last_name, role, phone, is_active FROM users WHERE id = ?");
        $u->execute([$newId]);
        $created = $u->fetch();
        $created['full_name'] = trim($created['first_name'] . ' ' . $created['last_name']) ?: $created['username'];
        $created['is_active'] = (bool)$created['is_active'];
        $created['profile']   = ['role' => $created['role'], 'phone' => $created['phone']];
        jsonResponse($created, 201);
    } catch (PDOException $e) {
        jsonError('Username or email already exists');
    }
}

// ── PUT /api/users.php?id=X (update) ──
if ($method === 'PUT' && $id) {
    $body = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare(
        "UPDATE users SET first_name=?, last_name=?, email=?, role=?, phone=?, is_active=? WHERE id=?"
    );
    $stmt->execute([
        $body['first_name'] ?? '',
        $body['last_name']  ?? '',
        $body['email']      ?? '',
        $body['role']       ?? 'manager',
        $body['phone']      ?? '',
        isset($body['is_active']) ? (int)$body['is_active'] : 1,
        $id,
    ]);
    $u = $db->prepare("SELECT id, username, email, first_name, last_name, role, phone, is_active FROM users WHERE id = ?");
    $u->execute([$id]);
    $updated = $u->fetch();
    $updated['full_name'] = trim($updated['first_name'] . ' ' . $updated['last_name']) ?: $updated['username'];
    $updated['is_active'] = (bool)$updated['is_active'];
    $updated['profile']   = ['role' => $updated['role'], 'phone' => $updated['phone']];
    jsonResponse($updated);
}

// ── DELETE /api/users.php?id=X ──
if ($method === 'DELETE' && $id) {
    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Deleted']);
}

jsonError('Not found', 404);
