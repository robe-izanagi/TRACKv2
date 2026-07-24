const nodemailer = require('nodemailer');

// Configure transporter (use your email provider)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendAccountCodeEmail = async ({ email, full_name, code }) => {
  const subject = 'Your TRACK Account Code';
  const html = `
    <h2>Hello ${full_name || 'User'},</h2>
    <p>Your account code for TRACK has been generated:</p>
    <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 2px;">
      ${code}
    </div>
    <p>Please use this code to complete your registration at:</p>
    <p><a href="${process.env.FRONTEND_URL}/register">${process.env.FRONTEND_URL}/register</a></p>
    <p>This code will expire in 7 days.</p>
    <br/>
    <p>Thank you,<br/>TRACK Team</p>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@trackv2.com',
    to: email,
    subject,
    html
  });
};