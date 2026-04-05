# Fake News Detection using Machine Learning

## Project Overview

This project detects whether a news article is **Fake or Real** using Natural Language Processing (NLP) and Machine Learning techniques.

It uses TF-IDF vectorization and compares two models:

* Logistic Regression
* Naive Bayes

---

## Features

* Text preprocessing using regex
* Feature extraction using TF-IDF
* Model training & evaluation
* Confusion matrix visualization
* Model comparison graph

---

## Dataset

* `Small_Fake.csv` → Fake news
* `Small_True.csv` → Real news
* Total dataset: **4000 samples (2000 fake + 2000 real)**

---

## Technologies Used

* Python
* Pandas, NumPy
* Scikit-learn
* Matplotlib, Seaborn

---

## Workflow

1. Data Loading
2. Data Cleaning
3. Feature Engineering (Title + Text)
4. TF-IDF Vectorization
5. Model Training
6. Evaluation & Visualization

---

## Results

### Model Accuracy

* **Logistic Regression:** 99.37%
* **Naive Bayes:** 97.37%

Logistic Regression performs better on this dataset.

---

### Classification Report (Logistic Regression)

| Class    | Precision | Recall | F1-Score |
| -------- | --------- | ------ | -------- |
| Fake (0) | 0.99      | 1.00   | 0.99     |
| Real (1) | 1.00      | 0.99   | 0.99     |

---

### Classification Report (Naive Bayes)

| Class    | Precision | Recall | F1-Score |
| -------- | --------- | ------ | -------- |
| Fake (0) | 0.97      | 0.98   | 0.97     |
| Real (1) | 0.98      | 0.97   | 0.97     |

---

### Confusion Matrix Insights

* True Negatives (Fake correctly predicted): **400**
* True Positives (Real correctly predicted): **395**
* Misclassifications: **only 5 errors**

This shows the model is **highly accurate and reliable**

---

### Visualizations

#### Confusion Matrix

<img width="539" height="455" alt="image1" src="https://github.com/user-attachments/assets/598af6ce-2732-4e2a-a358-3658dcbebd51" />


#### Model Accuracy Comparison

<img width="567" height="455" alt="image2" src="https://github.com/user-attachments/assets/f30c0c80-a0e2-421d-b1f8-8a4c059cc092" />


---

## Key Insights

* Logistic Regression outperforms Naive Bayes
* Very low false predictions (only 5 mistakes)
* TF-IDF + simple ML models work extremely well for this task

---

## How to Run

```bash
pip install pandas numpy matplotlib seaborn scikit-learn
```

```bash
python main.py
```

---

## Future Improvements

* Use Deep Learning (LSTM, BERT)
* Deploy using Flask/Streamlit
* Use larger dataset for better generalization

---

## Author

Priti


If you like this project, give it a ⭐ on GitHub!

