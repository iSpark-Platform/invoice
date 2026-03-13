<?php
require_once __DIR__ . '/config.php';

try {
    $db = getDB();
    $sqlFile = __DIR__ . '/../database.sql';
    
    if (!file_exists($sqlFile)) {
        die("Error: database.sql not found at " . $sqlFile . "\n");
    }

    $sql = file_get_contents($sqlFile);
    
    // Split by semicolon to execute one by one (basic approach)
    // However, some statements might have semicolons inside strings.
    // For database.sql, it's mostly straightforward.
    
    // Better approach: just execute the whole thing if the driver supports it, 
    // or use a more robust separator logic.
    
    // PDO::exec can run multiple queries if the server allows it.
    $db->exec($sql);
    
    echo "Database initialized successfully.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
