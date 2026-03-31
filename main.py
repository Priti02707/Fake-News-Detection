print("Code started running...")

import pandas as pd
import numpy as np
import re
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

# -------------------------------
# 1. Load Dataset
# -------------------------------
fake = pd.read_csv("Fake.csv", on_bad_lines='skip', engine='python').sample(2000, random_state=42)
real = pd.read_csv("True.csv", on_bad_lines='skip', engine='python').sample(2000, random_state=42)

fake["label"] = 0
real["label"] = 1

df = pd.concat([fake, real], axis=0)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

print("Dataset Shape:", df.shape)

# -------------------------------
# 2. Handle Missing Values
# -------------------------------
df["title"] = df["title"].fillna("").astype(str)
df["text"] = df["text"].fillna("").astype(str)

# -------------------------------
# 3. Text Cleaning Function
# -------------------------------
def clean_text(text):
    text = text.lower()
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'<.*?>+', '', text)
    text = re.sub(r'\W', ' ', text)
    text = re.sub(r'\n', ' ', text)
    text = re.sub(r'\d', '', text)
    return text

# -------------------------------
# 4. Create Content (title + text)
# -------------------------------
df["content"] = df["title"].str.strip() + " " + df["text"].str.strip()

# Clean combined text
df["content"] = df["content"].apply(clean_text)

# -------------------------------
# 5. Split Data
# -------------------------------
X = df["content"]
y = df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# -------------------------------
# 6. TF-IDF Vectorization
# -------------------------------
vectorizer = TfidfVectorizer(
    stop_words='english',
    max_df=0.8,
    min_df=5,
    ngram_range=(1,2)
)

X_train = vectorizer.fit_transform(X_train)
X_test = vectorizer.transform(X_test)

# -------------------------------
# 7. Models
# -------------------------------
models = {
    "Logistic Regression": LogisticRegression(max_iter=3000, class_weight='balanced'),
    "Naive Bayes": MultinomialNB()
}

results = {}

for name, model in models.items():
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    results[name] = acc
    
    print(f"\n{name} Accuracy: {acc}")
    print(classification_report(y_test, y_pred))

# -------------------------------
# 8. Confusion Matrix (Best Model)
# -------------------------------
best_model = LogisticRegression(max_iter=3000, class_weight='balanced')
best_model.fit(X_train, y_train)
y_pred = best_model.predict(X_test)

cm = confusion_matrix(y_test, y_pred)

plt.figure()
sns.heatmap(cm, annot=True, fmt='d')
plt.title("Confusion Matrix")
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.show()

# -------------------------------
# 9. Accuracy Graph
# -------------------------------
plt.figure()
plt.bar(results.keys(), results.values())
plt.title("Model Accuracy Comparison")
plt.xlabel("Models")
plt.ylabel("Accuracy")
plt.show()