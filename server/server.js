const express = require("express");
const app = express();
const pool = require("./database");
const Web3 = require("web3");
const web3 = new Web3(
  "https://eth-mainnet.g.alchemy.com/v2/NbAhlcMqXeAN7NBxIxbSTynYbvxTRSUE"
);

app.use(express.json());

app.get("/", async (req, res) => {
  const query = req.query.searchQuery;
  let dataset = null;
  if (web3.utils.isAddress(query)) {
    dataset = await pool
      .query("SELECT * FROM nftcollections WHERE contractaddress = $1", [query])
      .then((response) => response.rows);
  } else if (query.length >= 3) {
    dataset = await pool
      .query("SELECT * FROM nftcollections WHERE name ILIKE $1", [
        "%" + query + "%",
      ])
      .then((response) => response.rows);
  }

  res.send(dataset);
});

app.get("/collection/:contractAddress", async (req, res) => {
  const contractAddress = req.params.contractAddress;

  if (!web3.utils.isAddress(contractAddress)) res.status(405);

  const dataset = await pool
    .query("SELECT * FROM nfts WHERE contractaddress = $1", [contractAddress])
    .then((response) => response.rows);

  res.send(dataset);
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

app.listen(3000);
