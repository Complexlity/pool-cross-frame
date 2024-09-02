import z from "zod";
import dotenv from "dotenv";
import { base, arbitrum, optimism } from "viem/chains";
import { Address } from "viem/accounts";

dotenv.config();

const configSchema = z.object({
  GLIDE_PROJECT_ID: z.string(),
});

export const vaultList = [
  {
    chainId: optimism.id,
    chainName: optimism.name,
    address: "0x03D3CE84279cB6F54f5e6074ff0F8319d830dafe" as Address,
  },

  {
    chainId: base.id,
    chainName: base.name,
    address: "0x7f5C2b379b88499aC2B997Db583f8079503f25b9" as Address,
  },
  {
    chainId: arbitrum.id,
    chainName: arbitrum.name,
    address: "0x3c72A2A78C29D1f6454CAA1bcB17a7792a180a2e" as Address,
  },
];

export const config = configSchema.parse(process.env);
