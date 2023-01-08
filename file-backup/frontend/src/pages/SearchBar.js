import Grid from "@mui/material/Grid";
import Input from "@mui/material/Input";
import SearchIcon from "@mui/icons-material/Search";
import { makeStyles } from "@mui/styles";
import React, { useState } from "react";
import { Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import { useNavigate } from "react-router-dom";

const useStyles = makeStyles(() => ({
  searchContainer: {
    padding: "52px",
  },
  searchBox: {
    padding: "12px 32px",
    border: "1px solid black",
    borderRadius: "20px",
  },
  collectionsPaper: {
    padding: "32px 16px",
    borderRadius: "20px ! important",
  },
}));

const SearchBar = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [queryResult, setResult] = useState([]);

  const handleKeyDown = async (event) => {
    try {
      if (event.key === "Enter") {
        const response = await fetch(
          "http://localhost:5000/?searchQuery=" + query
        );

        const resultSet = await response.json();
        setResult(resultSet);
      }
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <Grid
      container
      direction="column"
      alignItems="flex-start"
      rowSpacing={10}
      className={classes.searchContainer}
    >
      <Grid item>
        <Input
          placeholder="Enter Search Query"
          className={classes.searchBox}
          disableUnderline
          fullWidth
          startAdornment={
            <SearchIcon size="large" sx={{ marginRight: "8px" }} />
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
      </Grid>
      <Grid item container spacing={5}>
        {queryResult.map((result) => {
          return (
            <Grid item xs={3}>
              <Paper
                className={classes.collectionsPaper}
                elevation={8}
                onClick={() => {
                  navigate(`/collection/${result.contractaddress}`, {
                    state: {
                      collectionInfo: result,
                    },
                  });
                }}
              >
                <Grid container direction="column">
                  <Grid item>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: "bold", letterSpacing: "2px" }}
                    >
                      {result.name}
                    </Typography>
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

export default SearchBar;
