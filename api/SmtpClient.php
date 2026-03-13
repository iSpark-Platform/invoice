<?php
/**
 * A minimal SMTP client for iSpark Invoice Management
 * Handles SMTP Auth, TLS/SSL, and CC/BCC.
 */
class SmtpClient {
    private $host, $port, $user, $pass, $from, $fromName;

    public function __construct($host, $port, $user, $pass, $from, $fromName) {
        $this->host = $host;
        $this->port = $port;
        $this->user = $user;
        $this->pass = $pass;
        $this->from = $from;
        $this->fromName = $fromName;
    }

    public function send($to, $subject, $body, $cc = '', $bcc = '') {
        $transport = ($this->port == 465) ? "ssl://" . $this->host : $this->host;
        $socket = fsockopen($transport, $this->port, $errno, $errstr, 30);
        if (!$socket) throw new Exception("Could not connect to SMTP host: $errstr ($errno)");

        $this->getResponse($socket, "220");
        $this->sendCommand($socket, "EHLO " . $_SERVER['HTTP_HOST'], "250");
        
        $this->sendCommand($socket, "AUTH LOGIN", "334");
        $this->sendCommand($socket, base64_encode($this->user), "334");
        $this->sendCommand($socket, base64_encode($this->pass), "235");

        $this->sendCommand($socket, "MAIL FROM: <$this->from>", "250");
        
        $recipients = [$to];
        if ($cc)  $recipients = array_merge($recipients, array_map('trim', explode(',', $cc)));
        if ($bcc) $recipients = array_merge($recipients, array_map('trim', explode(',', $bcc)));
        
        foreach ($recipients as $rcpt) {
            if ($rcpt) $this->sendCommand($socket, "RCPT TO: <$rcpt>", "250");
        }

        $this->sendCommand($socket, "DATA", "354");

        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: $this->fromName <$this->from>\r\n";
        $headers .= "To: $to\r\n";
        if ($cc)  $headers .= "Cc: $cc\r\n";
        $headers .= "Subject: $subject\r\n";
        $headers .= "Date: " . date('r') . "\r\n";
        $headers .= "Message-ID: <" . time() . ".-" . $this->from . ">\r\n";
        $headers .= "\r\n";

        fwrite($socket, $headers . $body . "\r\n.\r\n");
        $this->getResponse($socket, "250");
        $this->sendCommand($socket, "QUIT", "221");
        fclose($socket);
        return true;
    }

    private function sendCommand($socket, $cmd, $expected) {
        fwrite($socket, $cmd . "\r\n");
        return $this->getResponse($socket, $expected);
    }

    private function getResponse($socket, $expected) {
        $res = "";
        while ($line = fgets($socket, 512)) {
            $res .= $line;
            if (substr($line, 3, 1) == " ") break;
        }
        if (substr($res, 0, 3) !== $expected) {
            throw new Exception("SMTP Error: " . trim($res));
        }
        return $res;
    }
}
