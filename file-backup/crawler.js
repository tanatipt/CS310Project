//NFTIndexer();
//updateImageURL();
//updateJsonArray();
//updateIndex();
insertQueries();
//updateAttributes();

async function insertQueries() {
  const queries = [
    "club",
    "bayc",
    "punks",
    "yacht",
    "shit",
    "dog",
    "nft",
    "art",
    "mint",
    "bored ape",
    "dead",
    "unknown",
    "okay",
    "bay",
  ];

  for (let query of queries) {
    await pool.query("INSERT INTO queries VALUES (DEFAULT, $1)", [query]);
  }
}

/*
async function createTrainingData(query) {
  const similarNfts = "SELECT name FROM nftcollections WHERE name ILIKE $1";
  const dataset = await pool
    .query(similarNfts, ["%" + query + "%"])
    .then((response) => {
      const collections = [];
      for (let i = 0; i < response.rowCount; i++) {
        collections.push(response.rows[i].name);
      }

      return collections;
    });

  await pool.query("INSERT INTO trainingset VALUES ($1, $2)", [query, dataset]);
}*/
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
async function updateAttributes() {
  const response = await pool.query(
    "SELECT * FROM nfts ORDER BY tokenid ASC LIMIT 10000"
  );
  for (let i = 2143; i < 4000; i++) {
    console.log(i);
    const nft = response.rows[i];
    const metadata = await alchemy.nft.getNftMetadata(
      nft.contractaddress,
      nft.tokenid
    );

    let keywords = null;
    let attributes = metadata.rawMetadata.attributes;

    console.log(attributes);
    if (attributes) {
      if (Array.isArray(attributes)) {
        if (attributes.length > 0) {
          keywords = [];
          attributes.forEach(({ trait_type, value }) => {
            keywords.push(value);
            keywords.push(trait_type);
          });
        }
      } else {
        keywords = [];
        for (const [key, value] of Object.entries(attributes)) {
          keywords.push(value);
          keywords.push(key);
        }
      }
    }

    await pool.query(
      "UPDATE nfts SET attributes = $1 WHERE tokenid = $2 AND contractaddress = $3",
      [keywords, nft.tokenid, nft.contractaddress]
    );
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
