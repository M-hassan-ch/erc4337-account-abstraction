import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    const minimalAccount = await ethers.deployContract(
        "Counter",
        [],
        deployer
    );
    await minimalAccount.waitForDeployment();

    console.log("Counter:", await minimalAccount.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
