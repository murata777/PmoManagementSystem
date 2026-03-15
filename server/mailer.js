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

module.exports = { sendInitialPassword };
