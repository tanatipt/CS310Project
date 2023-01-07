import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from text_metrics import lcs
from sklearn.model_selection import KFold


def computeLabel(x):
    """
    Function returns the ground truth value for an input instance in dataset

    :param x : An input instance in the training dataset
    :return: The ground truth value for the the input instance
    """

    avg_value = x[features].sum() / len(features)
    similarity_value = lcs(x['query'], x['name']) / \
        (len(x['query']) + len(x['name']))
    return avg_value + similarity_value


# All features that represent an NFT collection
features = ["tokensavailable", "totalvolume",
            "floorprice", "uniqueowners", "totalsales"]
target = 'labels'

df = pd.read_csv('collections_stats.csv')

# Standardizing each feature of an NFT collection
for i in features:
    mean = df[i].mean()
    sd = df[i].std()
    df[i] = (df[i] - mean) / sd

# Computing the labels for each input instance
df['labels'] = df.apply(lambda x: computeLabel(x), axis=1)
df = df[['queryid'] + features + [target]]


hyperparam = 0
max_score = -999
kf = KFold(n_splits=5)

# Computing the hyperparameter value that produces the best score
for i in range(1, 13):
    avg_score = 0

    # Obtaining the training set and validation set from the dataframe
    # for different splits
    for train_index, test_index in kf.split(df):
        X_train = df.iloc[train_index][features]
        y_train = df.iloc[train_index][target]
        X_test = df.iloc[test_index][features]
        y_test = df.iloc[test_index][target]

        # Fit a ridge regression model with lamda = i on the training data
        rg = Ridge(alpha=i).fit(X_train, y_train)

        # Compute the score of how well the fitted ridge regression model performs on test data
        score = rg.score(X_test, y_test)
        avg_score += score

    # Averaging the score over 5-fold
    avg_score /= 5
    if (avg_score > max_score):
        max_score = avg_score
        hyperparam = i
