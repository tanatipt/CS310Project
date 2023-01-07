from sentence_transformers import SentenceTransformer, util
from sklearn.metrics.pairwise import cosine_similarity

model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')


def nlp_similarity(keyword, collection):
    keyword_embedding = model.encode(keyword)
    collection_embedding = model.encode(collection)
    cosim_score = util.cos_sim(keyword_embedding, collection_embedding)

    return cosim_score


keyword = "hidden treasure collectibles"
sentences = [
    "space ape moon club",
    "vault club collector card",
    "pigbossclub",
    "broke ape yachy club",
    "rr/bayc",
    "burnbayc",
    "alco punks",
    "rr/punks"]


print(nlp_similarity(keyword, sentences))
