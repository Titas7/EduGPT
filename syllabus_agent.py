import json
from llm_api import chat

def create_syllabus(goal: str) -> dict:
    prompt = f"""
Create a comprehensive learning syllabus for: {goal}

Return the response as valid JSON in this exact format:
{{
  "goal": "{goal}",
  "units": [
    {{
      "title": "Unit title here",
      "lessons": ["Lesson 1", "Lesson 2", "Lesson 3"],
      "outcomes": ["Outcome 1", "Outcome 2"]
    }}
  ]
}}

Make it practical and well-structured for the learning goal.
"""
    
    print("🔄 Generating syllabus...")
    response = chat(prompt)
    
    try:
        # Clean the response
        cleaned_response = response.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        
        syllabus = json.loads(cleaned_response)
        print("✅ Syllabus generated successfully!")
        return syllabus
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse syllabus: {e}")
        print("Using fallback syllabus...")
        return {
            "goal": goal,
            "units": [{
                "title": f"{goal} Fundamentals",
                "lessons": ["Introduction", "Basic Concepts", "Getting Started"],
                "outcomes": ["Understand basics", "Learn fundamentals"]
            }]
        }