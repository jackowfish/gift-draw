const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

const { account, app_password } = functions.config().gmail;

exports.sendGmail = functions.https.onCall((data) => {
  const { to, subject, text } = data;

  const mailTransport = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    auth: {
      user: account,
      pass: app_password,
    },
  });

  const mailOptions = {
    to: to,
    subject: subject,
    text: text,
  };

  return mailTransport
    .sendMail(mailOptions)
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
});
