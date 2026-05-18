import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({ region: 'ap-south-1' });

let cachedSecrets: Record<string, string> = {};

export async function getSecret(secretName: string): Promise<string> {
  // Return from cache if already fetched
  if (cachedSecrets[secretName]) {
    return cachedSecrets[secretName];
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command); 

    let secret: string;

    // Handle both string and binary secrets
    if (response.SecretString) {
      secret = response.SecretString;
    } else if (response.SecretBinary) {
      // Convert Uint8Array to string
      secret = Buffer.from(response.SecretBinary).toString('utf-8');
    } else {
      throw new Error(`Secret ${secretName} is empty`);
    }

    // Cache it for the lambda lifetime
    cachedSecrets[secretName] = secret;
    return secret;
  } catch (error) {
    console.error(`Failed to fetch secret ${secretName}:`, error);
    throw error;
  }
}