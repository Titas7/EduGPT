import json
from llm_api import chat

def generate_plan(lesson_id: str, learner_state: dict, syllabus: dict) -> dict:
    prompt = f"""Create lesson plan for {lesson_id}. Level: {learner_state['level']}. 
Previous score: {learner_state['last_score']}. Return JSON:
{{
  "lesson_plan": {{
    "title": "Lesson title",
    "objectives": ["obj1", "obj2"],
    "activities": ["activity1", "activity2"],
    "materials": ["material1", "material2"],
    "assessment": "assessment method",
    "duration": "duration"
  }}
}}"""
    
    response = chat(prompt)
    try:
        return json.loads(response)
    except:
        return {
            "lesson_plan": {
                "title": f"Lesson {lesson_id}",
                "objectives": ["Learn concepts", "Practice skills"],
                "activities": ["Theory", "Practice"],
                "materials": ["Resources"],
                "assessment": "Quiz",
                "duration": "60 minutes"
            }
        }