import { useCallback, useMemo, useState } from "react";
import React from "react";
import Web3 from "web3";
import { AbiItem } from "web3-utils";
import verifyAccount from "web3/utils/verifyAccount";

import showToast from "@lib/notification";

import { Button } from "@components/ui/Button";

import { useContracts } from "../contexts/contractsContext";
import genericAbi from "../web3/abis/abiWithGetBalance.json";

interface Window {
  ethereum: any;
  web3: Web3;
}

interface EvtsToVerify {
  [eventId: string]: boolean;
}

declare const window: Window;

interface CryptoSectionProps {
  id: number | string;
  smartContractAddress: string;
  /** When set to true, there will be only 1 button which will both connect Metamask and verify the user's wallet. Otherwise, it will be in 2 steps with 2 buttons. */
  oneStep: boolean;
  verified: boolean | undefined;
  setEvtsToVerify: React.Dispatch<React.SetStateAction<Record<number | string, boolean>>>;
}

const CryptoSection = (props: CryptoSectionProps) => {
  // Crypto section which should be shown on booking page if event type requires a smart contract token.
  const [ethEnabled, toggleEthEnabled] = useState<boolean>(false);
  const { addContract } = useContracts();

  const connectMetamask = useCallback(async () => {
    if (window.ethereum) {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      window.web3 = new Web3(window.ethereum);
      toggleEthEnabled(true);
    } else {
      toggleEthEnabled(false);
    }
  }, []);

  const verifyWallet = useCallback(async () => {
    try {
      const contract = new window.web3.eth.Contract(genericAbi as AbiItem[], props.smartContractAddress);
      const balance = await contract.methods.balanceOf(window.ethereum.selectedAddress).call();

      const hasToken = balance > 0;

      if (!hasToken) {
        throw new Error("Specified wallet does not own any tokens belonging to this smart contract");
      } else {
        const account = (await web3.eth.getAccounts())[0];

        const signature = await web3.eth.personal.sign(process.env.NEXT_PUBLIC_WEB3_AUTH_MSG, account);
        addContract({ address: props.smartContractAddress, signature });

        await verifyAccount(signature, account);

        props.setEvtsToVerify((prevState: EvtsToVerify) => {
          const changedEvt = { [props.id]: hasToken };
          return { ...prevState, ...changedEvt };
        });
      }
    } catch (err) {
      err instanceof Error ? showToast(err.message, "error") : showToast("An error has occurred", "error");
    }
  }, [props, addContract]);

  // @TODO: Show error on either of buttons if fails. Yup schema already contains the error message.
  const successButton = useMemo(() => {
    return (
      <Button type="button" disabled>
        Success!
      </Button>
    );
  }, []);

  const verifyButton = useMemo(() => {
    return (
      <Button color="secondary" onClick={verifyWallet} type="button" id="hasToken" name="hasToken">
        <img className="h-5 mr-1" src="/integrations/metamask.svg" /> Verify wallet
      </Button>
    );
  }, [verifyWallet]);

  const connectButton = useMemo(() => {
    return (
      <Button color="secondary" onClick={connectMetamask} type="button">
        <img className="h-5 mr-1" src="/integrations/metamask.svg" />
        Connect Metamask
      </Button>
    );
  }, [connectMetamask]);

  const oneStepButton = useMemo(() => {
    return (
      <Button
        color="secondary"
        type="button"
        onClick={async () => {
          await connectMetamask();
          await verifyWallet();
        }}>
        <img className="h-5 mr-1" src="/integrations/metamask.svg" />
        Verify Wallet
      </Button>
    );
  }, [connectMetamask, verifyWallet]);

  const determineButton = useCallback(() => {
    // Did it in an extra function for some added readability, but this can be done in a ternary depending on preference
    if (props.oneStep) {
      return props.verified ? successButton : oneStepButton;
    } else {
      if (ethEnabled) {
        return props.verified ? successButton : verifyButton;
      } else {
        return connectButton;
      }
    }
  }, [props.verified, successButton, oneStepButton, connectButton, ethEnabled, props.oneStep, verifyButton]);

  return (
    <div
      className="absolute transition-opacity transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 top-1/2 left-1/2 "
      id={`crypto-${props.id}`}>
      {determineButton()}
    </div>
  );
};

export default CryptoSection;
