import { vaultABI } from "@generationsoftware/hyperstructure-client-js";
import {
  CAIP19,
  createSession,
  getSessionById,
  listPaymentOptions,
  updatePaymentTransaction,
} from "@paywithglide/glide-js";
import { Button, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { handle } from "frog/vercel";
import { hexToBigInt, parseUnits } from "viem";
import { Address } from "viem/accounts";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import { config, vaultList } from "../utils/config.js";
import { GLIDE_CONFIG, sdkInstance } from "../utils/services.js";
``;

type State = {
  vault: (typeof vaultList)[number];
  uA: Address | null;
  pO: { symbol: string; logo: string; pC: CAIP19 }[];
  pOO: CAIP19[];
  dC: (typeof supportedChains)[number] | null;
};
export const app = new Frog<{ State: State }>({
  assetsPath: "/",
  basePath: "/api",
  ...(config.AIRSTACK_API_KEY
    ? {
        hub: {
          apiUrl: "https://hubs.airstack.xyz",
          fetchOptions: {
            headers: {
              "x-airstack-hubs": config.AIRSTACK_API_KEY,
              "Cache-Control": "max-age=4",
            },
          },
        },
      }
    : {}),
  initialState: {
    uA: null,
    vault: vaultList[0],
    pO: [],
    pOO: [],
    dC: null,
  },
  title: "Cross deposit into pool together",
});

const supportNetworks = {
  base: {
    ...base,
    // logo: "https://logo.synthfinance.com/base.org",
    logo: "https://tokenlogo.xyz/assets/chain/base.svg",
  },
  arbitrum: {
    ...arbitrum,
    // logo: "https://logo.synthfinance.com/arbitrum.io",
    logo: "https://tokenlogo.xyz/assets/chain/arbitrum.svg",
  },

  optimism: {
    ...optimism,
    logo: "https://tokenlogo.xyz/assets/chain/optimism.svg",
    // logo: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=033",
  },
  mainnet: {
    ...mainnet,
    logo: "https://logo.synthfinance.com/ethereum.org",
  },
} as const;

const supportedChains = Object.keys(supportNetworks).map((key) => {
  return key as keyof typeof supportNetworks;
});

app.frame("/", (c) => {
  const { deriveState } = c;
  //Always reset deposit chain on first page load
  deriveState((state) => {
    state.dC = null;
  });
  return c.res({
    image: "https://i.ibb.co/ggHZQ8r/start.png",
    action: "/vaults/1",
    intents: [
      ...vaultList.map((vault, index) => (
        <Button value={`${index}`}>{vault.name}</Button>
      )),
    ],
  });
});

app.frame("/vaults/:page", async (c) => {
  const { deriveState, previousState, buttonValue } = c;

  const value = Number(buttonValue);
  let depositChain = previousState.dC;
  const { frameData } = c;
  let uA = previousState.uA;
  if (!frameData) return c.error({ message: "No frame data found" });

  let pO = previousState.pO;
  let pOO = previousState.pOO;
  let page = Number(c.req.param("page"));
  if (isNaN(page)) page = 1;
  let vault = previousState.vault;

  if (
    page === 1 &&
    buttonValue &&
    !supportedChains.includes(buttonValue as (typeof supportedChains)[number])
  ) {
    if (value && !isNaN(value)) {
      vault = vaultList[value];
      deriveState((state) => {
        state.vault = vault;
      });
    }

    return c.res({
      image: (
        <div tw="absolute inset-0 flex flex-col items-center justify-center bg-[#21064e] p-6">
          <p
            tw="text-7xl font-bold text-center w-full mb-12 text-[#c8adff]"
            style={{ gap: "1rem" }}
          >
            What chain are you depositing from ?
          </p>
        </div>
      ),
      action: "/vaults/1",
      intents: [
        ...supportedChains.map((chain) => (
          <Button value={`${chain}`}>{`${chain[0].toUpperCase()}${chain.slice(
            1
          )}`}</Button>
        )),
      ],
    });
  }

  if (
    buttonValue &&
    supportedChains.includes(buttonValue as (typeof supportedChains)[number])
  ) {
    const state = deriveState((state) => {
      state.dC = buttonValue as (typeof supportedChains)[number];
    });
    depositChain = state.dC;
  }

  console.log({ dC: depositChain });
  if (!depositChain) {
    depositChain = "arbitrum";
  }

  let nextPage = page + 1;

  const { data: user, error: userError } = await sdkInstance.getUsersByFid([
    frameData.fid,
  ]);

  if (userError) {
    return c.error({ message: "Failed to get user" });
  }

  if (!uA) {
    uA = user[0].ethAddresses[0] as Address;
  }

  if (!uA) return c.error({ message: "No user address found" });

  const amount = parseUnits("1", 6);
  if (!pO || pOO.length === 0) {
    let glidepO = await listPaymentOptions(GLIDE_CONFIG, {
      chainId: vault.chainId,
      abi: vaultABI,
      address: vault.address,
      args: [amount, uA],
      functionName: "deposit",
      paymentChainIds: [supportNetworks[depositChain].id],
    });

    pO = glidepO
      .map((option) => {
        if (depositChain === "base") {
          const chosenOptions = [
            "USDC",
            "ETH",
            "HIGHER",
            "WETH",
            "MOXIE",
            "DEGEN",
            "USDGLO",
            "TN100X",
            "AERO",
          ];
          if (!chosenOptions.includes(option.currencySymbol)) {
            return null;
          }
        }
        return {
          symbol: option.currencySymbol,
          logo: option.currencyLogoUrl,
          pC: option.paymentCurrency,
        };
      })
      .filter((x) => x !== null);
    console.log(pO.length);

    pOO = pO.map((option) => option.pC);

    deriveState((state) => {
      state.pO = pO;
      state.pOO = pOO;
    });
  }

  const TOKENS_PER_PAGE = 2;
  const possibleNumberOfPages = Math.ceil(pOO.length / TOKENS_PER_PAGE);

  if (nextPage > possibleNumberOfPages) nextPage = 1;

  const displayedpO = paginate(pOO, Number(page), TOKENS_PER_PAGE);

  if (displayedpO.length === 0) {
    return c.res({
      image: (
        <div tw="bg-amber-700 items-center flex flex-col justify-center text-center w-full h-full px-4">
          <p>No payment options found</p>
          <p>Buy some arbitrum tokens (USDC, ARB, ETH, WETH)</p>
        </div>
      ),
      intents: [
        <Button.Reset>🏡</Button.Reset>,
        <Button action="/vaults/1">Purchase</Button>,
      ],
    });
  }
  return c.res({
    image: (
      <DepositingImage
        defaultTokens={pO}
        currentTokens={displayedpO}
        vaultTitle={vault.title}
      />
    ),
    action: "/payment",
    intents: [
      <TextInput placeholder="Enter the amount. Default: 1" />,
      <Button.Reset>🏡</Button.Reset>,
      ...displayedpO.map((displayedOption) => (
        <Button value={`${displayedOption}`}>
          {pO.find((option) => option.pC === displayedOption)!.symbol +
            ` (${depositChain}) `}
        </Button>
      )),
      <Button action={`/vaults/${nextPage}`}> ⏭️ </Button>,
    ],
  });
});

app.frame("/payment", async (c) => {
  const { buttonValue, inputText, previousState, frameData } = c;
  if (!frameData) return c.error({ message: "No frame data found" });
  const pC = buttonValue as CAIP19 | undefined;
  let uA = previousState.uA;
  const pO = previousState.pO;
  const vault = previousState.vault;
  let amount = Number(inputText);
  if (!amount) amount = 1;
  const { data: user, error: userError } = await sdkInstance.getUsersByFid([
    frameData.fid,
  ]);

  if (userError) {
    return c.error({ message: "Failed to get user" });
  }

  if (!uA) {
    uA = user[0].ethAddresses[0] as Address;
  }
  if (!uA) return c.error({ message: "No user address found" });

  if (!pC) return c.error({ message: "No payment currency found" });
  if (!pO) return c.error({ message: "No payment options found" });
  const dummyDepositAmount = parseUnits(`${amount}`, 6);
  if (!vault) {
    return c.error({ message: "Invalid payment currency" });
  }
  const depositChain = previousState.dC;
  if (!depositChain) return c.error({ message: "No deposit chain found" });
  const parameters = {
    //Actual payment amount that is used by glide
    paymentAmount: Number(amount),
    chainId: vault.chainId,
    abi: vaultABI,
    address: vault.address,
    args: [dummyDepositAmount, uA],
    functionName: "deposit",
    paymentCurrency: pC,
  };
  let session;
  try {
    session = await createSession(GLIDE_CONFIG, parameters);
  } catch (e) {
    console.log(e);
    return c.error({ message: "Failed to create session" });
  }

  const confirmImageProps = {
    inputLogo: session.paymentCurrencyLogoUrl,
    inputName: session.paymentCurrencySymbol,
    vaultLogo: vault.logo,
    vaultName: vault.title,
    amountIn: getRoundedDownFormattedTokenAmount(
      Number(session.sponsoredTransactionAmount)
    ),
    amountInUsd: getRoundedDownFormattedTokenAmount(
      Number(session.sponsoredTransactionAmountUSD)
    ),
    amountOut: getRoundedDownFormattedTokenAmount(
      Number(session.paymentAmount)
    ),
    amountOutUsd: getRoundedDownFormattedTokenAmount(
      Number(session.paymentAmountUSD)
    ),
    address: uA,
    depositChain,
  };

  return c.res({
    image: <ConfirmImage {...confirmImageProps} />,
    action: `/final/${session.sessionId}`,
    intents: [
      <Button action="/vaults/1">Back</Button>,
      <Button.Transaction target={`/send-tx/${session.sessionId}`}>
        Confirm Session
      </Button.Transaction>,
    ],
  });
});

app.frame("/final/:sessionId/", async (c) => {
  const { transactionId, buttonValue, previousState } = c;
  const vault = previousState.vault;
  const depositChain = previousState.dC;
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
      return c.error({ message: "failed to update payment transaction" });
    }

    // Get the current session state
    let session;
    try {
      session = await getSessionById(GLIDE_CONFIG, sessionId);
    } catch (error) {
      console.log(error);
      return c.error({ message: "failed to get session" });
    }

    if (!session) {
      return c.error({ message: "Session not found" });
    }

    // If the session has a sponsoredTransactionHash, it means the transaction is complete
    if (session.sponsoredTransactionHash) {
      const successImageProps = {
        inputName: session.paymentCurrencySymbol,
        vaultName: vault.name,
        amountIn: getRoundedDownFormattedTokenAmount(
          Number(session.sponsoredTransactionAmount)
        ),
        amountOut: getRoundedDownFormattedTokenAmount(
          Number(session.paymentAmount)
        ),
        depositChain: previousState.dC || "arbitrum",
      };

      return c.res({
        image: <SuccessImage {...successImageProps} />,
        intents: [
          <Button.Link
            href={`${explorerUrl}/${session.sponsoredTransactionHash}`}
          >
            View on Explorer
          </Button.Link>,
          <Button.Reset>🏡</Button.Reset>,
        ],
      });
    } else {
      // If the session does not have a sponsoredTransactionHash, the payment is still pending
      return c.res({
        image: "https://i.ibb.co/173F8hR/processing.gif",
        intents: [
          <Button value={txHash} action={`/final/${sessionId}`}>
            Refresh
          </Button>,
        ],
      });
    }
  } catch (e) {
    return c.res({
      image: <ErrorImage />,
      intents: [<Button.Reset>🏡</Button.Reset>],
    });
  }
});

app.transaction("/send-tx/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  let unsignedTransaction;
  try {
    let res = await getSessionById(GLIDE_CONFIG, sessionId);
    unsignedTransaction = res.unsignedTransaction;
  } catch (error) {
    console.log(error);
    return c.error({ message: "failed to get session" });
  }

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
      return "https://optimistic.etherscan.io/tx";
    case 8453:
      return "https://basescan.org/tx";
    case 42161:
      return "https://arbiscan.io/tx";
    default:
      throw new Error("Invalid chain id");
  }
}

function paginate<T>(array: T[], page: number, itemsPerPage: number): T[] {
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return array.slice(start, end);
}

function DepositingImage({
  defaultTokens,
  currentTokens,
  vaultTitle,
}: {
  defaultTokens: State["pO"];
  currentTokens: State["pOO"];
  vaultTitle: string;
}) {
  if (!defaultTokens) return null;

  return (
    <div tw="absolute inset-0 flex flex-col items-center justify-center bg-[#21064e] p-6">
      <p tw="text-6xl font-bold w-full flex justify-center text-center mb-12 text-[#c8adff]">
        Depositing into {vaultTitle}
      </p>
      <div
        tw="flex flex-wrap justify-center w-full px-8"
        style={{ gap: "2rem", flexWrap: "wrap" }}
      >
        {defaultTokens.map((token) => (
          <div
            tw={`flex items-center px-12 py-4 rounded-full text-5xl
              ${
                currentTokens.includes(token.pC)
                  ? "bg-[#03dd4d] text-[#21064e]"
                  : "bg-[#c8adff] text-[#21064e]"
              }
              `}
            style={{
              gap: "1rem",
            }}
          >
            <img tw="w-12 h-12" src={token.logo} />
            <span tw="font-semibold">{token.symbol}</span>
          </div>
        ))}
      </div>
      <span tw="absolute text-white text-4xl bottom-5 flex items-center">
        Click <span tw="text-[#03dd4d] font-bold mx-4">⏭️</span> to circle
        through possible tokens
      </span>
    </div>
  );
}

type ConfirmImageProps = {
  inputLogo: string;
  inputName: string;
  vaultLogo: string;
  vaultName: string;
  amountIn: string;
  amountInUsd: string;
  amountOut: string;
  amountOutUsd: string;
  address: Address;
  depositChain: NonNullable<State["dC"]>;
};

function ConfirmImage({
  inputLogo,
  inputName,
  vaultLogo,
  vaultName,
  amountIn,
  amountInUsd,
  amountOut,
  amountOutUsd,
  address,
  depositChain,
}: ConfirmImageProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        fontSize: 32,
        fontWeight: 600,
        padding: "10px 50px",
      }}
      tw="bg-[#21064e] text-white"
    >
      <span tw="text-5xl my-2 text-center flex justify-center text-[#c8adff] ">
        Preview Transaction{" "}
      </span>
      <div
        tw="flex items-center  mx-auto justify-between max-w-4/5 w-full flex-col"
        style={{
          gap: "10px",
        }}
      >
        <div tw="flex justify-between py-1  w-full">
          <span tw="text-center text-gray-500 flex text-white">From</span>
          <span tw="text-center text-gray-500 text-white">To</span>
        </div>
        <div tw="flex justify-between py-1 w-full">
          <div tw="rounded-full flex w-[100px] h-[100px] overflow-hidden ">
            <img
              src={inputLogo}
              width={"100%"}
              height={"100%"}
              style={{
                objectFit: "cover",
              }}
            />
          </div>
          {/* svg arrow was here */}
          <div tw="rounded-full flex w-[100px] h-[100px] overflow-hidden ">
            <img
              src={vaultLogo}
              width={"100%"}
              height={"100%"}
              style={{
                objectFit: "cover",
              }}
            />
          </div>
        </div>
        <div tw="flex w-full justify-between">
          <span>{inputName}</span>
          <span>{vaultName}</span>
        </div>
      </div>
      <hr tw="py-[1px] w-full bg-gray-800" />
      <div tw="flex justify-between py-2">
        <div tw="text-[#c8adff]">Purchase Amount</div>
        <div tw="flex text-4xl items-center" style={{ gap: "4px" }}>
          <span>{amountOut + " "}</span>
          <span tw="text-white">( ${amountOutUsd} )</span>
        </div>
      </div>
      <div tw="flex justify-between py-2">
        <span tw="text-[#c8adff]">Receiving Amount</span>
        <span tw="text-4xl flex" style={{ gap: "10px" }}>
          <span>{amountIn + " "}</span>
          <span tw="text-white"> ( ${amountInUsd} )</span>
        </span>
      </div>
      <div tw="flex justify-between py-2 items-center">
        <span tw="text-[#c8adff]">Receiving Address</span>
        <span style={{ gap: "4px" }} tw="flex items-center text-[#03dd4d] bold">
          <span>{address}</span>
        </span>
      </div>
      <div tw="flex justify-between py-2 items-center">
        <span tw="text-[#c8adff]">Chain</span>
        <span style={{ gap: "4px" }} tw="flex items-center">
          <img
            src={supportNetworks[depositChain].logo}
            width={50}
            height={50}
          />
          <span>{depositChain[0].toUpperCase() + depositChain.slice(1)}</span>
        </span>
      </div>
    </div>
  );
}

function ErrorImage() {
  return (
    <div tw="w-full flex flex-col h-full items-center justify-center bg-[#2d0a6a] rounded-lg p-8 shadow-lg">
      <div tw="flex flex-col items-center mb-6 text-red-500">
        <img
          src="https://i.ibb.co/rpnZ9gC/error-Icon.png"
          width="120"
          height="120"
        />

        <p tw="flex flex-col text-[#c8adff] text-8xl font-bold text-center mb-4">
          Transaction Failed
        </p>
      </div>

      <div tw="bg-[#3b1485] flex flex-col rounded-lg w-full items-center text-5xl">
        <p tw="text-[#c8adff]  text-center">
          We're sorry, but your transaction could not be completed at this time.
        </p>
      </div>
    </div>
  );
}
type SuccessImageProps = {
  inputName: string;
  vaultName: string;
  amountIn: string;
  amountOut: string;
  depositChain: string;
};

function SuccessImage({
  inputName,
  vaultName,
  amountIn,
  amountOut,
  depositChain,
}: SuccessImageProps) {
  return (
    <div tw="w-full flex flex-col h-full items-center justify-center bg-[#2d0a6a] rounded-lg p-8 shadow-lg">
      <div tw="flex flex-col items-center mb-6">
        <img
          src="https://i.ibb.co/1mTm3WQ/success-Icon.png"
          width="120"
          height="120"
        />

        <p tw="flex flex-col text-[#c8adff] text-6xl font-bold text-center mb-4">
          Transaction Success
        </p>
      </div>

      <div tw="bg-[#3b1485] flex flex-col flex-wrap justify-center rounded-lg w-full items-center text-[2.8rem] py-6 text-center">
        <span tw="text-[#c8adff] w-full text-center py-2 flex items-center  mx-auto justify-center">
          You sucessfully purchased{" "}
          <span tw="text-[#03dd4d] mx-4">
            {amountIn} {vaultName}
          </span>
        </span>
        <span tw="text-[#c8adff]  text-center py-2 flex items-center">
          for{" "}
          <span tw="mx-4 text-[#03dd4d]">
            {amountOut} {inputName} ({depositChain})
          </span>
        </span>
      </div>
    </div>
  );
}

export const getRoundedDownFormattedTokenAmount = (amount: number) => {
  const shiftedAmount = amount.toString();

  const fractionDigits = shiftedAmount.split(".")[1] ?? "";
  const numFractionLeadingZeroes = (fractionDigits.match(/^0+/) || [""])[0]
    .length;
  const maximumFractionDigits = Math.max(
    Math.min(numFractionLeadingZeroes + 1, 4),
    3
  );

  const roundingMultiplier = 10 ** maximumFractionDigits;
  const roundedAmount =
    Math.floor(parseFloat(shiftedAmount) * roundingMultiplier) /
    roundingMultiplier;

  return formatNumberForDisplay(roundedAmount, { maximumFractionDigits });
};

export const formatNumberForDisplay = (
  val: string | number | bigint,
  options: Intl.NumberFormatOptions & {
    locale?: string;
    round?: boolean;
    hideZeroes?: boolean;
    shortenMillions?: boolean;
  } = { locale: "en" }
) => {
  const { locale, round, hideZeroes, shortenMillions, ...formatOptions } =
    options;

  const format = (
    v: number,
    overrides?: {
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  ) => {
    return v.toLocaleString(locale || "en", {
      ...formatOptions,
      maximumFractionDigits:
        !!hideZeroes && overrides?.maximumFractionDigits === undefined
          ? v <= 1
            ? formatOptions.maximumFractionDigits
            : 0
          : overrides?.maximumFractionDigits ??
            formatOptions.maximumFractionDigits,
      minimumFractionDigits:
        !!hideZeroes && overrides?.minimumFractionDigits === undefined
          ? v <= 1
            ? formatOptions.minimumFractionDigits
            : 0
          : overrides?.minimumFractionDigits ??
            formatOptions.minimumFractionDigits,
    });
  };

  const formatShortened = (v: number) => {
    if (v < 1e6) return format(v);

    const numDigits = Math.floor(Math.abs(v)).toString().length;
    const maximumFractionDigits =
      numDigits === 7 || numDigits === 10
        ? 2
        : numDigits === 8 || numDigits === 11
        ? 1
        : 0;
    const newValue =
      Math.round(v / 10 ** (numDigits - 3)) / 10 ** maximumFractionDigits;
    const label = numDigits >= 10 ? "B" : "M";

    return (
      format(newValue, { minimumFractionDigits: 0, maximumFractionDigits }) +
      label
    );
  };

  let _val: number;

  if (val === undefined || val === null) {
    return "";
  } else if (typeof val === "number") {
    _val = val;
  } else if (typeof val === "string" || typeof val === "bigint") {
    _val = Number(val);
  } else {
    return "";
  }

  if (!!round) {
    _val = Math.round(_val);
  }

  if (!!shortenMillions) {
    return formatShortened(_val);
  }

  return format(_val);
};

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
