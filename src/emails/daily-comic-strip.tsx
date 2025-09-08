import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type DailyComicStripEmailProps = {
  title: string;
  issueNumber: number | string;
  imageUrl: string;
  unsubUrl: string;
  date: string;
};

const MAX_WIDTH = 1000;

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#ffffff",
    margin: 0,
    padding: "24px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif",
  },
  container: {
    margin: "0 auto",
    padding: 0,
    maxWidth: `${MAX_WIDTH}px`,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px",
    textAlign: "left",
  },
  headerText: {
    margin: 0,
    color: "#111827",
    lineHeight: 1.2,
    fontWeight: 700,
    fontSize: 24,
  },
  subHeaderText: {
    margin: "6px 0 0",
    color: "#374151",
    fontStyle: "italic",
    fontSize: 14,
  },
  content: {
    padding: 0,
    textAlign: "left",
  },
  figure: {
    display: "block",
    margin: 0,
  },
  image: {
    display: "block",
    width: "100%",
    maxWidth: `${MAX_WIDTH}px`,
  },
  metaRow: {
    padding: "16px 24px",
  },
  metaText: {
    margin: 0,
    color: "#374151",
    fontSize: 14,
    lineHeight: 1.6,
  },
  footer: {
    padding: "20px 24px",
    textAlign: "left",
    backgroundColor: "#ffffff",
  },
  unsub: {
    color: "#6b7280",
    fontSize: 12,
    textDecoration: "underline",
  },
};

function formatDate(date?: string) {
  const d = date ? new Date(date) : new Date();
  try {
    return d.toLocaleDateString("en-US", { dateStyle: "long" as const });
  } catch {
    // Fallback for environments without dateStyle support
    const month = d.toLocaleString("en-US", { month: "long" });
    return `${month} ${d.getDate()}, ${d.getFullYear()}`;
  }
}

const DailyComicStripEmail = ({
  title,
  issueNumber,
  imageUrl,
  unsubUrl,
  date,
}: DailyComicStripEmailProps) => {
  const dateLabel = formatDate(date);
  const issueLabel = issueNumber ? `#${issueNumber}` : "";
  const preview = [title || "Daily Comic Strip", issueLabel]
    .filter(Boolean)
    .join(" ");

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            {!!title && (
              <Heading as="h1" style={styles.headerText}>
                {title}
              </Heading>
            )}
            <Text style={styles.subHeaderText}>{dateLabel}</Text>
          </Section>

          <Section style={styles.content}>
            <Section style={styles.figure}>
              <Img
                src={imageUrl}
                alt={title || "Comic strip"}
                width={MAX_WIDTH}
                style={styles.image}
              />
            </Section>

            <Section style={styles.metaRow}>
              <Text style={styles.metaText}>
                Check again tomorrow for the next comic strip!
              </Text>
            </Section>
          </Section>

          <Section style={styles.footer}>
            <Text style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>
              You&apos;re receiving this email because you subscribed.
            </Text>
            <Text style={{ margin: "8px 0 0" }}>
              <a href={unsubUrl} style={styles.unsub}>
                Unsubscribe
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default DailyComicStripEmail;
