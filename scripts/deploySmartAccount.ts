import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    const entryPoint = process.env.ENTRYPOINT_ADDRESS
        ? ethers.getAddress(process.env.ENTRYPOINT_ADDRESS)
        : ethers.ZeroAddress;
    if (entryPoint === ethers.ZeroAddress) {
        console.warn(
            "ENTRYPOINT_ADDRESS unset — using address(0). Set ENTRYPOINT_ADDRESS to your chain's EntryPoint when you need real validation."
        );
    }

    const minimalAccount = await ethers.deployContract(
        "MinimalAccount",
        [entryPoint],
        deployer
    );
    await minimalAccount.waitForDeployment();

    console.log("MinimalAccount:", await minimalAccount.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
