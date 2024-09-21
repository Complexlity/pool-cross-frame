import z from "zod";
import dotenv from "dotenv";
import { base, arbitrum, optimism } from "viem/chains";
import { Address } from "viem/accounts";

dotenv.config();

const configSchema = z.object({
  GLIDE_PROJECT_ID: z.string(),
  NEYNAR_API_KEY: z.string().optional(),
  AIRSTACK_API_KEY: z.string().optional(),
});

export const vaultList = [
  {
    chainId: optimism.id,
    address: "0x03D3CE84279cB6F54f5e6074ff0F8319d830dafe" as Address,
    name: "przUSDC OP",
    title: "przUSDC on Optimism",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=029",
  },

  {
    chainId: base.id,
    address: "0x7f5C2b379b88499aC2B997Db583f8079503f25b9" as Address,
    name: "przUSDC BASE",
    title: "przUSDC on Base",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=029",
  },
  {
    chainId: arbitrum.id,
    address: "0x3c72A2A78C29D1f6454CAA1bcB17a7792a180a2e" as Address,
    name: "przUSDC ARB",
    title: "przUSDC on Arbitrum",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=029",
  },
  {
    chainId: optimism.id,
    address: "0x2998c1685E308661123F64B333767266035f5020" as Address,
    name: "przWETH OP",
    title: "przWETH on Optimism",
    logo: "https://basescan.org/token/images/weth_28.png",
  },

  {
    chainId: arbitrum.id,
    address: "0x7b0949204e7Da1B0beD6d4CCb68497F51621b574" as Address,
    name: "przWETH ARB",
    title: "przWETH on Arbitrum",
    logo: "https://basescan.org/token/images/weth_28.png",
  },
  {
    chainId: optimism.id,
    address: "0x1F16D3CCF568e96019cEdc8a2c79d2ca6257894E" as Address,
    name: "przLUSD OP",
    title: "przLUSD on Optimism",
    logo: "https://app.cabana.fi/icons/przLUSD.svg",
  },
  {
    chainId: optimism.id,
    address: "0x1F16D3CCF568e96019cEdc8a2c79d2ca6257894E" as Address,
    name: "przDAI OP",
    title: "przDAI on Optimism",
    logo: "https://app.cabana.fi/icons/przDAI.svg",
  },
  {
    chainId: optimism.id,
    address: "0x1F16D3CCF568e96019cEdc8a2c79d2ca6257894E" as Address,
    name: "przPOOL OP",
    title: "przPOOL on Optimism",
    logo: "https://app.cabana.fi/icons/przPOOL.svg",
  },
];

export const config = configSchema.parse(process.env);
