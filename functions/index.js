const functions = require("firebase-functions");
const twilio = require("twilio");

const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.token;
const twilioClient = twilio(accountSid, authToken);

exports.sendTwilioSMS = functions.https.onCall((data) => {
  const { to, body } = data;

  return twilioClient.messages
    .create({
      body: body,
      from: "+14843095079",
      to: to,
    })
    .then((message) => ({ success: true, sid: message.sid }))
    .catch((error) => ({ success: false, error: error.message }));
});
