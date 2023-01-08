import Grid from "@mui/material/Grid";
import Input from "@mui/material/Input";
import SearchIcon from "@mui/icons-material/Search";
import { makeStyles } from "@mui/styles";
import React, { useState, useEffect } from "react";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Pagination from "@mui/material/Pagination";

const useStyles = makeStyles(() => ({
  collectionContainer: {
    padding: "52px",
  },
  searchBox: {
    padding: "12px 32px",
    border: "1px solid black",
    borderRadius: "20px",
  },
  nftsPaper: {
    borderRadius: "20px ! important",
  },
}));

const Collection = () => {
  const classes = useStyles();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [currentInput, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [nfts, setNfts] = useState([]);
  const [nftsCount, setCount] = useState(0);
  const collection = location.state.collectionInfo;
  const address = collection.contractaddress;
  const pageSize = 8;

  const handleKeyDown = async (event) => {
    try {
      if (event.key === "Enter") {
        setQuery(currentInput);
      }
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    fetch(
      "http://localhost:5000/collection/" +
        address +
        "?pageNumber=" +
        page +
        "&searchQuery=" +
        query
    )
      .then((response) => response.json())
      .then(({ nfts, nftsCount }) => {
        setNfts(nfts);
        setCount(nftsCount);
      });
  }, [page, query]);

  const handlePaginationChange = (event, value) => {
    setPage(value);
  };

  return (
    <Grid
      container
      direction="column"
      alignItems="flex-start"
      rowSpacing={5}
      className={classes.collectionContainer}
    >
      <Grid item>
        <Typography
          variant="h3"
          sx={{ fontWeight: "bold", letterSpacing: "2px" }}
          marginBottom
        >
          {collection.name}
        </Typography>
      </Grid>
      <Grid item container rowSpacing={2}>
        <Grid item container columnSpacing={3}>
          <Grid item>
            <Typography>{collection.totalsupply} Items</Typography>
          </Grid>

          <Grid item>
            <Typography>Creator: {collection.creator}</Typography>
          </Grid>

          <Grid item>
            <Typography>
              Date Created :{" "}
              {new Date(collection.datemined).toLocaleDateString()}
            </Typography>
          </Grid>
        </Grid>
        <Grid item container columnSpacing={3}>
          <Grid item>
            <Typography>Total Volume : {collection.totalvolume} USD</Typography>
          </Grid>
          <Grid item>
            <Typography>Floor Price : {collection.floorprice} USD</Typography>
          </Grid>
          <Grid item>
            <Typography>Owners : {collection.ownercount}</Typography>
          </Grid>
          <Grid item>
            <Typography>
              Unique Owners :{" "}
              {Math.round(
                (collection.ownercount / collection.totalsupply) * 100
              )}{" "}
              %
            </Typography>
          </Grid>
        </Grid>
      </Grid>
      <Grid item container justifyContent="space-between">
        <Grid item xs={4}>
          <Input
            placeholder="Enter Search Query"
            className={classes.searchBox}
            disableUnderline
            fullWidth
            startAdornment={
              <SearchIcon size="large" sx={{ marginRight: "8px" }} />
            }
            value={currentInput}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
        </Grid>
        <Grid item>
          <Typography> Page : {page} </Typography>
          <Pagination
            count={Math.ceil(nftsCount / pageSize)}
            variant="outlined"
            color="primary"
            size="large"
            value={page}
            onChange={handlePaginationChange}
          />
        </Grid>
      </Grid>
      <Grid item container spacing={5}>
        {nfts.map((nft) => {
          return (
            <Grid item xs={3}>
              <Paper elevation={8} sx={{ borderRadius: "20px" }}>
                <Grid container direction="column">
                  <Grid item>
                    <img
                      src={nft.imageurl}
                      alt={nft.imageurl}
                      height="100%"
                      width="100%"
                    />
                  </Grid>
                  <Grid
                    item
                    container
                    direction="column"
                    sx={{ padding: "40px 20px" }}
                    rowSpacing={3}
                  >
                    <Grid item container justifyContent="space-between">
                      <Grid item>
                        <Typography variant="h5">{collection.name}</Typography>
                      </Grid>
                      <Grid item>
                        <Typography variant="h5">#{nft.tokenid}</Typography>
                      </Grid>
                    </Grid>
                    <Grid item>
                      <Typography>Price : {nft.lastsoldprice} USD</Typography>
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Grid>
  );
};

export default Collection;
