require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendInitialPassword(to, name, password) {
  await transporter.sendMail({
    from: `"PMO System" <${process.env.MAIL_FROM}>`,
    to,
    subject: '【PMO Management System】アカウント登録のご案内',
    html: `
      <h2>PMO Management System へようこそ</h2>
      <p>${name} 様</p>
      <p>アカウントが作成されました。以下の初期パスワードでログインしてください。</p>
      <p><strong>メールアドレス:</strong> ${to}</p>
      <p><strong>初期パスワード:</strong> <code style="font-size:1.2em;background:#f0f0f0;padding:4px 8px;">${password}</code></p>
      <p style="color:red;">ログイン後、必ずパスワードを変更してください。</p>
      <hr>
      <p style="color:#888;font-size:0.9em;">このメールに心当たりがない場合は無視してください。</p>
    `,
  });
}

function mailConfigured() {
  return Boolean(
    process.env.MAIL_HOST &&
      process.env.MAIL_FROM &&
      process.env.MAIL_USER &&
      process.env.MAIL_PASS
  );
}

/** 操作履歴通知（BCC で宛先を非表示） */
async function sendActivityNotificationEmail(recipients, payload) {
  if (!mailConfigured() || !recipients?.length) return;
  const { summary, actorName, createdAt, action, targetType, logId } = payload;
  const when = createdAt ? String(createdAt).replace('T', ' ').slice(0, 19) : '';
  const subj = `【PMO Management System】操作通知`;
  const safe = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  try {
    await transporter.sendMail({
      from: `"PMO System" <${process.env.MAIL_FROM}>`,
      bcc: recipients,
      subject: subj,
      html: `
      <h2 style="font-size:16px;">操作が記録されました</h2>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">内容</td><td>${safe(summary)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">実行者</td><td>${safe(actorName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">日時</td><td>${safe(when)} UTC</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">操作</td><td>${safe(action)} / ${safe(targetType)}</td></tr>
        ${logId ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">ログID</td><td><code>${safe(logId)}</code></td></tr>` : ''}
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px;">PMO Management System の通知設定で配信先を変更できます。</p>
    `,
    });
  } catch (e) {
    console.error('[mailer] activity notification failed:', e.message);
    throw e;
  }
}

module.exports = { sendInitialPassword, sendActivityNotificationEmail, mailConfigured };
