import google.generativeai as genai
import json
from config import GEMINI_API_KEY

class GeminiAPI:
    def __init__(self):
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        else:
            self.model = None
            print("⚠️  No Gemini API key found. Using fallback responses.")

    def generate_response(self, prompt: str) -> str:
        if not self.model:
            return self._get_fallback_syllabus()
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"❌ Gemini API error: {e}")
            return self._get_fallback_syllabus()

    def _get_fallback_syllabus(self) -> str:
        return '''{
  "goal": "python programming",
  "units": [
    {
      "title": "Python Fundamentals",
      "lessons": [
        "Introduction to Python",
        "Variables and Data Types", 
        "Control Structures",
        "Functions",
        "Basic I/O Operations"
      ],
      "outcomes": [
        "Understand Python basics",
        "Write simple programs",
        "Use functions effectively"
      ]
    }
  ]
}'''

gemini_api = GeminiAPI()

def chat(prompt: str) -> str:
    return gemini_api.generate_response(prompt)