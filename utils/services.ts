import { Chain, Config, createGlideConfig } from "@paywithglide/glide-js";
import { arbitrum } from "viem/chains";
import { config } from "./config.js";
import uniFarcasterSdk from "uni-farcaster-sdk";

const projectId = config.GLIDE_PROJECT_ID;
if (!projectId) throw new Error("Glide project ID is required in .env");

const GLIDE_CONFIG: Config<readonly Chain[]> = createGlideConfig({
  projectId,
  chains: [arbitrum],
});

export const sdkInstance = new uniFarcasterSdk({
  ...(config.NEYNAR_API_KEY && { neynarApiKey: config.NEYNAR_API_KEY }),
  debug: process.env.NODE_ENV === "development",
});

export { GLIDE_CONFIG };
