import { S3Client } from "@aws-sdk/client-s3";
import { getValidatedServerEnvironment } from "./env";

export const createR2Client = () => {
  const environment = getValidatedServerEnvironment();

  return new S3Client({
    region: "auto",
    endpoint: `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
  });
};

export const getR2Config = () => {
  const environment = getValidatedServerEnvironment();
  return {
    bucketName: environment.R2_BUCKET,
    publicBaseUrl: environment.R2_PUBLIC_URL,
  };
};

export const getPublicR2UrlForKey = (key: string) => {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
};
