// src/config/env.ts

interface IEnvVariables {
    PORT: string;
    NODE_ENV: string;
    DATABASE_URL: string;
    // FIX: Renamed from JWT_SECRET to JWT_ACCESS_SECRET for consistency with
    // jwt.strategy.ts and token.service.ts. Update your .env file accordingly.
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_EXPIRES_IN: string;
    // NEW: Moved from hardcoded 'admin123' in main.ts
    PULSE_MONITOR_SECRET: string;
    // NEW: Comma-separated list of allowed CORS origins e.g. "http://localhost:3000,https://mrcfly.com"
    ALLOWED_ORIGINS: string;
}

const envVariables: IEnvVariables = {
    PORT: process.env.PORT as string,
    NODE_ENV: process.env.NODE_ENV as string,
    DATABASE_URL: process.env.DATABASE_URL as string,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN as string,
    PULSE_MONITOR_SECRET: process.env.PULSE_MONITOR_SECRET as string,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS as string,
};

// Validate all required env vars at startup — fail fast rather than silently.
// ALLOWED_ORIGINS has a sensible default so it is not required.
const REQUIRED_VARS: (keyof IEnvVariables)[] = [
    'PORT',
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'PULSE_MONITOR_SECRET',
];

const environmentVariables = (): IEnvVariables => {
    for (const key of REQUIRED_VARS) {
        if (!envVariables[key]) {
            throw new Error(
                `Missing required environment variable: ${key}. Check your .env file.`,
            );
        }
    }
    return envVariables;
};

export const envVars = environmentVariables();