from flask import Flask, request, jsonify
from flask_cors import CORS
from newspaper import Article
from transformers import BartForConditionalGeneration, BartTokenizer, pipeline

# --- Model Loading: High-quality BART-Large model ---
model_name = "facebook/bart-large-cnn"
tokenizer = BartTokenizer.from_pretrained(model_name)
model = BartForConditionalGeneration.from_pretrained(model_name)
emotion_classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app)

# --- /extract Endpoint (This is the missing part) ---
@app.route('/extract', methods=['POST'])
def extract_content_from_url():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL is required.'}), 400

    try:
        article = Article(url)
        article.download()
        article.parse()
        return jsonify({'extracted_text': article.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- /simplify Endpoint (With two modes) ---
@app.route('/simplify', methods=['POST'])
def simplify_text():
    data = request.get_json()
    text_to_simplify = data.get('text')
    mode = data.get('mode', 'simplify') # 'simplify', 'detailed_summary', or 'teaching_mode'

    if not text_to_simplify:
        return jsonify({'error': 'Text is required.'}), 400

    try:
        # --- PROMPT & PARAMETER LOGIC ---
        
        # Mode 1: Short & Simple Summary
        if mode == 'simplify':
            # For direct summarization, we don't need a complex prompt.
            # We just give the model the text and control the output with parameters.
            inputs = tokenizer(text_to_simplify, return_tensors="pt", max_length=1024, truncation=True)
            min_len = 60
            max_len = 150

        # Mode 2: Detailed, Informative Summary
        elif mode == 'detailed_summary':
            inputs = tokenizer(text_to_simplify, return_tensors="pt", max_length=1024, truncation=True)
            min_len = 150
            max_len = 400

        # Mode 3: Creative Teaching Mode
        elif mode == 'teaching_mode':
            # For this creative task, the detailed prompt is essential.
            prompt = f"""
            You are a friendly and engaging teacher. Explain the main idea of the following text
            to a student. Use a simple story, an analogy, or a real-world example 
            to make the core concepts easy to understand.

            Original Text:
            "{text_to_simplify}"

            Easy Explanation:
            """
            inputs = tokenizer(prompt, return_tensors="pt", max_length=1024, truncation=True)
            min_len = 200
            max_len = 500
        
        else: # A fallback just in case
            inputs = tokenizer(text_to_simplify, return_tensors="pt", max_length=1024, truncation=True)
            min_len = 60
            max_len = 150

        # --- MODEL GENERATION (This part is now the same for all modes) ---
        outputs = model.generate(
            **inputs,
            min_length=min_len,
            max_length=max_len,
            temperature=0.8, # Slightly more creative temperature
            do_sample=True,
            top_k=50,
            top_p=0.95,
            early_stopping=True
        )
        
        simplified_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        return jsonify({'simplified_text': simplified_text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/analyze', methods=['POST'])
def analyze_emotion():
    data = request.get_json()
    text_to_analyze = data.get('text')

    if not text_to_analyze:
        return jsonify({'error': 'Text is required.'}), 400

    try:
        # Define the emotional labels we want to classify the text against.
        # You can customize these!
        emotion_labels = ["sad", "joyful", "love", "angry", "fearful", "surprise", "neutral", "formal", "inspirational"]
        
        # Use the pipeline to classify the text
        # We use truncation to handle long texts without errors.
        results = emotion_classifier(text_to_analyze, candidate_labels=emotion_labels, truncation=True)
        
        # The pipeline returns a dictionary. We want the label with the highest score.
        # The 'labels' are sorted by score, so the first one is the winner.
        primary_emotion = results['labels'][0]
        confidence_score = results['scores'][0]

        # Return the result as JSON
        return jsonify({
            'primary_emotion': primary_emotion,
            'confidence_score': confidence_score,
            'all_scores': dict(zip(results['labels'], results['scores'])) 
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Server Run Command ---
if __name__ == '__main__':
    app.run(port=5000, debug=True)