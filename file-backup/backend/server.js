const express = require("express");
const app = express();
const pool = require("./database");
const Web3 = require("web3");
var cors = require("cors");
const web3 = new Web3(
  "https://eth-mainnet.g.alchemy.com/v2/NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE"
);

SELECT contractaddress,name, COALESCE(tokensavailable,0) AS tokensavailable,COALESCE(totalvolume, 0) AS totalvolume, COALESCE(floorprice, 0) AS floorprice, COALESCE(ownercount ,0) AS ownercount, COALESCE(totalsales,0) as totalsales FROM nftcollections 
  JOIN blocks ON blocknumber = blockdeployedatNATURAL LEFT JOIN (SELECT contractaddress, sum(accumulatedvaluealltime) as totalvolume, sum(salescountalltime) as totalsales FROM nftsalltime GROUP BY contractaddress) A 
  NATURAL LEFT JOIN (SELECT contractaddress, COUNT(DISTINCT owner) as ownercount,COUNT(tokenid) as tokensavailable FROM nfts GROUP BY contractaddress) B 
  NATURAL LEFT JOIN (SELECT contractaddress, MIN(lastsoldprice) as floorprice FROM nfts WHERE lastsoldprice > 0 GROUP BY contractaddress) C) d 

/*SELECT contractaddress, name, tokenid, name || ' #' || tokenid as token, lastsoldprice, attributes, datemined FROM nftcollections NATURAL JOIN nfts JOIN blocks ON minedat = blocknumber WHERE attributes is not null; */
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  const query = req.query.searchQuery;
  let dataset = [];
  if (web3.utils.isAddress(query)) {
    dataset = await pool
      .query("SELECT * FROM nftcollections WHERE contractaddress = $1", [query])
      .then((response) => response.rows);
  } else if (query.length >= 3) {
    const totalVolume =
      "SELECT contractaddress, sum(accumulatedvaluealltime) as totalvolume, sum(salesalltime) as totalsales FROM nftsalltime GROUP BY contractaddress";
    const floorPrice =
      "SELECT contractaddress, MIN(lastsoldprice) as floorprice, COUNT(tokenid) as tokensavailable FROM nfts WHERE lastsoldprice > 0 GROUP BY contractaddress";
    const owners =
      "SELECT contractaddress, COUNT(DISTINCT owner) as ownercount FROM nfts GROUP BY contractaddress";
    const selector =
      "SELECT contractaddress,name, COALESACE(tokensavailable,0) AS tokensavailable, COALESCE(totalvolume, 0) AS totalvolume, COALESCE(floorprice, 0) AS floorprice, COALESCE(ownercount ,0) AS ownercount, COALESCE(totalsales,0)";

    dataset = await pool
      .query(
        selector +
          "FROM nftcollections JOIN blocks ON blocknumber = blockdeployedat NATURAL LEFT JOIN (" +
          totalVolume +
          ") A NATURAL LEFT JOIN (" +
          floorPrice +
          ") B NATURAL LEFT JOIN (" +
          owners +
          ") C WHERE name ILIKE $1 LIMIT 10",
        ["%" + query + "%"]
      )
      .then((response) => response.rows);
  }

  res.json(dataset);
});

app.get("/collection/:contractAddress", async (req, res) => {
  const contractAddress = req.params.contractAddress;
  const pageNumber = parseInt(req.query.pageNumber);
  const searchQuery = req.query.searchQuery;
  let nfts = [];
  let nftsCount = 0;

  if (!web3.utils.isAddress(contractAddress)) res.status(405).json([]);

  if (searchQuery === "") {
    nfts = await pool
      .query(
        "SELECT * FROM nfts WHERE contractaddress = $1 ORDER BY lastsoldprice DESC OFFSET $2 LIMIT 8",
        [contractAddress, (pageNumber - 1) * 8]
      )
      .then((response) => response.rows);
    nftsCount = await pool
      .query(
        "SELECT COUNT(*) AS totalcount FROM nfts WHERE contractaddress = $1",
        [contractAddress]
      )
      .then((response) => response.rows[0].totalcount);
  } else if (!isNaN(searchQuery)) {
    nfts = await pool
      .query("SELECT * FROM nfts WHERE contractaddress = $1 AND tokenid = $2", [
        contractAddress,
        searchQuery,
      ])
      .then((response) => response.rows);
    nftsCount = 1;
  } else {
    console.log(searchQuery);
    nfts = await pool
      .query(
        "SELECT * FROM nfts WHERE index @@ websearch_to_tsquery('english', $1) AND contractaddress = $2 ORDER BY lastsoldprice DESC OFFSET $3 LIMIT 8",
        [searchQuery, contractAddress, (pageNumber - 1) * 8]
      )
      .then((response) => response.rows);

    nftsCount = await pool
      .query(
        "SELECT COUNT(*) as totalcount FROM nfts WHERE index @@ websearch_to_tsquery('english', $1) AND contractaddress = $2",
        [searchQuery, contractAddress]
      )
      .then((response) => response.rows[0].totalcount);
  }

  res.json({ nfts, nftsCount });
});

app.get("/nft/:contractAddress/:id", async (req, res) => {
  const contractAddress = req.params.contractAddress;
  const tokenid = req.params.id;

  if (!web3.utils.isAddress(contractAddress) || isNaN(tokenid)) res.status(405);

  const dataset = await pool
    .query("SELECT * FROM nfts WHERE contractaddress = $1 AND tokenid = $2", [
      contractAddress,
      tokenid,
    ])
    .then((response) => response.rows);

  res.send(dataset);
});

app.listen(5000);
