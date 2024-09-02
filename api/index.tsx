import { vaultABI } from "@generationsoftware/hyperstructure-client-js";
import { Button, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
// import { neynar } from 'frog/hubs'
import {
  CAIP19,
  createSession,
  getSessionById,
  listPaymentOptions,
  PaymentOption,
  updatePaymentTransaction,
} from "@paywithglide/glide-js";
import { handle } from "frog/vercel";
import { hexToBigInt, parseUnits } from "viem";
import { Address } from "viem/accounts";
import { vaultList } from "../utils/config.js";
import { GLIDE_CONFIG } from "../utils/services.js";
import dummyPaymentJson from "./paymentOptions.json";

type State = {
  vault: (typeof vaultList)[number];
  userAddress: Address | null;
  paymentOptions: {
    [key: string]: { balance: number; currencySymbol: string };
  } | null;
};
export const app = new Frog<{ State: State }>({
  assetsPath: "/",
  basePath: "/api",
  initialState: {
    vault: vaultList[0],
    userAddress: null,
    paymentOptions: null,
  },
  title: "Frog Frame",
});

app.frame("/", (c) => {
  return c.res({
    image: (
      <div tw="bg-purple-500 items-center flex flex-col justify-center text-center w-full h-full px-4">
        <p tw="text-white text-8xl">
          Deposit into pool together protocol with arbitrum tokens
        </p>
      </div>
    ),
    action: "/vaults",
    intents: [
      <Button value={"0"}>przUSDC OP</Button>,
      <Button value={"1"}>przUSDC BASE</Button>,
      <Button value={"2"}>przUSDC ARB</Button>,
    ],
  });
});

app.frame("/vaults", async (c) => {
  const { buttonIndex, deriveState, previousState, buttonValue } = c;
  const value = Number(buttonValue);
  let vault = previousState.vault;
  if (value && !isNaN(value)) {
    vault = vaultList[value];
    deriveState((state) => {
      state.vault = vault;
    });
  }
  const userAddress = previousState.userAddress;
  if (!userAddress) return c.error({ message: "No user address found" });
  const amount = parseUnits("1", 6);
  let paymentOptions = await listPaymentOptions(GLIDE_CONFIG, {
    chainId: vault.chainId,
    account: userAddress,
    abi: vaultABI,
    address: vault.address,
    args: [amount, userAddress],
    functionName: "deposit",
  });

  paymentOptions = paymentOptions.slice(0, 4) as PaymentOption[];
  const statePaymentOptions = convertArrayToObject(paymentOptions);
  deriveState((state) => {
    state.paymentOptions = statePaymentOptions;
  });
  //Save payment options to state

  if (paymentOptions.length === 0) {
    return c.res({
      image: (
        <div tw="bg-amber-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
          <p>No payment options found</p>
          <p>Buy some arbitrum tokens (USDC, ARB, ETH, WETH)</p>
        </div>
      ),
      intents: [
        <Button action="/">Back</Button>,
        <Button action="/vaults">Purchase</Button>,
      ],
    });
  }
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
  const { buttonValue, inputText, previousState } = c;
  const paymentCurrency = buttonValue as CAIP19 | undefined;
  const paymentOptions = previousState.paymentOptions;
  const vault = previousState.vault;
  let amount = Number(inputText);
  const userAddress = previousState.userAddress;
  if (!userAddress) return c.error({ message: "No user address found" });

  if (!paymentCurrency)
    return c.error({ message: "No payment currency found" });
  if (!paymentOptions) return c.error({ message: "No payment options found" });

  const paymentOption = paymentOptions[paymentCurrency];
  if (!amount) amount = 10;
  //Default the amount to half the user's balance
  if (amount > paymentOption.balance) amount = paymentOption.balance / 2;
  const dummyDepositAmount = parseUnits(`${amount}`, 6);
  if (!vault) {
    return c.error({ message: "Invalid payment currency" });
  }

  const parameters = {
    //Actual payment amount that is used by glide
    paymentAmount: Number(amount),
    chainId: vault.chainId,
    account: userAddress,
    abi: vaultABI,
    address: vault.address,
    args: [dummyDepositAmount, userAddress],
    functionName: "deposit",
    paymentCurrency: paymentCurrency,
  };

  const session = await createSession(GLIDE_CONFIG, parameters);

  return c.res({
    image: (
      <div tw="bg-green-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
        Paying with {paymentCurrency}
      </div>
    ),
    action: `/final/${session.sessionId}`,
    intents: [
      <Button action="/vaults">Back</Button>,
      <Button.Transaction target={`/send-tx/${session.sessionId}`}>
        Confirm Session
      </Button.Transaction>,
    ],
  });
});

app.frame("/final/:sessionId/", async (c) => {
  const { transactionId, buttonValue, previousState } = c;
  const vault = previousState.vault;
  const explorerUrl = getExplorerLink(vault.chainId);

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
      console.log("failed to update payment transaction");
      return c.error({ message: "failed to update payment transaction" });
    }

    // Get the current session state
    const session = await getSessionById(GLIDE_CONFIG, sessionId);

    if (!session) {
      return c.error({ message: "Session not found" });
    }

    // If the session has a sponsoredTransactionHash, it means the transaction is complete
    if (session.sponsoredTransactionHash) {
      return c.res({
        image: (
          <div tw="bg-green-500 items-center flex flex-col justify-center text-center w-full h-full px-4"></div>
        ),
        intents: [
          <Button.Link
            href={`${explorerUrl}/${session.sponsoredTransactionHash}`}
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

function getExplorerLink(chainId: (typeof vaultList)[number]["chainId"]) {
  switch (chainId) {
    case 10:
      return "https://optimistic.etherscan.io/tx/";
    case 8453:
      return "https://basescan.org/tx/";
    case 42161:
      return "https://arbiscan.io/tx/";
    default:
      throw new Error("Invalid chain id");
  }
}

function convertArrayToObject(arr: PaymentOption[]) {
  return arr.reduce((acc, item) => {
    //@ts-expect-error
    acc[item.paymentCurrency] = {
      balance: Number(item.balance),
      currencySymbol: item.currencySymbol,
    };
    return acc;
  }, {}) as { [key: string]: { balance: number; currencySymbol: string } };
}

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
