import { starknet } from "hardhat";

export const OZ_ACCOUNT_ADDRESS = ensureEnvVar("OZ_ACCOUNT_ADDRESS");
export const OZ_ACCOUNT_PRIVATE_KEY = ensureEnvVar("OZ_ACCOUNT_PRIVATE_KEY");

export function ensureEnvVar(varName: string): string {
    if (!process.env[varName]) {
        throw new Error(`Env var ${varName} not set or empty`);
    }
    return process.env[varName] as string;
}

/**
 * Returns an instance of OZAccount. Expected to be deployed)
 */
export async function getOZAccount() {
    return await starknet.OpenZeppelinAccount.getAccountFromAddress(
        OZ_ACCOUNT_ADDRESS,
        OZ_ACCOUNT_PRIVATE_KEY
    );
}

