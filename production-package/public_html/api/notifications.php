<?php
declare(strict_types=1);

function notification_public_url(): string
{
    $fallback=CAMY_ENV==='production'?'https://camymarket.com':'http://127.0.0.1:8080';
    return rtrim((string)(getenv('CAMY_PUBLIC_URL') ?: $fallback),'/');
}

function notification_log(string $message): void
{
    $directory=private_path('logs');
    if(!is_dir($directory))mkdir($directory,0700,true);
    error_log('['.date(DATE_ATOM).'] '.$message."\n",3,$directory.'/email-notifications.log');
}

function notification_send_email(string $to,string $subject,string $html): bool
{
    if(!filter_var($to,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$to.$subject))return false;
    $from=(string)(getenv('CAMY_MAIL_FROM') ?: 'notifications@camymarket.com');
    $fromName=(string)(getenv('CAMY_MAIL_FROM_NAME') ?: 'CAMY Entrepreneurs');
    if(!filter_var($from,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$from.$fromName))return false;
    $headers=[
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: '.$fromName.' <'.$from.'>',
        'Reply-To: '.$from,
        'X-Mailer: CAMY Platform',
    ];
    $sent=@mail($to,$subject,$html,implode("\r\n",$headers));
    if(!$sent)notification_log('Email delivery was not accepted by the server for '.$to.' ('.$subject.').');
    return $sent;
}

function registration_decision_email(array $request,string $decision,?string $memberId=null): bool
{
    $name=htmlspecialchars((string)($request['full_name'] ?? 'Applicant'),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $email=(string)($request['email'] ?? '');
    $safeEmail=htmlspecialchars($email,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $loginUrl=htmlspecialchars(notification_public_url().'/',ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $approved=$decision==='approved';
    $subject=$approved?'Your CAMY entrepreneur application was approved':'Update on your CAMY entrepreneur application';
    $headline=$approved?'Your CAMY application is approved':'Your CAMY application was not approved';
    $body=$approved
        ? '<p>Your CAMY entrepreneur account is now active. You can sign in using the email address and password you created during registration.</p><p><strong>Login email:</strong> '.$safeEmail.'<br><strong>Member ID:</strong> '.htmlspecialchars((string)$memberId,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</p><p><a href="'.$loginUrl.'" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0b668f;color:#fff;text-decoration:none;font-weight:700">Sign in to CAMY</a></p>'
        : '<p>Thank you for your interest in becoming a CAMY entrepreneur. After reviewing your application, CAMY is unable to approve it at this time.</p><p>If you need clarification, please contact CAMY support on <a href="tel:+94777165336">+94 77 716 5336</a>.</p>';
    $html='<!doctype html><html><body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#173c5f"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="padding:28px;border-radius:14px;background:#fff;border:1px solid #d7e5ee"><p style="margin-top:0;color:#287cad;font-size:12px;font-weight:700;letter-spacing:.08em">CAMY ENTREPRENEURS</p><h1 style="font-size:25px;color:#0b314b">'.$headline.'</h1><p>Hello '.$name.',</p>'.$body.'<p style="margin-bottom:0;color:#6a8191;font-size:13px">This is an automatic message from CAMY Entrepreneurs. Please do not share your password with anyone.</p></div></div></body></html>';
    return notification_send_email($email,$subject,$html);
}
