import { assert } from 'node:console';
import { ethers } from 'hardhat';
import { SampleEntryPoint } from '../typechain-types';

async function handleOps(signer: any, contract: SampleEntryPoint, userOps: any, beneficiery: any) {
    try {
        await contract.connect(signer).handleOps(userOps, beneficiery);
    } catch (error) {
        console.log(error);
    }
}

async function main() {
    const smartAccountAddress = "0xc5a5C42992dECbae36851359345FE25997F5C42d";
    const counterAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    const entryPointAddress = process.env.ENTRYPOINT_ADDRESS!;
    const USER_OP_SIGNER_KEY = process.env.USER_OP_SIGNER_PRIVATE_KEY!;

    if (!USER_OP_SIGNER_KEY) {
        throw new Error("USER_OP_SIGNER_KEY required");
    }

    const smartAccountContract = await ethers.getContractAt("SmartAccount", smartAccountAddress);
    const counterContract = await ethers.getContractAt("Counter", counterAddress);
    const entryPointContract = await ethers.getContractAt("SampleEntryPoint", entryPointAddress);

    const [signer, bundler, i] = await ethers.getSigners();
    const userOpSigner = new ethers.Wallet(USER_OP_SIGNER_KEY, ethers.provider);
    const userOpSignerBalance = await ethers.provider.getBalance(userOpSigner);
    console.log("Balance of signer initialing gasless transaction: ", ethers.formatEther(userOpSignerBalance).toString());

    const endUserAddress = await userOpSigner.getAddress();
    const bundlerAddress = await bundler.getAddress();
    // const signerAddress = await signer.getAddress();

    const newValue = 100;
    const functionCallData = counterContract.interface.encodeFunctionData("updateTo", [
        newValue,
    ]);
    const executeCalldata = smartAccountContract.interface.encodeFunctionData("execute", [
        counterAddress,
        0n,
        functionCallData
    ]);

    // 1. Get digest to sign
    console.log("1. Getting digest to sign...")
    const _nonce = await entryPointContract.getNonce(smartAccountAddress, 0);
    console.log("nonce: ", _nonce);

    const [digest, unSignedUserOp] = await smartAccountContract.getUserOpDigest(
        executeCalldata,
        smartAccountAddress,
        _nonce,
    )
    //
    const { sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData, signature } = unSignedUserOp;
    const _unSignedUserOp = {
        sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData, signature
    }
    const opHash = await entryPointContract.getUserOpHash(_unSignedUserOp);


    // 2. Sign
    console.log("2. Signing the digest...")
    const hexSig = await userOpSigner.signMessage(ethers.getBytes(opHash))
    const sig = ethers.Signature.from(hexSig);
    const r = sig.r;
    const s = sig.s;
    const v = sig.v;

    // 3. Get Signed UserOp
    console.log("3. Verifying the signature...")
    const signedUserOp = await smartAccountContract.generateSignedUserOp(_unSignedUserOp, r, s, v);
    const rawUserOpHash = await entryPointContract.getUserOpHash(_unSignedUserOp);
    const formattedMesageHash = await smartAccountContract.formatHash(rawUserOpHash);

    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(rawUserOpHash), signedUserOp.signature);
    console.log({
        signer: endUserAddress,
        recoveredSignerAddress: recoveredAddress
    });
    assert(endUserAddress.toLowerCase() == recoveredAddress.toLowerCase(), "Recovered signer did'nt matched with the actual signer");

    // 4. Initiating the transaction through ALT-Mempool/Bundler
    const balanceBefore = await ethers.provider.getBalance(smartAccountAddress);
    const valueBefore = await counterContract.value();

    // await smartAccountContract.connect(i).transferOwnership(await userOpSigner.getAddress());
    // const tx = await signer.sendTransaction({
    //     to: smartAccountAddress,
    //     value: ethers.parseUnits("1", "ether")
    // })
    // await tx.wait();
    // console.log(await smartAccountContract.owner());


    await handleOps(bundler, entryPointContract, [{
        ..._unSignedUserOp,
        signature: signedUserOp.signature
    }], bundlerAddress);
    // await entryPointContract.connect(bundler).handleOps([{
    //     ..._unSignedUserOp,
    //     signature: signedUserOp.signature
    // }], bundlerAddress);

    const balanceAfter = await ethers.provider.getBalance(smartAccountAddress);
    const valueAfter = await counterContract.value();
    const balanceDifference = balanceBefore - balanceAfter;
    console.log("Value before: ", valueBefore.toString());
    console.log("Value After: ", valueAfter.toString());
    console.log("Balance before: ", ethers.formatEther(balanceBefore));
    console.log("Balance after: ", ethers.formatEther(balanceAfter));
    console.log("Balance changes", ethers.formatEther(balanceDifference))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });