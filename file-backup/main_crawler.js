const Web3 = require("web3");
const CoinGecko = require("coingecko-api");
const { Network, Alchemy } = require("alchemy-sdk");
const pool = require("../blockchain_crawler/database");

const settings = {
  apiKey: "NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE",
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

const web3 = new Web3(
  "https://eth-mainnet.g.alchemy.com/v2/NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE"
);

const CoinGeckoClient = new CoinGecko();

async function createNFTCollectionMap(nfts) {
  const nftCollectionsMap = new Map();
  for (let nft of nfts) {
    const contractAddress = nft.contractaddress;

    if (!nftCollectionsMap.has(contractAddress)) {
      nftCollectionsMap.set(contractAddress, {
        tokensInfo: new Map(),
        creator: nft.creator,
        deployedAt: nft.blockdeployedat,
        name: nft.name,
      });
    }

    if (nft.tokenid !== null) {
      nftCollectionsMap.get(contractAddress).tokensInfo.set(nft.tokenid, {
        allTime: {
          salesCount: nft.salescountalltime,
          accumulatedValue: nft.accumulatedvaluealltime,
        },
        thirtyDays: {
          salesCount: nft.salescount30,
          accumulatedValue: nft.accumulatedvalue30,
        },
        sixtyDays: {
          salesCount: nft.salescount60,
          accumulatedValue: nft.accumulatedvalue60,
        },
        ninetyDays: {
          salesCount: nft.salescount90,
          accumulatedValue: nft.accumulatedvalue90,
        },

        owner: nft.owner,
        lastSoldPrice: nft.lastsoldprice,
        minedAt: nft.minedat,
        ownerHistory: nft.ownerhistory,
      });
    }
  }

  await pool.query("DELETE FROM nfts");
  await pool.query("DELETE FROM nftcollections");
  await pool.query("DELETE FROM nfts30days");
  await pool.query("DELETE FROM nfts60days");
  await pool.query("DELETE FROM nfts90days");
  await pool.query("DELETE FROM nftsalltime");

  return nftCollectionsMap;
}

async function NFTIndexer() {
  let currentNFTs = null;

  const response = await pool.query(
    " SELECT * FROM nfts NATURAL JOIN nfts30days NATURAL JOIN nfts60days NATURAL JOIN nfts90days NATURAL JOIN nftsalltime NATURAL RIGHT JOIN nftcollections;"
  );

  if (response.rowCount > 0) {
    currentNFTs = await createNFTCollectionMap(response.rows);
  }

  const [nftCollections, blocksInfo] = await NFTCrawler(currentNFTs);

  for (let [blockNo, blockInfo] of blocksInfo) {
    await pool.query("INSERT INTO blocks VALUES ($1, $2, $3)", [
      blockNo,
      blockInfo.dateMined,
      blockInfo.etherUsdRate,
    ]);
  }

  for (let [contractAddress, contractDetails] of nftCollections) {
    await pool.query("INSERT INTO nftcollections VALUES ($1,$2, $3, $4)", [
      contractAddress,
      contractDetails.creator,
      contractDetails.deployedAt,
      contractDetails.name,
    ]);

    //const attributesSummary = computeTraitsCount(contractDetails.tokensInfo);
    for (let [tokenID, tokenInfo] of contractDetails.tokensInfo) {
      const alltimeData = tokenInfo.allTime;
      const thirtydaysData = tokenInfo.thirtyDays;
      const sixtydaysData = tokenInfo.sixtyDays;
      const ninetydaysData = tokenInfo.ninetyDays;

      await pool.query("INSERT INTO nfts VALUES ($1,$2,$3,$4,$5, $6)", [
        contractAddress,
        tokenID,
        tokenInfo.lastSoldPrice,
        tokenInfo.owner,
        tokenInfo.minedAt,
        tokenInfo.ownerHistory,
      ]);

      await pool.query("INSERT INTO nftsalltime VALUES ($1,$2,$3,$4)", [
        contractAddress,
        tokenID,
        alltimeData.salesCount,
        alltimeData.accumulatedValue,
      ]);

      await pool.query("INSERT INTO nfts30days VALUES ($1,$2,$3,$4)", [
        contractAddress,
        tokenID,
        thirtydaysData.salesCount,
        thirtydaysData.accumulatedValue,
      ]);

      await pool.query("INSERT INTO nfts60days VALUES ($1,$2,$3,$4)", [
        contractAddress,
        tokenID,
        sixtydaysData.salesCount,
        sixtydaysData.accumulatedValue,
      ]);

      await pool.query("INSERT INTO nfts90days VALUES ($1,$2,$3,$4)", [
        contractAddress,
        tokenID,
        ninetydaysData.salesCount,
        ninetydaysData.accumulatedValue,
      ]);
    }
  }
}

async function NFTCrawler(currentNFTs) {
  let nftCollectionsMap = new Map();
  if (currentNFTs != null) {
    nftCollectionsMap = currentNFTs;
  }

  let blocksInfoMap = new Map();
  let crawlerDate = null;
  let currentRate = 0;
  let currentDate = new Date();

  const maxBlock = await web3.eth.getBlockNumber();
  for (let i = 15010001; i <= 15015000; i++) {
    console.log(i);
    const currentBlock = await web3.eth.getBlock(i, true);
    const minedDate = new Date(currentBlock.timestamp * 1000);

    if (!isSameDay(crawlerDate, minedDate)) {
      let response = await CoinGeckoClient.coins.fetchHistory("ethereum", {
        date: `${minedDate.getDate()}-${
          minedDate.getMonth() + 1
        }-${minedDate.getFullYear()}`,
        localization: false,
      });

      const marketData = response.data.market_data;
      currentRate = marketData ? marketData.current_price.usd : 0;
      crawlerDate = minedDate;
    }

    blocksInfoMap.set(i, { dateMined: minedDate, etherUsdRate: currentRate });
    const transactions = currentBlock.transactions;

    for (let transaction of transactions) {
      // When the "to" field of a transaction is null, it is a contract-deploying transaction
      if (transaction.to === null) {
        const receipt = await web3.eth.getTransactionReceipt(transaction.hash);
        const contractAddress = receipt.contractAddress;

        if (await isERC721(contractAddress)) {
          const contractMetadata = await alchemy.nft.getContractMetadata(
            contractAddress
          );

          if (contractMetadata.name === null || contractMetadata.name === "")
            continue;
          console.log(contractAddress);
          nftCollectionsMap.set(contractAddress, {
            tokensInfo: new Map(),
            creator: receipt.from,
            deployedAt: i,
            name: contractMetadata.name.toLowerCase(),
          });
        }
      }
    }

    // Retrieve the contract addresses of all ERC-721 contracts the crawler has discovered so far
    const addresses = Array.from(nftCollectionsMap.keys());

    if (addresses.length > 0) {
      // Obtaining all the Transfer events from the current block that is associated with the contract addresses
      const events = await web3.eth.getPastLogs({
        fromBlock: i,
        toBlock: i,
        address: addresses,
        topics: [
          web3.eth.abi.encodeEventSignature(
            "Transfer(address,address,uint256)"
          ),
        ],
      });

      for (let event of events) {
        /* 
          Crawler determines the address of the ERC-721 contract that has emitted a particular event,
          as well as the additional information such as the transaction that has captured this event, the sender and the receipient of
          the transaction
         */
        const sender = event.topics[1];
        const address = event.address;
        const reciever = event.topics[2];
        const transactionHash = event.transactionHash;
        const tokenID = web3.utils.hexToNumberString(event.topics[3]);

        // When the condition of the if-statement is true, the event indicates that a new NFT from a collection is minted
        if (
          sender ===
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          console.log(address + " " + tokenID);

          nftCollectionsMap.get(address).tokensInfo.set(tokenID, {
            allTime: {
              salesCount: 0,
              accumulatedValue: 0,
            },
            thirtyDays: {
              salesCount: 0,
              accumulatedValue: 0,
            },
            sixtyDays: {
              salesCount: 0,
              accumulatedValue: 0,
            },
            ninetyDays: {
              salesCount: 0,
              accumulatedValue: 0,
            },

            owner: reciever,
            lastSoldPrice: 0,
            minedAt: i,
            ownerHistory: [reciever],
          });
        } else {
          const transaction = await web3.eth.getTransaction(transactionHash);
          const tokenInfo = nftCollectionsMap
            .get(address)
            .tokensInfo.get(tokenID);
          const val = parseFloat(
            web3.utils.fromWei(transaction.value, "ether")
          );
          const dateDifference = Math.floor(
            (currentDate - minedDate) / (1000 * 60 * 60 * 24)
          );
          const allTime = tokenInfo.allTime;
          const thirtyDays = tokenInfo.thirtyDays;
          const sixtyDays = tokenInfo.sixtyDays;
          const ninetyDays = tokenInfo.ninetyDays;

          const ownerHistory = tokenInfo.ownerHistory;

          if (val > 0 && !ownerHistory.includes(reciever)) {
            allTime.accumulatedValue += val * currentRate;
            allTime.salesCount++;
            tokenInfo.lastSoldPrice = val * currentRate;

            if (dateDifference <= 30) {
              thirtyDays.accumulatedValue += val * currentRate;
              thirtyDays.salesCount++;
            }

            if (dateDifference <= 60) {
              sixtyDays.accumulatedValue += val * currentRate;
              sixtyDays.salesCount++;
            }

            if (dateDifference <= 90) {
              ninetyDays.accumulatedValue += val * currentRate;
              ninetyDays.salesCount++;
            }

            ownerHistory.push(reciever);
          }

          tokenInfo.owner = reciever;
        }
      }
    }
  }

  return [nftCollectionsMap, blocksInfoMap];
}

function isSameDay(crawlerDate, minedDate) {
  if (crawlerDate === null) return false;

  if (
    crawlerDate.getDate() === minedDate.getDate() &&
    crawlerDate.getMonth() === minedDate.getMonth() &&
    crawlerDate.getFullYear() === minedDate.getFullYear()
  )
    return true;

  return false;
}

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
