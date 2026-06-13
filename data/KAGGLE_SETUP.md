# How to Set Up Kaggle API Key

## Step 1: Get your kaggle.json
1. Go to https://www.kaggle.com/settings
2. Scroll to "API" section
3. Click **"Create New Token"** → downloads `kaggle.json`

## Step 2: Place the file
Put `kaggle.json` at:
```
C:\Users\chand\.kaggle\kaggle.json
```
(Create the `.kaggle` folder if it doesn't exist)

## Step 3: Accept Mercari competition rules
1. Go to: https://www.kaggle.com/competitions/mercari-price-suggestion-challenge/rules
2. Click **"I Understand and Accept"**

## Step 4: Run the download
```powershell
cd "c:\Users\chand\OneDrive\Desktop\amazon-hackon"
pip install kaggle py7zr
kaggle competitions download -c mercari-price-suggestion-challenge -f train.tsv.7z -p data/
```

Then extract:
```powershell
cd "c:\Users\chand\OneDrive\Desktop\amazon-hackon"
python -c "import py7zr; py7zr.SevenZipFile('data/train.tsv.7z', mode='r').extractall('data/'); import os; os.rename('data/train.tsv', 'data/mercari_train.tsv')"
```

## Step 5: Train the price model
```powershell
python ml/notebooks/train_price_model.py --data data/mercari_train.tsv --sample 300000
```
