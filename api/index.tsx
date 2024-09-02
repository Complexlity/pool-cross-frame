import { Button, Frog, TextInput } from "frog";
import fs from "fs";
import { vaultABI } from "@generationsoftware/hyperstructure-client-js";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
// import { neynar } from 'frog/hubs'
import { handle } from "frog/vercel";
import { GLIDE_CONFIG } from "../utils/services.js";
import {
  CAIP19,
  createSession,
  executeSession,
  getSessionById,
  listPaymentOptions,
  PaymentOption,
  updatePaymentTransaction,
} from "@paywithglide/glide-js";
import { vaultList } from "../utils/config.js";
import { hexToBigInt, parseUnits } from "viem";
import { Address } from "viem/accounts";
import dummyPaymentJson from "./paymentOptions.json";
import { parse } from "dotenv";
import { UserOperationNotFoundError } from "viem/account-abstraction";
// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

export const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
  title: "Frog Frame",
});

app.frame("/", (c) => {
  const { buttonValue, inputText, status } = c;
  const fruit = inputText || buttonValue;
  return c.res({
    image: (
      <div tw="bg-purple-500 items-center flex flex-col justify-center text-center w-full h-full px-4">
        <p tw="text-white text-8xl">
          Deposit into pool together protocol with arbitrum tokens
        </p>
      </div>
    ),
    intents: [
      <Button action="/test">przUSDC OP</Button>,
      <Button value="oranges">przUSDC BASE</Button>,
      <Button value="bananas">przUSDC ARB</Button>,
      status === "response" && <Button.Reset>Reset</Button.Reset>,
    ],
  });
});

app.frame("/test", async (c) => {
  const vault = vaultList[2];
  const userAddress = "0x8ff47879d9eE072b593604b8b3009577Ff7d6809" as Address;
  const amount = parseUnits("1", 6);
  // const paymentOptions = await listPaymentOptions(GLIDE_CONFIG, {
  //   chainId: vault.chainId,
  //   account: userAddress,
  //   abi: vaultABI,
  //   address: vault.address,
  //   args: [amount, userAddress],
  //   functionName: "deposit",
  // });

  const paymentOptions = dummyPaymentJson.slice(0, 4) as PaymentOption[];

  return c.res({
    image: (
      <div tw="bg-green-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
        Depositing into prz
      </div>
    ),
    action: "/payment",
    intents: [
      <TextInput placeholder="Enter the amount" />,
      ...paymentOptions.map((option) => (
        <Button value={`${option.paymentCurrency}`}>
          {option.currencySymbol}
        </Button>
      )),
    ],
  });
});

// app.frame("/final", async (c) => {
app.frame("/payment", async (c) => {
  const { buttonValue, inputText } = c;
  console.log("I got here");
  const paymentCurrency = buttonValue;
  let amount = Number(inputText);
  const paymentOptions = dummyPaymentJson.slice(0, 4) as PaymentOption[];
  const vault = vaultList[2];
  if (!amount) amount = 10;
  const dummyDepositAmount = parseUnits(`${amount}`, 6);
  const userAddress = "0x8ff47879d9eE072b593604b8b3009577Ff7d6809" as Address;
  if (!vault) {
    return c.error({ message: "Invalid payment currency" });
  }

  const parameters = {
    //Actual payment amount that is used by glide
    paymentAmount: Number(amount),
    chainId: vault.chainId,
    account: userAddress as Address,
    abi: vaultABI,
    address: vault?.address as Address,
    args: [dummyDepositAmount, userAddress as Address],
    functionName: "deposit",
    paymentCurrency: paymentCurrency as CAIP19,
  };

  const session = await createSession(GLIDE_CONFIG, parameters);
  const tx = session.unsignedTransaction;
  if (!tx) return c.error({ message: "No transaction found" });

  return c.res({
    image: (
      <div tw="bg-green-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
        Paying with {paymentCurrency}
      </div>
    ),
    action: `/final/${session.sessionId}`,
    intents: [
      <Button action="/test">Back</Button>,
      <Button.Transaction target={`/send-tx/${session.sessionId}`}>
        Confirm Session
      </Button.Transaction>,
    ],
  });
});

app.frame("/final/:sessionId/", async (c) => {
  const { transactionId, buttonValue } = c;

  const { sessionId } = c.req.param();

  // The payment transaction hash is passed with transactionId if the user just completed the payment. If the user hit the "Refresh" button, the transaction hash is passed with buttonValue.
  const txHash = transactionId || buttonValue;

  if (!txHash) {
    return c.error({
      message: "Missing transaction hash, please try again.",
    });
  }

  try {
    // Check if the session is already completed
    const { success } = await updatePaymentTransaction(GLIDE_CONFIG, {
      sessionId: sessionId,
      hash: txHash as `0x${string}`,
    });

    if (!success) {
      throw new Error("failed to update payment transaction");
    }

    // Get the current session state
    const session = await getSessionById(GLIDE_CONFIG, sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // If the session has a sponsoredTransactionHash, it means the transaction is complete
    if (session.sponsoredTransactionHash) {
      return c.res({
        image: (
          <div tw="bg-green-500 items-center flex flex-col justify-center text-center w-full h-full px-4"></div>
        ),
        intents: [
          <Button.Link
            href={`https://arbiscan.io/tx/${session.sponsoredTransactionHash}`}
          >
            View on Explorer
          </Button.Link>,
        ],
      });
    } else {
      // If the session does not have a sponsoredTransactionHash, the payment is still pending
      return c.res({
        image: (
          <div tw="bg-amber-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
            <p>Processing...</p>
          </div>
        ),
        intents: [
          <Button value={txHash} action={`/final/${sessionId}`}>
            Refresh
          </Button>,
        ],
      });
    }
  } catch (e) {
    console.error("Error:", e);

    return c.res({
      image: (
        <div tw="bg-amber-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
          <p>Processing...</p>
        </div>
      ),
      intents: [
        <Button value={txHash} action={`/final/${sessionId}`}>
          Refresh
        </Button>,
      ],
    });
  }
});

app.transaction("/send-tx/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const { unsignedTransaction } = await getSessionById(GLIDE_CONFIG, sessionId);
  if (!unsignedTransaction) {
    throw new Error("missing unsigned transaction");
  }

  return c.send({
    chainId: unsignedTransaction.chainId as any,
    to: unsignedTransaction.to || undefined,
    data: unsignedTransaction.input || undefined,
    value: hexToBigInt(unsignedTransaction.value),
  });
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
