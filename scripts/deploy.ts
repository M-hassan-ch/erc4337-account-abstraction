import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

async function deployContract(contractName: string, params: any[], signer: HardhatEthersSigner) {
    const tx = await ethers.deployContract(
        contractName,
        params,
        signer
    );
    const deployed = await tx.waitForDeployment();
    const contractAddress = await deployed.getAddress();
    console.log(`${contractName}: `, contractAddress);
    return contractAddress;
}

async function main() {
    const ENTRYPOINT_CONTRACT_NAME = "SampleEntryPoint";
    const SMART_ACCOUNT_CONTRACT_NAME = "SmartAccount";
    const COUNTER_CONTRACT_NAME = "Counter";

    const entryPointAddress = process.env.ENTRYPOINT_ADDRESS!;
    const counterAddress = process.env.COUNTER_ADDRESS!;
    const smartAccountAddress = process.env.SMART_ACCOUNT_ADDRESS!;
    const user_op_signer_key = process.env.USER_OP_SIGNER_PRIVATE_KEY!;

    if (!user_op_signer_key) {
        throw new Error("USER_OP_SIGNER_PRIVATE_KEY is required");
    }

    const [deployer] = await ethers.getSigners();
    let newEntryPointAddress: string | undefined = undefined;

    if (!entryPointAddress) {
        newEntryPointAddress = await deployContract(ENTRYPOINT_CONTRACT_NAME, [], deployer);
    } else {
        console.log(`${ENTRYPOINT_CONTRACT_NAME} contract address already exists in ENV`);
    }

    if (!counterAddress) {
        await deployContract(COUNTER_CONTRACT_NAME, [], deployer);
    } else {
        console.log(`${COUNTER_CONTRACT_NAME} contract address already exists in ENV`);
    }

    if (!smartAccountAddress) {
        const userOpSigner = new ethers.Wallet(user_op_signer_key);
        const userOpSignerAddress = await userOpSigner.getAddress();
        const entryPointAddr = newEntryPointAddress || entryPointAddress || ethers.ZeroAddress;
        if (entryPointAddr == ethers.ZeroAddress) {
            console.warn(
                "ENTRYPOINT_ADDRESS unset — using address(0). Set ENTRYPOINT_ADDRESS when you need real validation."
            );
        }
        await deployContract(SMART_ACCOUNT_CONTRACT_NAME, [userOpSignerAddress, entryPointAddr], deployer);
    } else {
        console.log(`${SMART_ACCOUNT_CONTRACT_NAME} contract address already exists in ENV`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });