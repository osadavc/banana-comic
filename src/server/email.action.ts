"use server";

import * as React from "react";
import { resend } from "../lib/email/resend";
import DailyComicStripEmail from "../emails/daily-comic-strip";

type SendDailyComicEmailParams = {
  to: string;
  title: string;
  issueNumber: number | string;
  imageUrl: string;
  unsubUrl: string;
  date: string;
};

export const sendDailyComicEmail = async ({
  to,
  title,
  issueNumber,
  imageUrl,
  unsubUrl,
  date,
}: SendDailyComicEmailParams) => {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not set");
  }

  const subjectParts = [
    "Daily Comic",
    issueNumber ? `#${issueNumber}` : undefined,
    title ? `— ${title}` : undefined,
  ].filter(Boolean);

  const subject = subjectParts.join(" ");

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: subject || "Your Daily Comic Strip",
    react: React.createElement(DailyComicStripEmail, {
      title,
      issueNumber,
      imageUrl,
      unsubUrl,
      date,
    }),
  });

  if (error) {
    throw error;
  }

  return data;
};
