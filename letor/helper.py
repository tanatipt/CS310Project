from sentence_transformers import SentenceTransformer, util
import psycopg2
import numpy as np
from bs4 import BeautifulSoup
from urllib.request import Request, urlopen
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import string

model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')


def query_nfts():
    conn = None
    try:
        conn = psycopg2.connect(
            host="localhost",
            user="postgres",
            password="postgres",
            database="projectdb",
            port=5432,
        )
        curr = conn.cursor()

        query = "name, COALESCE(totalvolume,0) AS totalvolume, COALESCE(totalsales,0) AS totalsales, COALESCE(ownercount) AS ownercount,COALESCE(tokensavailable,0) AS tokensavailable,COALESCE(floorprice,0) AS floorprice"
        nfts_alltime = "(SELECT contractaddress, sum(accumulatedvaluealltime) as totalvolume, sum(salescountalltime) as totalsales FROM nftsalltime GROUP BY contractaddress) nfts_alltime"
        nfts_zero = "(SELECT contractaddress, COUNT(DISTINCT owner) as ownercount, COUNT(tokenid) as tokensavailable FROM nfts GROUP BY contractaddress) nfts_zero"
        nfts_nonzero = "(SELECT contractaddress, MIN(lastsoldprice) as floorprice FROM nfts WHERE lastsoldprice > 0 GROUP BY contractaddress) nfts_nonzero;"
        sql = "SELECT " + query + " FROM nftcollections NATURAL LEFT JOIN " + nfts_alltime + \
            " NATURAL LEFT JOIN " + nfts_zero + " NATURAL LEFT JOIN " + nfts_nonzero

        curr.execute(sql)
        collections = np.array(curr.fetchall())
        curr.close()

        return collections
    finally:
        if conn is not None:
            conn.close()


query_nfts()


def create_dataset():
    collections = query_nfts()
    keywords = nft_name_scraper()
    dataset = np.empty([0, 7])

    for query_idx, keyword in enumerate(keywords):
        print(keyword)

        # Get relevance between rating of collection and query
        fvs = create_fvs(keyword, collections)
        fvs = np.column_stack((fvs, np.full(fvs.shape[0],  query_idx)))
        dataset = np.vstack((dataset, fvs))

        print(dataset)


def create_fvs(keyword, collections):
    nfts_name = collections[:, 0]
    nft_info = collections[:, 1:]
    cosim = nlp_similarity(keyword, nfts_name)
    nft_info = np.column_stack((nft_info, cosim))

    return nft_info


def nlp_similarity(keyword, collection):
    keyword_embedding = model.encode(keyword)
    collection_embedding = model.encode(collection)
    cosim_tensor = util.cos_sim(keyword_embedding, collection_embedding)
    cosim_np = cosim_tensor.numpy().flatten()

    return cosim_np


def nft_name_scraper():
    site = "https://www.soocial.com/nft-names"
    hdr = {'User-Agent': 'Mozilla/5.0'}
    req = Request(site, headers=hdr)
    page = urlopen(req).read()
    soup = BeautifulSoup(page, 'html.parser')
    ul = soup.find("h2", text="Catchy NFT Names").find_next_sibling("ul")

    stop_words = set(stopwords.words('english'))
    keywords = set()
    for li in ul.find_all("li"):
        word_tokens = word_tokenize(li.get_text())

        for w in word_tokens:
            lower_w = w.lower()
            if lower_w not in stop_words and lower_w not in string.punctuation:
                keywords.add(lower_w)

    return keywords


create_dataset()
