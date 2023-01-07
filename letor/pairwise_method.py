import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
import xgboost as xgb
from text_metrics import lcs


gss = GroupShuffleSplit(test_size=.40, n_splits=5,
                        random_state=7)

for X_train_inds, X_test_inds in gss.split(df, groups=df['queryid']):
    print("Train Index : ")
    print(X_train_inds, "\n")
    print("Test Index : ")
    print(X_test_inds, "\n")

    train_data = df.iloc[X_train_inds]
    X_train = train_data.loc[:, ~train_data.columns.isin(['queryid', target])]
    y_train = train_data.loc[:, train_data.columns.isin([target])]
    groups = train_data.groupby('queryid').size().to_frame('size')[
        'size'].to_numpy()

    test_data = df.iloc[X_test_inds]
    X_test = test_data.loc[:, ~test_data.columns.isin([target])]
    y_test = test_data.loc[:, test_data.columns.isin([target])]

    print("X_Test :")
    print(X_test, "\n")

    model = xgb.XGBRanker(
        tree_method='gpu_hist',
        booster='gbtree',
        objective='rank:pairwise',
        random_state=42,
        learning_rate=0.1,
        colsample_bytree=0.9,
        eta=0.05,
        max_depth=6,
        n_estimators=110,
        subsample=0.75
    )

    model.fit(X_train, y_train, group=groups, verbose=True)

    predictions = (X_test.groupby('queryid')
                   .apply(lambda x: predict(model, x)))

    print("Predictions : ")
    print(predictions, "\n")
    print("Actual Value : ")
    print(y_test, "\n")

print(df)
