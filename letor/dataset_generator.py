# Need to diversify ranking results using other metrics, i.e total sales, number of traders
# Use total volume as the targeted value
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
        select_parameters = "collectionname,totalvolume,  totalsales, totalsupply, numowners, averageprice, COALESCE(floorprice,0) AS floorprice"
        sql = "SELECT " + select_parameters + \
            " FROM nft_collections WHERE collectionname IS NOT NULL"

        curr.execute(sql)
        collections = np.array(curr.fetchall())
        curr.close()

        return collections
    finally:
        if conn is not None:
            conn.close()


def create_dataset():
    collections = query_nfts()
    keywords = nft_name_scraper()
    X = np.empty([0, 8])
    y = np.empty([0, 1])

    for query_idx, keyword in enumerate(keywords):
        print(keyword)

        X_query, y_query = create_queryset(keyword, collections)
        y = np.append(y, y_query)
        X_query = np.column_stack(
            (X_query, np.full(X_query.shape[0],  query_idx)))
        X = np.vstack((X, X_query))

    np.savetxt("pointwise_dataset.csv", np.column_stack((X, y)), delimiter=",")


def create_queryset(keyword, collections):
    nft_names = collections[:, 0]
    nft_volumes = collections[:, 1]
    X = collections[:, 1:]

    X = create_X(keyword, X)

    y = np.sort(nft_volumes)[-20:]
    y_idx = np.argsort(nft_volumes)[-20:]
    X = X[y_idx]

    return [X, y]


def create_X(keyword, collections):
    nfts_name = collections[:, 0]
    nft_info = collections[:, 1:]
    cosim = nlp_similarity(keyword, nfts_name)
    nft_info = np.column_stack((nft_info, cosim))

    return nft_info.astype(float)


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
