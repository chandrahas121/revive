# ==============================================================================
# export_vectorizers.py  — REGENERATE the missing feature pipeline (NO retraining)
# ------------------------------------------------------------------------------
# train_price_model.py saved only the .keras weights, not the TF-IDF vectorizers
# / encoders that build the 150,007-dim input. TfidfVectorizer.fit is DETERMINISTIC
# given the same corpus + same preprocessing, so re-fitting on the same train.tsv
# reproduces the EXACT same vocabulary/column order the trained models expect.
#
# This re-runs ONLY the preprocessing + .fit (minutes on CPU, no GPU) and pickles
# the four fitted objects. The model weights you already have stay untouched.
#
# RUN THIS on Kaggle (same dataset as training) — or locally if you have train.tsv.
#   Output:  /kaggle/working/price_vectorizers.pkl   (~a few hundred MB)
#   Then download it to:  ml/artifacts/price_vectorizers.pkl
# ==============================================================================
import re
import pickle
import pandas as pd
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder

nltk.download('wordnet', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('omw-1.4', quiet=True)

TRAIN_PATH = '/kaggle/input/datasets/saitosean/mercari/train.tsv'   # <-- same as training
OUT_PATH   = '/kaggle/working/price_vectorizers.pkl'

# ─── EXACT same preprocessing as train_price_model.py ─────────────────────────
print("Loading data...")
df = pd.read_csv(TRAIN_PATH, sep='\t')
df = df[df['price'] > 0].reset_index(drop=True)

df['item_description'] = df['item_description'].fillna('')
df['brand_name']       = df['brand_name'].fillna('missing')
df['category_name']    = df['category_name'].fillna('missing')
df['name']             = df['name'].fillna('')
df['item_description'] = df['item_description'].str.replace('^no description yet$', '', regex=True)
df['name_brand']    = df['name'] + " " + df['brand_name']
df['text_combined'] = df['item_description'] + " " + df['name'] + " " + df['category_name']

def decontracted(p):
    for a, b in [(r"aren\'t","are not"),(r"didn\'t","did not"),(r"can\'t","can not"),
                 (r"couldn\'t","could not"),(r"won\'t","would not"),(r"wouldn\'t","would not"),
                 (r"haven\'t","have not"),(r"shouldn\'t","should not"),(r"doesn\'t","does not"),
                 (r"don\'t","do not")]:
        p = re.sub(a, b, p)
    return p

regex_special = re.compile('[^A-Za-z0-9.]+')
regex_decimal = re.compile(r'(?<!\d)\.(?!\d)')
regex_ws      = re.compile(r'\s+')
stop_words = set(stopwords.words("english")) - {"no", "nor", "not"}
lemma = WordNetLemmatizer()

def clean_text(sent):
    sent = decontracted(sent)
    sent = sent.replace('\\r', ' ').replace('\\n', ' ')
    sent = regex_special.sub(' ', sent)
    sent = regex_decimal.sub(' ', sent)
    sent = regex_ws.sub(' ', sent)
    sent = sent.strip().lower()
    return " ".join(lemma.lemmatize(w) for w in sent.split() if w not in stop_words)

print("Cleaning text (this is the slow part)...")
df['name_brand']    = df['name_brand'].apply(clean_text)
df['text_combined'] = df['text_combined'].apply(clean_text)

# ─── Fit the SAME vectorizers/encoders as training (same params!) ─────────────
print("Fitting vectorizers...")
tfidf_name = TfidfVectorizer(max_features=50000,  ngram_range=(1, 2), token_pattern=r'\w+')
tfidf_name.fit(df['name_brand'])

tfidf_text = TfidfVectorizer(max_features=100000, ngram_range=(1, 2), token_pattern=r'\w+')
tfidf_text.fit(df['text_combined'])

ohe_ship = OneHotEncoder(handle_unknown='ignore')
ohe_ship.fit(df['shipping'].values.reshape(-1, 1))

ohe_cond = OneHotEncoder(handle_unknown='ignore')
ohe_cond.fit(df['item_condition_id'].values.reshape(-1, 1))

n_dim = (len(tfidf_name.vocabulary_) + len(tfidf_text.vocabulary_)
         + len(ohe_ship.categories_[0]) + len(ohe_cond.categories_[0]))
print(f"Reconstructed input dim = {n_dim}  (must equal the model's 150007)")

with open(OUT_PATH, 'wb') as f:
    pickle.dump({
        "type": "keras_mlp_ensemble_v1",
        "tfidf_name": tfidf_name,
        "tfidf_text": tfidf_text,
        "ohe_ship": ohe_ship,
        "ohe_cond": ohe_cond,
        "input_dim": n_dim,
        "ensemble_wmin": 0.405,      # same weight train_price_model.py used
        "usd_to_inr": 83.0,
    }, f)
print(f"Saved → {OUT_PATH}")
print("Now download it to your repo at  ml/artifacts/price_vectorizers.pkl")
