interface IEnvVariables {
    PORT: String;
    DATABASE_URL: String;
    JWT_SECRET: String;
    JWT_EXPIRES_IN: String;
    REFRESH_TOKEN_SECRET: String;
    REFRESH_TOKEN_EXPIRES_IN: String;

}

const envVariables: IEnvVariables = {
    "PORT": process.env.PORT as string,
    "DATABASE_URL": process.env.DATABASE_URL as string,
    "JWT_SECRET": process.env.JWT_SECRET as string,
    "JWT_EXPIRES_IN": process.env.JWT_EXPIRES_IN as string,
    "REFRESH_TOKEN_SECRET": process.env.REFRESH_TOKEN_SECRET as string,
    "REFRESH_TOKEN_EXPIRES_IN": process.env.REFRESH_TOKEN_EXPIRES_IN as string,
}

const environmentVariables = () => {
    for (const [key, value] of Object.entries(envVariables)) {
        if (!value) {
            throw new Error(`Missing environment variable: ${key}`);
        }
    }
    return envVariables;
}

export const envVars = environmentVariables();