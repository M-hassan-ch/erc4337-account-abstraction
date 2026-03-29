import { assert } from 'node:console';
import { ethers } from 'hardhat';

function getEncodedSignature(r: string, s: string, v: number): string {
    const types = ["bytes32", "bytes32", "uint8"];
    const values = [r, s, v];
    const encodedSig = ethers.solidityPacked(types, values);
    return encodedSig;
}

async function main() {
    const smartAccountAddress = process.env.SMART_ACCOUNT_ADDRESS!;
    const counterAddress = process.env.COUNTER_ADDRESS!;
    const entryPointAddress = process.env.ENTRYPOINT_ADDRESS!;
    const user_op_signer_key = process.env.USER_OP_SIGNER_PRIVATE_KEY!;

    if (!user_op_signer_key) {
        throw new Error("USER_OP_SIGNER_KEY required");
    }
    if (!smartAccountAddress || !counterAddress || !entryPointAddress) {
        throw new Error("SMART_ACCOUNT_ADDRESS, COUNTER_ADDRESS, ENTRYPOINT_ADDRESS required");
    }

    const smartAccountContract = await ethers.getContractAt("SmartAccount", smartAccountAddress);
    const counterContract = await ethers.getContractAt("Counter", counterAddress);
    const entryPointContract = await ethers.getContractAt("SampleEntryPoint", entryPointAddress);

    const [bundler] = await ethers.getSigners();
    const userOpSigner = new ethers.Wallet(user_op_signer_key, ethers.provider);
    const userOpSignerBalance = await ethers.provider.getBalance(userOpSigner);
    const userOpSignerAddress = await userOpSigner.getAddress();
    const bundlerAddress = await bundler.getAddress();

    console.log("Balance of signer initialing gasless transaction: ", ethers.formatEther(userOpSignerBalance).toString());

    // Preparing calldata for counter.updateTo(value)
    const newValue = 386;
    const functionCallData = counterContract.interface.encodeFunctionData("updateTo", [
        newValue,
    ]);
    const executeCalldata = smartAccountContract.interface.encodeFunctionData("execute", [
        counterAddress,
        0n,
        functionCallData
    ]);

    // 1. Prepare unsigned UserOp to sign
    console.log("1. Getting unsigned UserOp to sign...")
    const smartAccountNonce = await entryPointContract.getNonce(smartAccountAddress, 0);
    const unSignedUserOp = await smartAccountContract.getUnSignedUserOp(
        executeCalldata,
        smartAccountAddress,
        smartAccountNonce,
    )

    const { sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData, signature } = unSignedUserOp;
    const _unSignedUserOp = { // Extra step, cannot pass `unSignedUserOp` as it is
        sender, nonce, initCode, callData, accountGasLimits, preVerificationGas, gasFees, paymasterAndData, signature
    }
    const opHash = await entryPointContract.getUserOpHash(_unSignedUserOp);


    // 2. Sign
    console.log("2. Signing the UserOp...")
    const hexSig = await userOpSigner.signMessage(ethers.getBytes(opHash))
    const sig = ethers.Signature.from(hexSig);
    const r = sig.r;
    const s = sig.s;
    const v = sig.v;
    const encodedSig = getEncodedSignature(r, s, v);

    // 3. Verifying signature
    /*
        Note: 
        - getEncodedSignature(), smartAccountContract.getSignedUserOp(), hexSig 
        - All of the above return the same hash, iam using encodedSig just to be on a safer side
    */
    console.log("3. Verifying the signature...")
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(opHash), encodedSig);
    console.log({
        signer: userOpSignerAddress,
        recoveredSignerAddress: recoveredAddress
    });
    assert(userOpSignerAddress.toLowerCase() == recoveredAddress.toLowerCase(), "Recovered signer did'nt matched with the actual signer");

    // 5. Initiating the transaction through ALT-Mempool/Bundler on the behalf of `userOpSigner`
    const paymasterBalanceBefore = await ethers.provider.getBalance(smartAccountAddress);
    const bundlerBalanceBefore = await ethers.provider.getBalance(bundlerAddress);
    const valueBefore = await counterContract.value();

    const tx = await entryPointContract.connect(bundler).handleOps([{
        ..._unSignedUserOp,
        signature: encodedSig
    }], bundlerAddress);
    await tx.wait();

    const paymasterBalanceAfter = await ethers.provider.getBalance(smartAccountAddress);
    const bundlerBalanceAfter = await ethers.provider.getBalance(bundlerAddress);
    const valueAfter = await counterContract.value();
    const paymasterBalanceDifference = paymasterBalanceAfter - paymasterBalanceBefore;
    const bundlerBalanceDifference = bundlerBalanceAfter - bundlerBalanceBefore;

    console.log('----------------------------------------');
    console.log("Counter Value before: ", valueBefore.toString());
    console.log("Counter Value After: ", valueAfter.toString());
    console.log("Counter Value Expected: ", newValue.toString());
    console.log('----------------------------------------');
    console.log("Paymaster Balance before: ", ethers.formatEther(paymasterBalanceBefore));
    console.log("Paymaster Balance after: ", ethers.formatEther(paymasterBalanceAfter));
    console.log("Paymaster Balance changes", ethers.formatEther(paymasterBalanceDifference));
    console.log('----------------------------------------');
    console.log("Bundler Balance before: ", ethers.formatEther(bundlerBalanceBefore));
    console.log("Bundler Balance after: ", ethers.formatEther(bundlerBalanceAfter));
    console.log("Bundler Balance changes", ethers.formatEther(bundlerBalanceDifference));
    console.log('----------------------------------------');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });