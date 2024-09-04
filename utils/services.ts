import { Chain, Config, createGlideConfig } from "@paywithglide/glide-js";
import { arbitrum } from "viem/chains";
import { config } from "./config.js";
import uniFarcasterSdk from "uni-farcaster-sdk";

// console.log("https://paywithglide.xyz/")
const projectId = config.GLIDE_PROJECT_ID;
if (!projectId) throw new Error("Glide project Id missing from .env");

const GLIDE_CONFIG: Config<readonly Chain[]> = createGlideConfig({
  projectId: projectId,
  chains: [arbitrum],
});

export const sdkInstance = new uniFarcasterSdk({
  debug: process.env.NODE_ENV === "development",
});

export { GLIDE_CONFIG };
