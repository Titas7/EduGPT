import google.generativeai as genai
from config import GEMINI_API_KEY

def list_models():
    if not GEMINI_API_KEY:
        print("❌ No API key found")
        return
    
    genai.configure(api_key=GEMINI_API_KEY)
    
    try:
        models = genai.list_models()
        print("✅ Available models:")
        for model in models:
            if 'generateContent' in model.supported_generation_methods:
                print(f"  - {model.name}")
    except Exception as e:
        print(f"❌ Error listing models: {e}")

if __name__ == "__main__":
    list_models()