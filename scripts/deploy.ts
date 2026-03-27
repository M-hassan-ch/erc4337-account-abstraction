import { ethers } from "hardhat";

async function main() {
    const contractName = process.env.CONTRACT_NAME!;
    const [deployer] = await ethers.getSigners();
    let deployed;
    if (contractName === "SmartAccount") {
        const entryPoint = process.env.ENTRYPOINT_ADDRESS
            ? ethers.getAddress(process.env.ENTRYPOINT_ADDRESS)
            : ethers.ZeroAddress;
        if (entryPoint === ethers.ZeroAddress) {
            console.warn(
                "ENTRYPOINT_ADDRESS unset — using address(0). Set ENTRYPOINT_ADDRESS when you need real validation."
            );
        }
        deployed = await ethers.deployContract(
            contractName,
            [entryPoint],
            deployer
        );
    } else {
        deployed = await ethers.deployContract(contractName, [], deployer);
    }
    await deployed.waitForDeployment();
    console.log(`${contractName}:`, await deployed.getAddress());
}

main();