import py7zr, shutil
from pathlib import Path

print('Extracting train.tsv.7z...')
with py7zr.SevenZipFile('data/train.tsv.7z', mode='r') as z:
    z.extractall('data/')

src = Path('data/train.tsv')
dst = Path('data/mercari_train.tsv')
if src.exists():
    shutil.move(str(src), str(dst))
    size_mb = dst.stat().st_size // 1024 // 1024
    print(f'Saved: data/mercari_train.tsv ({size_mb} MB)')
else:
    print('Files in data/:', [f.name for f in Path('data').iterdir()])
