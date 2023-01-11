import psycopg2
from bs4 import BeautifulSoup
from urllib.request import Request, urlopen
import json


def json_response(url):
    try:
        hdr = {'User-Agent': 'Mozilla/5.0'}
        req = Request(url, headers=hdr)
        page = urlopen(req).read()
        soup = BeautifulSoup(page, 'html.parser')
        json_object = json.loads(soup.text)
        return json_object
    except:
        print("Here1")
        return None


def populate_nft_creator():
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
        query = "SELECT payoutaddress, SUM(totalvolume), COUNT(*), SUM(totalsales) FROM nft_collections WHERE payoutaddress IS NOT NULL GROUP BY payoutaddress"
        insert_sql = "INSERT INTO nft_creator " + query

        curr.execute(insert_sql)
        conn.commit()
        conn.close()
    finally:
        if conn is not None:
            conn.close()


def populate_nft_collections():
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
        query = "SELECT contractaddress FROM nft_collections WHERE collectionname is NULL"
        curr.execute(query)
        rows = curr.fetchall()

        for row in rows:
            address = row[0]
            print(address)
            contract_api = "https://api.opensea.io/api/v1/asset_contract/" + address
            contract_info = json_response(contract_api)

            if contract_info is not None:
                collection = contract_info["collection"]

                if collection is not None:
                    name = collection["name"]
                    slug = collection["slug"]
                    description = collection["description"]
                    external_url = collection["external_url"]
                    payout_address = collection["payout_address"]
                    twitter_name = collection["twitter_username"]
                    instagram_name = collection["instagram_username"]

                    stats_api = "https://api.opensea.io/api/v1/collection/" + slug + "/stats"
                    stats_info = json_response(stats_api)

                    if stats_info is not None:
                        stats = stats_info["stats"]
                        update_parameters = "payoutaddress = %s, externalurl = %s, twitter = %s, instagram = %s, slug = %s, collectionname = %s, totalvolume = %s, totalsales = %s, totalsupply = %s, numowners = %s, averageprice = %s, floorprice = %s, description = %s"
                        update_sql = "UPDATE nft_collections SET " + \
                            update_parameters+" WHERE contractaddress = %s"
                        curr.execute(update_sql, (payout_address, external_url, twitter_name, instagram_name, slug, name, stats["total_volume"], stats["total_sales"], stats["total_supply"],
                                                  stats["num_owners"], stats["average_price"], stats["floor_price"], description, address))
                        conn.commit()
    finally:
        if conn is not None:
            conn.close()


populate_nft_collections()
populate_nft_creator()
