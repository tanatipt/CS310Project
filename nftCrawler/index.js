const Web3 = require("web3");
const CoinGecko = require("coingecko-api");
const { Network, Alchemy } = require("alchemy-sdk");
const pool = require("./database");

const settings = {
  apiKey: "NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE",
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

const events = [
  "Transfer(address,address,uint256)",
  "Approval(address,address,uint256)",
  "ApprovalForAll(address,address,bool)",
];
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
        attributes: nft.attributes,
        ownerHistory: nft.ownerhistory,
        image: nft.imageurl,
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

      await pool.query(
        "INSERT INTO nfts VALUES ($1,$2,$3,$4,$5, $6, $7, $8, to_tsvector($9))",
        [
          contractAddress,
          tokenID,
          tokenInfo.lastSoldPrice,
          tokenInfo.owner,
          tokenInfo.minedAt,
          JSON.stringify(tokenInfo.attributes),
          tokenInfo.ownerHistory,
          tokenInfo.image,
          computeIndex(tokenInfo.attributes),
        ]
      );

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

  console.log(nftCollectionsMap);
  let blocksInfoMap = new Map();
  let crawlerDate = null;
  let currentRate = 0;
  let currentDate = new Date();

  const maxBlock = await web3.eth.getBlockNumber();
  for (let i = 15005001; i <= 15008000; i++) {
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
      if (transaction.to === null) {
        const receipt = await web3.eth.getTransactionReceipt(transaction.hash);
        const contractAddress = receipt.contractAddress;

        if (await isERC721(contractAddress)) {
          const contractMetadata = await alchemy.nft.getContractMetadata(
            contractAddress
          );
          console.log(contractAddress);
          nftCollectionsMap.set(contractAddress, {
            tokensInfo: new Map(),
            creator: receipt.from,
            deployedAt: i,
            name: contractMetadata.name.toLowerCase() || "unnamed",
          });
        }
      }
    }

    const addresses = Array.from(nftCollectionsMap.keys());

    if (addresses.length > 0) {
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
        const sender = event.topics[1];
        const address = event.address;
        const reciever = event.topics[2];
        const transactionHash = event.transactionHash;
        const tokenID = web3.utils.hexToNumberString(event.topics[3]);

        if (
          sender ===
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          console.log(address + " " + tokenID);
          let attributes = undefined;
          let image = undefined;

          /*
          const response = await alchemy.nft.getNftMetadata(address, tokenID);
          let image = response.rawMetadata.image;
          let attributes = response.rawMetadata.attributes;

          if (attributes !== null && attributes.length > 0) {
            convertLowerCase(attributes);
          }

          if (image && image.startsWith("ipfs://")) {
            image = "https://ipfs.io/ipfs/" + image.split("ipfs://")[1];
          }
          */

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
            image: image || "",
            attributes: attributes || [],
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

function convertLowerCase(attributes) {
  for (let i = 0; i < attributes.length; i++) {
    attributes.value = attributes.value.toLowerCase();
    attributes.trait_type = attributes.trait_type.toLowerCase();
  }
}

function computeIndex(attributes) {
  if (attributes.length === 0) {
    return "";
  } else {
    let indexString = "";
    attributes.forEach(({ trait_type, value }) => {
      indexString =
        indexString + " " + trait_type + " " + value.replace(" ", ".");
    });

    return indexString;
  }
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

async function isERC721(contractAddress) {
  const code = await web3.eth.getCode(contractAddress);

  for (let event of events) {
    const eventSig = web3.eth.abi.encodeEventSignature(event);
    if (code.indexOf(eventSig.slice(2, eventSig.length)) === -1) return false;
  }

  for (let func of funcs) {
    const funcSig = web3.eth.abi.encodeFunctionSignature(func);
    if (code.indexOf(funcSig.slice(2, funcSig.length)) === -1) return false;
  }

  return true;
}

NFTIndexer();
//updateImageURL();
//updateJsonArray();
//updateIndex();

/*
async function updateIndex() {
  const response = await pool.query("SELECT * FROM nfts");
  for (let i = 0; i < response.rowCount; i++) {
    console.log(i);
    const nft = response.rows[i];
    const attributes = nft.attributes;
    let string = "";
    if (attributes.length === 0) {
      await pool.query(
        "UPDATE nfts SET index = to_tsvector('') WHERE tokenid = $1",
        [nft.tokenid]
      );
    } else {
      attributes.forEach(({ trait_type, value }) => {
        string =
          string +
          " " +
          trait_type.replace(" ", ".") +
          " " +
          value.replace(" ", ".");
      });

      console.log(string);

      await pool.query(
        "UPDATE nfts SET index = to_tsvector($1) WHERE tokenid = $2",
        [string, nft.tokenid]
      );
    }
  }
}*/

/*
async function updateJsonArray() {
  const response = await pool.query("SELECT * FROM nfts");
  for (let i = 0; i < response.rowCount; i++) {
    console.log(i);
    const nft = response.rows[i];
    const attributes = nft.attributes;

    if (attributes === null) continue;
    for (let i = 0; i < attributes.length; i++) {
      attributes[i].value = attributes[i].value.toLowerCase();
      attributes[i].trait_type = attributes[i].trait_type.toLowerCase();
    }

    await pool.query("UPDATE nfts SET attributes = $1 WHERE tokenid = $2", [
      JSON.stringify(attributes),
      nft.tokenid,
    ]);
  }
}
*/

/*
async function updateImageURL() {
  console.log("Here");
  const response = await pool.query("SELECT * FROM nfts");
  for (let i = 9999; i < response.rowCount; i++) {
    console.log(i);
    const nft = response.rows[i];
    const metadata = await alchemy.nft.getNftMetadata(
      nft.contractaddress,
      nft.tokenid
    );

    let image = metadata.rawMetadata.image;
    console.log(image);
    if (image && image.startsWith("ipfs://")) {
      image = "https://ipfs.io/ipfs/" + image.split("ipfs://")[1];
    }

    await pool.query("UPDATE nfts SET imageurl = $1 WHERE tokenid = $2", [
      image,
      nft.tokenid,
    ]);
  }
}*/

/*
function computeNFTRarity(attributes, attributesSummary) {
  let totalRarity = 1;
  attributes.forEach(({ trait_type, value }) => {
    const traitRarity =
      attributesSummary[trait_type][value] /
      attributesSummary[trait_type]["Total"];

    totalRarity *= traitRarity;
  });
  return totalRarity;
}

function computeTraitsCount(tokens) {
  let traitValueCount = {};

  for (let token of tokens) {
    const tokenAttributes = token.attributes;
    if (tokenAttributes === null) continue;

    tokenAttributes.forEach(({ trait_type, value }) => {
      if (!traitValueCount[trait_type]) {
        traitValueCount[trait_type] = {};
        traitValueCount[trait_type]["Total"] = 0;
      }

      if (!traitValueCount[trait_type][value]) {
        traitValueCount[trait_type][value] = 0;
      }

      traitValueCount[trait_type]["Total"]++;
      traitValueCount[trait_type][value]++;
    });
  }

  return traitValueCount;

  async function ComputeNFTsRarity(contractAddress) {
  const query = {
    text: "SELECT attributes FROM nfts WHERE contractaddress = $1",
    values: [contractAddress],
  };

  const response = await pool.query(query);

  console.log(computeTraitsCount(response.rows));
}
}*/
