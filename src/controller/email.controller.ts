import { google } from "googleapis";
import {
  getUnrepliedMessages,
  getEmailDetails,
  sendEmail,
  loadSavedCredentialsIfExist,
  createLabel,
  addLabel,
  markThreadAsReplied,
  hasThreadBeenReplied,
} from "../utils/gmail";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URL,
};
const tokenPath = path.resolve(__dirname, "token.json");
const repliedThreadsFile = path.resolve(__dirname, "repliedThreads.json");
const oauth2Client = new google.auth.OAuth2(
  googleConfig.clientId,
  googleConfig.clientSecret,
  googleConfig.redirectUri
);

export const sendMessages = async (req: any, res: any) => {
  try {
    const tokens: any = await loadSavedCredentialsIfExist(tokenPath);
    console.log("tokens", tokens);
    const credentials = JSON.parse(tokens);
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      scope: process.env.GOOGLE_SCOPES,
      token_type: "Bearer",
      expiry_date: credentials.expiry_date,
    });

    const unrepliedMessages: any = await getUnrepliedMessages(oauth2Client);
    console.log("message ids", unrepliedMessages);
    const label = await createLabel(oauth2Client);
    for (let index = 0; index < unrepliedMessages.length; index++) {
        const threadId = unrepliedMessages[index].threadId;
      const checkIfReplied = await hasThreadBeenReplied(
        threadId,
        repliedThreadsFile
      );
      if (checkIfReplied) {
        console.log(`Thread ${threadId} has already been replied. Skipping.`);
        res.status(200).json({ message: "Thread already replied" });
        return;
      }
      const messageId: any = unrepliedMessages[index].id;
      const unrepliedMessage: any = await getEmailDetails(
        oauth2Client,
        unrepliedMessages[index].id!
      );

      const subject = unrepliedMessage.data.payload.headers.find(
        (header: any) => header.name == "Subject"
      ).value;
      const senderEmail = unrepliedMessage.data.payload.headers.find(
        (header: any) => header.name === "From"
      ).value;

      const replySubject = subject.startsWith("Re:")
        ? subject
        : `Re: ${subject}`;
      const sendReply = await sendEmail(
        oauth2Client,
        senderEmail,
        replySubject,
        messageId
      );
      await addLabel(oauth2Client, unrepliedMessages[0], label);
      const markedReplied = await markThreadAsReplied(
        threadId,
        repliedThreadsFile
      );
      console.log("marked replied", markedReplied);

      console.log("send reply", sendReply);
    }

    res.status(200).json({ message: unrepliedMessages });
  } catch (error) {
    console.error("error to send email", error);
    res.status(500).json({ error: "error occoured to send email" });
  }
};
