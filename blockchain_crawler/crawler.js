const Web3 = require("web3");
const pool = require("../blockchain_crawler/database");

const web3 = new Web3(
  "https://eth-mainnet.g.alchemy.com/v2/NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE"
);

// Events that are pre-defined in the ERC-721 interface
const events = [
  "Transfer(address,address,uint256)",
  "Approval(address,address,uint256)",
  "ApprovalForAll(address,address,bool)",
];

// Methods that are pre-defined in the ERC-721 interface
const funcs = [
  "balanceOf(address)",
  "ownerOf(uint256)",
  "safeTransferFrom(address,address,uint256,bytes)",
  "safeTransferFrom(address,address,uint256)",
  "transferFrom(address,address,uint256)",
  "approve(address,uint256)",
  "setApprovalForAll(address,bool)",
  "getApproved(uint256)",
  "isApprovedForAll(address,address)",
];

async function NFTCrawler() {
  const maxBlock = await web3.eth.getBlockNumber();

  for (let i = 13822622; i <= maxBlock; i++) {
    console.log(i);
    const currentBlock = await web3.eth.getBlock(i, true);
    const transactions = currentBlock.transactions;

    for (let transaction of transactions) {
      // When the "to" field of a transaction is null, it is a contract-deploying transaction
      if (transaction.to === null) {
        const receipt = await web3.eth.getTransactionReceipt(transaction.hash);
        const contractAddress = receipt.contractAddress;

        if (await isERC721(contractAddress)) {
          console.log(contractAddress);
          await pool.query(
            "INSERT INTO nft_collections (contractaddress, minedat) VALUES ($1,$2)",
            [contractAddress, i]
          );
        }
      }
    }
  }
}

/**
 * Checks if a contract is an ERC-721 contract
 *
 * @param {string}  contractAddress The address of a contract in the Ethereum blockcgain
 * @return {boolean} true if contract is an ERC-721 contract; otherwise, false
 */
async function isERC721(contractAddress) {
  // Obtaining the code stored at the contract address as a string of bytecode
  const code = await web3.eth.getCode(contractAddress);

  // Checking if the contract bytecode contains the event signature of all events defined in the ERC-721 interface
  for (let event of events) {
    // Computing event signature of each event
    const eventSig = web3.eth.abi.encodeEventSignature(event);
    if (code.indexOf(eventSig.slice(2, eventSig.length)) === -1) return false;
  }

  // Checking if the contract bytecode contains the method signature of all methods defined in the ERC-721 interface
  for (let func of funcs) {
    // Computing method signature of each method
    const funcSig = web3.eth.abi.encodeFunctionSignature(func);
    if (code.indexOf(funcSig.slice(2, funcSig.length)) === -1) return false;
  }

  return true;
}

NFTCrawler();
