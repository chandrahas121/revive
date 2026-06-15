# ==============================================================================
# MERCARI PRICE SUGGESTION - END-TO-END MLP ENSEMBLE
# (Bulletproof Version: Auto-Saves Weights to Disk + Memory Safe + Fixed Predict)
# ==============================================================================

import os
import re
import gc
import math
import numpy as np
import pandas as pd
import scipy.sparse as sp
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import tensorflow as tf
from tensorflow.keras.layers import Input, Dense, BatchNormalization, Activation, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.callbacks import ModelCheckpoint

import warnings
warnings.filterwarnings('ignore')

# ─── 1. CONFIGURATION & SETUP ─────────────────────────────────────────────────
nltk.download('wordnet', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('omw-1.4', quiet=True)

TRAIN_PATH = '/kaggle/input/datasets/saitosean/mercari/train.tsv'
OUTPUT_DIR = '/kaggle/working/'

# ─── 2. DATA LOADING & PREPROCESSING ──────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(TRAIN_PATH, sep='\t')
df = df[df['price'] > 0].reset_index(drop=True)
y = np.log1p(df['price'].values)

print("Preprocessing Text Data...")
df['item_description'] = df['item_description'].fillna('')
df['brand_name'] = df['brand_name'].fillna('missing')
df['category_name'] = df['category_name'].fillna('missing')
df['name'] = df['name'].fillna('')

df['item_description'] = df['item_description'].str.replace('^no description yet$', '', regex=True)
df['name_brand'] = df['name'] + " " + df['brand_name']
df['text_combined'] = df['item_description'] + " " + df['name'] + " " + df['category_name']

def decontracted(phrase):
    phrase = re.sub(r"aren\'t", "are not", phrase)
    phrase = re.sub(r"didn\'t", "did not", phrase)
    phrase = re.sub(r"can\'t", "can not", phrase)
    phrase = re.sub(r"couldn\'t", "could not", phrase)
    phrase = re.sub(r"won\'t", "would not", phrase)
    phrase = re.sub(r"wouldn\'t", "would not", phrase)
    phrase = re.sub(r"haven\'t", "have not", phrase)
    phrase = re.sub(r"shouldn\'t", "should not", phrase)
    phrase = re.sub(r"doesn\'t", "does not", phrase)
    phrase = re.sub(r"don\'t", "do not", phrase)
    return phrase

regex_special_chars = re.compile('[^A-Za-z0-9.]+')
regex_decimal_digits = re.compile(r'(?<!\d)\.(?!\d)')
regex_white_space = re.compile(r'\s+')
stop_words = set(stopwords.words("english")) - {"no", "nor", "not"}
lemmatizer = WordNetLemmatizer()

def clean_text(sent):
    sent = decontracted(sent)
    sent = sent.replace('\\r', ' ').replace('\\n', ' ')
    sent = regex_special_chars.sub(' ', sent)
    sent = regex_decimal_digits.sub(' ', sent)
    sent = regex_white_space.sub(' ', sent)
    sent = sent.strip().lower()
    sent_list = sent.split()
    sent = " ".join([lemmatizer.lemmatize(word) for word in sent_list if word not in stop_words])
    return sent

print("Cleaning 'name_brand' and 'text_combined'...")
df['name_brand'] = df['name_brand'].apply(clean_text)
df['text_combined'] = df['text_combined'].apply(clean_text)

# ─── 3. FEATURE EXTRACTION & VECTORIZATION ────────────────────────────────────
print("Vectorizing Text Features...")
tfidf_name = TfidfVectorizer(max_features=50000, ngram_range=(1, 2), token_pattern=r'\w+')
X_name = tfidf_name.fit_transform(df['name_brand'])

tfidf_text = TfidfVectorizer(max_features=100000, ngram_range=(1, 2), token_pattern=r'\w+')
X_text = tfidf_text.fit_transform(df['text_combined'])

print("Encoding Categorical Features...")
ohe_ship = OneHotEncoder(handle_unknown='ignore')
X_ship = ohe_ship.fit_transform(df['shipping'].values.reshape(-1, 1))

ohe_cond = OneHotEncoder(handle_unknown='ignore')
X_cond = ohe_cond.fit_transform(df['item_condition_id'].values.reshape(-1, 1))

print("Stacking features into CSR matrix...")
X_sparse = hstack((X_name, X_text, X_ship, X_cond)).tocsr().astype('float32')
print(f"Final Input Shape: {X_sparse.shape}")

del df, X_name, X_text, X_ship, X_cond
gc.collect()

# ─── 4. TRAIN/TEST SPLIT & MEMORY-SAFE GENERATOR (training only) ──────────────
X_train, X_val, y_train, y_val = train_test_split(X_sparse, y, test_size=0.1, random_state=42)

# Save val/train splits to disk so a crash later doesn't require re-vectorizing
print("Saving train/val splits to disk for safety...")
sp.save_npz(os.path.join(OUTPUT_DIR, 'X_val.npz'), X_val)
np.save(os.path.join(OUTPUT_DIR, 'y_val.npy'), y_val)
sp.save_npz(os.path.join(OUTPUT_DIR, 'X_train.npz'), X_train)
np.save(os.path.join(OUTPUT_DIR, 'y_train.npy'), y_train)

def memory_safe_generator(X, y, batch_size=256, shuffle=True):
    samples = X.shape[0]
    indices = np.arange(samples)
    while True:
        if shuffle:
            np.random.shuffle(indices)
        for i in range(0, samples, batch_size):
            batch_idx = indices[i : min(i + batch_size, samples)]
            yield (X[batch_idx].toarray(), y[batch_idx])  # Strictly a Tuple!

# ─── 5. CUSTOM CLEAN PROGRESS CALLBACK ────────────────────────────────────────
class CleanProgressCallback(tf.keras.callbacks.Callback):
    def __init__(self, total_steps, update_freq=500):
        super().__init__()
        self.total_steps = total_steps
        self.update_freq = update_freq

    def on_epoch_begin(self, epoch, logs=None):
        print(f"\n[ Epoch {epoch + 1} ] started...")

    def on_train_batch_end(self, batch, logs=None):
        if batch > 0 and batch % self.update_freq == 0:
            loss = logs.get('loss', 0)
            print(f"  -> Batch {batch}/{self.total_steps} | Current Loss: {loss:.4f}")

    def on_epoch_end(self, epoch, logs=None):
        loss = logs.get('loss', 0)
        val_loss = logs.get('val_loss', 0)
        print(f"[ Epoch {epoch + 1} ] Finished! | Train Loss: {loss:.4f} | Val Loss: {val_loss:.4f}")

# ─── 6. MODEL DEFINITION ──────────────────────────────────────────────────────
def create_mlp_model(input_dim, units_layer1, units_layer2):
    inputs = Input(shape=(input_dim,))

    x = Dense(units_layer1)(inputs)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = Dropout(0.2)(x)

    x = Dense(units_layer2)(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = Dropout(0.2)(x)

    outputs = Dense(1)(x)
    model = Model(inputs=inputs, outputs=outputs)
    model.compile(optimizer='adam', loss='mse')
    return model

input_shape = X_train.shape[1]
EPOCHS = 2
BATCH_SIZE = 256

TRAIN_STEPS = math.ceil(X_train.shape[0] / BATCH_SIZE)
VAL_STEPS = math.ceil(X_val.shape[0] / BATCH_SIZE)

clean_logger = CleanProgressCallback(total_steps=TRAIN_STEPS, update_freq=500)

chkpt_model_1 = ModelCheckpoint(filepath=os.path.join(OUTPUT_DIR, 'model1_best.keras'),
                                 save_best_only=True, monitor='val_loss', verbose=0)

chkpt_model_2 = ModelCheckpoint(filepath=os.path.join(OUTPUT_DIR, 'model2_best.keras'),
                                 save_best_only=True, monitor='val_loss', verbose=0)

# ─── 7. TRAINING THE MODELS ───────────────────────────────────────────────────
print("\n=== Training Model 1 (MLP-256) ===")
model_1 = create_mlp_model(input_shape, 256, 128)
model_1.fit(
    memory_safe_generator(X_train, y_train, BATCH_SIZE, shuffle=True),
    steps_per_epoch=TRAIN_STEPS,
    epochs=EPOCHS,
    validation_data=memory_safe_generator(X_val, y_val, BATCH_SIZE, shuffle=False),
    validation_steps=VAL_STEPS,
    verbose=0,
    callbacks=[clean_logger, chkpt_model_1]
)

print("\n=== Training Model 2 (MLP-1024) ===")
model_2 = create_mlp_model(input_shape, 1024, 512)
model_2.fit(
    memory_safe_generator(X_train, y_train, BATCH_SIZE, shuffle=True),
    steps_per_epoch=TRAIN_STEPS,
    epochs=EPOCHS,
    validation_data=memory_safe_generator(X_val, y_val, BATCH_SIZE, shuffle=False),
    validation_steps=VAL_STEPS,
    verbose=0,
    callbacks=[clean_logger, chkpt_model_2]
)

# Hard-save the final states just in case the checkpoints missed something
model_1.save(os.path.join(OUTPUT_DIR, 'model1_final.keras'))
model_2.save(os.path.join(OUTPUT_DIR, 'model2_final.keras'))
print("\n[INFO] Both models have been successfully saved to your Kaggle /working/ directory!")

# ─── 8. ENSEMBLE EVALUATION (FIXED - NO GENERATOR FOR PREDICT) ────────────────
print("\n=== Generating Ensemble Predictions (Memory Safe) ===")

def predict_in_batches(model, X, batch_size=256):
    samples = X.shape[0]
    preds = np.zeros(samples, dtype='float32')
    for i in range(0, samples, batch_size):
        end = min(i + batch_size, samples)
        batch = X[i:end].toarray()
        preds[i:end] = model.predict_on_batch(batch).flatten()
    return preds

print("Predicting with Model 1...")
preds_1 = predict_in_batches(model_1, X_val, BATCH_SIZE)

print("Predicting with Model 2...")
preds_2 = predict_in_batches(model_2, X_val, BATCH_SIZE)

# Combine Models
WMIN = 0.405
ensemble_preds = (WMIN * preds_1) + ((1 - WMIN) * preds_2)

final_rmsle = math.sqrt(mean_squared_error(y_val, ensemble_preds))

print("\n" + "="*50)
print(f"FINAL ENSEMBLE CV RMSLE : {final_rmsle:.4f}")
print("="*50)
