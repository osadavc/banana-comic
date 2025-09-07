import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

type WelcomeEmailProps = {
  firstName?: string;
};

const containerStyle: React.CSSProperties = {
  margin: "0 auto",
  padding: "40px 24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#000000",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};

const WelcomeEmail = ({ firstName = "there" }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Banana Comic</Preview>
    <Body style={{ backgroundColor: "#f9fafb", padding: "24px" }}>
      <Container style={containerStyle}>
        <Heading as="h1">Welcome, {firstName} 👋</Heading>
        <Text style={{ color: "#374151", lineHeight: "1.6" }}>
          Thanks for joining Banana Comic. You’re all set to explore episodes
          and updates.
        </Text>
        <Button href="https://example.com" style={buttonStyle}>
          Open Banana Comic
        </Button>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;
