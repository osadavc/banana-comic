"use server";

import * as React from "react";
import { resend } from "../lib/email/resend";
import WelcomeEmail from "../emails/WelcomeEmail";

type SendWelcomeEmailParams = {
  to: string;
  firstName?: string;
};

export const sendWelcomeEmail = async ({
  to,
  firstName,
}: SendWelcomeEmailParams) => {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not set");
  }

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "Welcome to Banana Comic",
    react: React.createElement(WelcomeEmail, { firstName: firstName ?? "" }),
  });

  if (error) {
    throw error;
  }

  return data;
};
