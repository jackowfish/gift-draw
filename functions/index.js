const functions = require("firebase-functions");
const twilio = require("twilio");

const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.token;
const twilioClient = twilio(accountSid, authToken);

exports.sendTwilioSMS = functions.https.onCall((data, context) => {
  const { to, body } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  return twilioClient.messages
    .create({
      body: body,
      from: "+14843095079", // Replace with your Twilio number
      to: to,
    })
    .then((message) => ({ success: true, sid: message.sid }))
    .catch((error) => ({ success: false, error: error.message }));
});
