# [file name]: app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import sys
from pathlib import Path
import tempfile
from datetime import datetime
import google.generativeai as genai
from dotenv import load_dotenv
import requests
import json
import time
# Load environment variables
load_dotenv()

# Add current directory to path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

# Configure Gemini AI
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("❌ WARNING: GEMINI_API_KEY not found in .env file")
    print("💡 Create a .env file with: GEMINI_API_KEY=your_actual_key_here")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    print("✅ Gemini AI configured successfully")

# Duration Parser for Backend
class DurationParser:
    @staticmethod
    def parse_duration(learning_goal):
        import re
        time_patterns = [
            r'(\d+)\s*day',
            r'(\d+)\s*hour', 
            r'(\d+)\s*week',
            r'(\d+)\s*month'
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, learning_goal, re.IGNORECASE)
            if match:
                value = int(match.group(1))
                if 'day' in pattern:
                    return value * 24, f"{value} day{'s' if value > 1 else ''}"
                elif 'hour' in pattern:
                    return value, f"{value} hour{'s' if value > 1 else ''}"
                elif 'week' in pattern:
                    return value * 7 * 24, f"{value} week{'s' if value > 1 else ''}"
                elif 'month' in pattern:
                    return value * 30 * 24, f"{value} month{'s' if value > 1 else ''}"
        
        return 24, "1 day"  # Default

    @staticmethod
    def adjust_syllabus_to_duration(syllabus, max_hours):
        """Adjust syllabus to fit within duration constraint"""
        total_lessons = sum(len(unit.get('lessons', [])) for unit in syllabus.get('units', []))
        
        if total_lessons > max_hours:
            # Reduce lessons proportionally but keep at least 1 lesson per unit
            reduction_factor = max_hours / total_lessons
            for unit in syllabus['units']:
                if 'lessons' in unit:
                    new_count = max(1, int(len(unit['lessons']) * reduction_factor))
                    unit['lessons'] = unit['lessons'][:new_count]
        
        return syllabus

# Import available functions
def import_functions():
    functions = {}
    
    # Try to import syllabus_agent
    try:
        from syllabus_agent import create_syllabus
        functions['create_syllabus'] = create_syllabus
        print("✅ syllabus_agent imported successfully")
    except ImportError as e:
        print(f"❌ syllabus_agent import failed: {e}")
        functions['create_syllabus'] = create_fallback_syllabus
    
    # Try to import enhanced_lesson_plan
    try:
        from enhanced_lesson_plan import generate_comprehensive_lesson_plan
        functions['generate_lesson_plan'] = generate_comprehensive_lesson_plan
        print("✅ enhanced_lesson_plan imported successfully")
    except ImportError as e:
        print(f"❌ enhanced_lesson_plan import failed: {e}")
        # Try alternative import
        try:
            from lesson_plan_generator import generate_detailed_lesson_plan
            functions['generate_lesson_plan'] = lambda syllabus_file: generate_detailed_lesson_plan_from_file(syllabus_file, generate_detailed_lesson_plan)
            print("✅ lesson_plan_generator imported successfully")
        except ImportError as e:
            print(f"❌ lesson_plan_generator import failed: {e}")
            functions['generate_lesson_plan'] = generate_fallback_lesson_plan
    
    return functions

def create_fallback_syllabus(goal):
    """Fallback syllabus generator with proper duration handling"""
    print(f"🔄 Using fallback syllabus for: {goal}")
    
    # Parse duration from goal
    total_hours, duration_text = DurationParser.parse_duration(goal)
    study_hours = int(total_hours * 0.7)  # 70% for study, 30% for practice
    
    # Calculate realistic lesson count based on duration
    realistic_lesson_count = min(20, max(3, int(total_hours / 1.5)))  # 1.5 hours per lesson
    
    # Adjust syllabus structure based on duration
    if total_hours <= 8:  # Short course (e.g., 10 hours)
        units_count = max(1, min(3, realistic_lesson_count // 2))
        lessons_per_unit = max(1, realistic_lesson_count // units_count)
    elif total_hours <= 24:  # Medium course
        units_count = max(2, min(4, realistic_lesson_count // 3))
        lessons_per_unit = max(2, realistic_lesson_count // units_count)
    else:  # Longer course
        units_count = max(3, min(6, realistic_lesson_count // 4))
        lessons_per_unit = max(3, realistic_lesson_count // units_count)
    
    # Ensure we don't exceed realistic lesson count
    total_lessons = units_count * lessons_per_unit
    if total_lessons > realistic_lesson_count:
        # Adjust lessons per unit
        lessons_per_unit = max(1, realistic_lesson_count // units_count)
    
    units = []
    for i in range(units_count):
        unit_lessons = []
        for j in range(lessons_per_unit):
            lesson_num = i * lessons_per_unit + j + 1
            if lesson_num <= realistic_lesson_count:
                unit_lessons.append(f"Lesson {lesson_num}: Essential Concept {lesson_num}")
        
        if unit_lessons:  # Only add unit if it has lessons
            units.append({
                "title": f"{goal} - Module {i+1}",
                "lessons": unit_lessons,
                "outcomes": [
                    f"Master core concepts of module {i+1}",
                    f"Apply knowledge in practical scenarios",
                    f"Complete targeted exercises"
                ]
            })
    
    return {
        "goal": goal,
        "duration_constraint": {
            "total_hours": total_hours,
            "duration_text": duration_text,
            "study_hours": study_hours,
            "realistic_lesson_count": realistic_lesson_count
        },
        "units": units
    }

def generate_detailed_lesson_plan_from_file(syllabus_file, generate_function):
    """Adapter for generate_detailed_lesson_plan"""
    try:
        with open(syllabus_file, 'r', encoding='utf-8') as f:
            syllabus = json.load(f)
        
        # Generate lesson plan for first unit and first lesson as sample
        if syllabus.get('units'):
            lesson_plan = generate_function(syllabus, 0, 0)
            return convert_to_comprehensive_format(syllabus, lesson_plan)
        else:
            return generate_fallback_lesson_plan(syllabus_file)
            
    except Exception as e:
        print(f"❌ Error in lesson plan generation: {e}")
        return generate_fallback_lesson_plan(syllabus_file)

def generate_fallback_lesson_plan(syllabus_file):
    """Fallback lesson plan generator with duration awareness"""
    print("🔄 Using fallback lesson plan")
    try:
        with open(syllabus_file, 'r', encoding='utf-8') as f:
            syllabus = json.load(f)
    except:
        syllabus = {"goal": "Unknown Course", "units": []}
    
    # Use duration constraint if available
    duration_constraint = syllabus.get('duration_constraint', {})
    total_hours = duration_constraint.get('total_hours', 24)
    study_hours = duration_constraint.get('study_hours', int(total_hours * 0.7))
    
    # Calculate realistic numbers based on duration
    total_units = len(syllabus.get('units', []))
    total_lessons = sum(len(unit.get('lessons', [])) for unit in syllabus.get('units', []))
    
    # Adjust if total exceeds study hours
    if total_lessons > study_hours:
        reduction_factor = study_hours / total_lessons
        for unit in syllabus.get('units', []):
            if 'lessons' in unit:
                new_count = max(1, int(len(unit['lessons']) * reduction_factor))
                unit['lessons'] = unit['lessons'][:new_count]
        total_lessons = sum(len(unit.get('lessons', [])) for unit in syllabus.get('units', []))
    
    return {
        "course": syllabus.get('goal', 'Unknown Course'),
        "generated_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_estimated_duration": f"{total_hours} hours", 
        "total_units": total_units,
        "duration_constraint": duration_constraint,
        "comprehensive_lesson_plan": {
            f"unit_{i+1}": {
                "unit_title": unit['title'],
                "unit_objective": f"Master {unit['title']} concepts and techniques within allocated time",
                "unit_outcomes": unit.get('outcomes', [
                    "Understand key concepts",
                    "Apply knowledge practically", 
                    "Build practical skills"
                ]),
                "unit_duration": f"{max(2, len(unit.get('lessons', [])) * 1.5)} hours",
                "total_lessons": len(unit.get('lessons', [])),
                "lessons": [
                    {
                        "lesson_number": j + 1,
                        "lesson_title": lesson_title,
                        "lesson_duration": "1.5 hours",
                        "key_concepts": [
                            "Fundamental Principles",
                            "Core Techniques", 
                            "Practical Applications",
                            "Best Practices"
                        ],
                        "important_topics": [
                            "Understanding core concepts",
                            "Hands-on practice exercises",
                            "Real-world examples",
                            "Common challenges and solutions"
                        ],
                        "time_breakdown": {
                            "theory_concepts": "30 min",
                            "practical_exercises": "40 min", 
                            "examples_demonstrations": "15 min",
                            "review_assessment": "5 min"
                        }
                    }
                    for j, lesson_title in enumerate(unit.get('lessons', []))
                ]
            }
            for i, unit in enumerate(syllabus.get('units', []))
        }
    }

def convert_to_comprehensive_format(syllabus, detailed_lesson_plan):
    """Convert detailed lesson plan to comprehensive format"""
    generated_date = detailed_lesson_plan.get('generated_date', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    total_duration = detailed_lesson_plan.get('total_estimated_duration', '20 hours')
    duration_constraint = syllabus.get('duration_constraint', {})
    
    return {
        "course": syllabus['goal'],
        "generated_date": generated_date,
        "total_estimated_duration": total_duration,
        "total_units": len(syllabus.get('units', [])),
        "duration_constraint": duration_constraint,
        "comprehensive_lesson_plan": {
            f"unit_{i+1}": {
                "unit_title": unit['title'],
                "unit_objective": f"Master {unit['title']} concepts",
                "unit_outcomes": unit.get('outcomes', []),
                "unit_duration": f"{max(2, len(unit.get('lessons', [])) * 1.5)} hours",
                "total_lessons": len(unit.get('lessons', [])),
                "lessons": [
                    {
                        "lesson_number": j + 1,
                        "lesson_title": lesson_title,
                        "lesson_duration": "1.5 hours",
                        "key_concepts": [
                            "Core Concepts",
                            "Practical Applications",
                            "Key Techniques"
                        ],
                        "important_topics": [
                            "Fundamental principles",
                            "Hands-on exercises", 
                            "Real-world applications"
                        ],
                        "time_breakdown": {
                            "theory_concepts": "30 min",
                            "practical_exercises": "40 min",
                            "examples_demonstrations": "15 min",
                            "review_assessment": "5 min"
                        }
                    }
                    for j, lesson_title in enumerate(unit.get('lessons', []))
                ]
            }
            for i, unit in enumerate(syllabus.get('units', []))
        }
    }

# Import available functions
functions = import_functions()

app = Flask(__name__)
CORS(app)

# Store current data
current_data = {
    'syllabus': None,
    'lesson_plan': None
}

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy', 
        'message': 'Lesson Plan Generator API is running',
        'functions_loaded': {
            'create_syllabus': 'create_syllabus' in functions,
            'generate_lesson_plan': 'generate_lesson_plan' in functions
        },
        'gemini_available': bool(GEMINI_API_KEY)
    })

# AI Duration Planning Endpoints
@app.route('/api/ai/smart-duration', methods=['POST'])
def ai_smart_duration():
    """Use Gemini AI to determine realistic duration with STRICT hour enforcement"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        learning_goal = data.get('learning_goal', '').strip()
        
        if not learning_goal:
            return jsonify({'error': 'Learning goal is required'}), 400

        print(f"🤖 Analyzing duration for: {learning_goal}")

        # FIRST: Parse duration using our strict parser
        total_hours, duration_text = DurationParser.parse_duration(learning_goal)
        is_hour_constrained = 'hour' in learning_goal.lower() or 'hr' in learning_goal.lower()
        
        print(f"📅 Parsed duration: {total_hours} hours ('{duration_text}')")
        print(f"⏰ Hour constrained: {is_hour_constrained}")

        # If it's hour-constrained, FORCE the hour constraint
        if is_hour_constrained and GEMINI_API_KEY:
            print("🚨 HOUR CONSTRAINT DETECTED - Using AI with strict enforcement")
            
            prompt = f"""
            CRITICAL: This learning goal specifies a time constraint in HOURS: "{learning_goal}"
            
            You MUST respect this exact hour constraint of {total_hours} hours.
            DO NOT convert this to days or weeks. The user explicitly wants this in {total_hours} hours.
            
            Create a realistic learning plan that fits within {total_hours} total hours.
            Since this is time-constrained, focus on the MOST ESSENTIAL topics only.
            
            Consider:
            - What are the absolute minimum core concepts needed?
            - Prioritize practical, hands-on learning
            - Include brief practice sessions within the time limit
            - Suggest an intensive but achievable pace
            
            Respond ONLY with this JSON format:
            {{
                "total_days": {max(1, total_hours // 3)},
                "daily_study_hours": {min(4, max(1, total_hours))},
                "total_study_hours": {total_hours},
                "difficulty_level": "intensive",
                "rationale": "Respecting explicit hour constraint: {total_hours} hours total",
                "recommended_pace": "intensive", 
                "is_realistic": true,
                "respects_time_constraint": true,
                "constraint_type": "hours"
            }}
            
            IMPORTANT: total_study_hours MUST be exactly {total_hours}
            """
            
            try:
                model = genai.GenerativeModel('gemini-2.0-flash-exp')
                response = model.generate_content(prompt)
                
                ai_response = response.text.strip()
                print(f"🤖 Gemini response: {ai_response}")
                
                # Extract JSON from response
                if '```json' in ai_response:
                    json_str = ai_response.split('```json')[1].split('```')[0].strip()
                elif '```' in ai_response:
                    json_str = ai_response.split('```')[1].split('```')[0].strip()
                else:
                    json_str = ai_response
                
                duration_data = json.loads(json_str)
                
                # FORCE the hour constraint regardless of AI response
                duration_data['total_study_hours'] = total_hours
                duration_data['total_days'] = 1  # Show as single intensive session
                duration_data['daily_study_hours'] = total_hours
                duration_data['respects_time_constraint'] = True
                duration_data['constraint_type'] = 'hours'
                
            except Exception as ai_error:
                print(f"❌ Gemini AI error: {ai_error}")
                # Fallback for hour-constrained goals
                duration_data = {
                    "total_days": 1,
                    "daily_study_hours": total_hours,
                    "total_study_hours": total_hours,
                    "difficulty_level": "intensive",
                    "rationale": f"Intensive {total_hours}-hour learning session",
                    "recommended_pace": "intensive",
                    "is_realistic": True,
                    "respects_time_constraint": True,
                    "constraint_type": "hours"
                }
        else:
            # For non-hour-constrained goals, use normal AI analysis
            if GEMINI_API_KEY:
                prompt = f"""
                Analyze this learning goal and suggest a realistic duration: "{learning_goal}"
                
                Consider:
                - Complexity of the topic
                - Prerequisites needed
                - Practical vs theoretical focus
                - Reasonable daily study time (2-4 hours)
                - Need for practice and review time
                
                Respond ONLY with this JSON format:
                {{
                    "total_days": number,
                    "daily_study_hours": number,
                    "total_study_hours": number,
                    "difficulty_level": "beginner|intermediate|advanced|intensive",
                    "rationale": "brief explanation",
                    "recommended_pace": "gentle|moderate|intensive",
                    "is_realistic": true,
                    "respects_time_constraint": true,
                    "constraint_type": "calculated"
                }}
                """
                
                try:
                    model = genai.GenerativeModel('gemini-2.0-flash-exp')
                    response = model.generate_content(prompt)
                    
                    ai_response = response.text.strip()
                    print(f"🤖 Gemini response: {ai_response}")
                    
                    # Extract JSON from response
                    if '```json' in ai_response:
                        json_str = ai_response.split('```json')[1].split('```')[0].strip()
                    elif '```' in ai_response:
                        json_str = ai_response.split('```')[1].split('```')[0].strip()
                    else:
                        json_str = ai_response
                    
                    duration_data = json.loads(json_str)
                    
                except Exception as ai_error:
                    print(f"❌ Gemini AI error: {ai_error}")
                    # Fallback calculation
                    total_days = max(1, int(total_hours / 3))
                    duration_data = {
                        "total_days": total_days,
                        "daily_study_hours": min(4, max(2, int(total_hours / total_days))),
                        "total_study_hours": total_hours,
                        "difficulty_level": "intermediate",
                        "rationale": f"Standard duration calculation: {duration_text}",
                        "recommended_pace": "moderate",
                        "is_realistic": True,
                        "respects_time_constraint": True,
                        "constraint_type": "calculated"
                    }
            else:
                total_days = max(1, int(total_hours / 3))
                duration_data = {
                    "total_days": total_days,
                    "daily_study_hours": min(4, max(2, int(total_hours / total_days))),
                    "total_study_hours": total_hours,
                    "difficulty_level": "intermediate",
                    "rationale": f"Standard duration calculation: {duration_text}",
                    "recommended_pace": "moderate",
                    "is_realistic": True,
                    "respects_time_constraint": True,
                    "constraint_type": "calculated"
                }

        # Convert to frontend format - MODIFIED: Remove Study Period and Daily Commitment
        duration_constraint = {
            "totalDays": duration_data["total_days"],
            "totalHours": duration_data["total_study_hours"],
            "durationText": f"{duration_data['total_study_hours']} hours",  # Always show hours only
            "dailyStudyHours": duration_data["daily_study_hours"],
            "studyHours": duration_data["total_study_hours"],
            "practiceHours": max(1, int(duration_data["total_study_hours"] * 0.2)),
            "difficultyLevel": duration_data["difficulty_level"],
            "rationale": duration_data["rationale"],
            "recommendedPace": duration_data["recommended_pace"],
            "isRealistic": duration_data.get("is_realistic", True),
            "respectsTimeConstraint": duration_data.get("respects_time_constraint", True),
            "constraintType": duration_data.get("constraint_type", "standard"),
            "aiOptimized": True
        }
        
        print(f"✅ Final duration constraint: {duration_constraint}")
        
        return jsonify({
            "duration_constraint": duration_constraint,
            "ai_analysis": duration_data
        })
        
    except Exception as e:
        print(f"❌ AI duration analysis failed: {str(e)}")
        # Emergency fallback
        total_hours, duration_text = DurationParser.parse_duration(learning_goal)
        is_hour_constrained = 'hour' in learning_goal.lower() or 'hr' in learning_goal.lower()
        
        if is_hour_constrained:
            # FORCE hour constraint in fallback
            fallback_constraint = {
                "totalDays": 1,
                "totalHours": total_hours,
                "durationText": f"{total_hours} hours",
                "dailyStudyHours": total_hours,
                "studyHours": total_hours,
                "practiceHours": max(1, int(total_hours * 0.2)),
                "difficultyLevel": "intensive",
                "rationale": f"Intensive {total_hours}-hour crash course",
                "recommendedPace": "intensive",
                "isRealistic": True,
                "respectsTimeConstraint": True,
                "constraintType": "hours",
                "aiOptimized": False
            }
        else:
            total_days = max(1, int(total_hours / 3))
            fallback_constraint = {
                "totalDays": total_days,
                "totalHours": total_hours,
                "durationText": f"{total_hours} hours",  # Show only hours, not days
                "dailyStudyHours": min(4, max(2, int(total_hours / total_days))),
                "studyHours": total_hours,
                "practiceHours": max(1, int(total_hours * 0.3)),
                "difficultyLevel": "intermediate",
                "rationale": f"Basic duration calculation: {total_hours} hours",
                "recommendedPace": "moderate",
                "isRealistic": True,
                "respectsTimeConstraint": True,
                "constraintType": "calculated",
                "aiOptimized": False
            }
            
        return jsonify({
            "duration_constraint": fallback_constraint,
            "error": str(e),
            "fallback_used": True
        })
@app.route('/api/ai/goal-overview', methods=['POST'])
def ai_goal_overview():
    """Generate an AI overview for the learning goal before syllabus generation"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
        
        learning_goal = data.get('learning_goal', '').strip()
        if not learning_goal:
            return jsonify({'error': 'Learning goal is required'}), 400
        
        if not GEMINI_API_KEY:
            return jsonify({
                "overview": f"Your goal '{learning_goal}' sounds exciting! Unfortunately, Gemini AI is not configured, so I’ll generate a plan using default logic.",
                "ai_generated": False
            })

        print(f"🧠 Generating AI overview for goal: {learning_goal}")

        prompt = f"""
        The user has this learning goal: "{learning_goal}".

        You are an AI mentor. Write a short, encouraging overview (4–6 sentences) that:
        - Acknowledges what the goal is about (summarize the topic briefly)
        - Explains that the topic involves some core concepts and practical skills
        - If the goal’s timeframe seems short (e.g., 'in 1 day' or 'in few hours'), mention gently that it’s ambitious
        - End with motivation like: “Still, I’ll generate a focused plan to help you cover the essentials efficiently.”

        Keep the tone friendly, helpful, and professional.
        Respond with plain text (no JSON, no markdown).
        """

        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(prompt)
        ai_text = response.text.strip()

        print(f"✅ Gemini overview: {ai_text}")
        return jsonify({"overview": ai_text, "ai_generated": True})

    except Exception as e:
        print(f"❌ AI overview generation failed: {e}")
        fallback = f"This goal sounds interesting! I’ll create a focused learning plan to help you get started with {learning_goal}."
        return jsonify({"overview": fallback, "ai_generated": False})
@app.route('/api/ai/resources', methods=['POST'])
def ai_resource_corner():
    """
    Generate AI-curated resources (YouTube-first) and validate links.
    Returns JSON: { goal, resources: [ {title,type,url,verified} ] }
    """
    try:
        payload = request.get_json() or {}
        learning_goal = payload.get("learning_goal", "").strip()
        if not learning_goal:
            return jsonify({"error": "learning_goal required"}), 400

        print(f"🎯 Generating resources for: {learning_goal}")

        if not GEMINI_API_KEY:
            # Fallback static resources when Gemini not configured
            fallback = [
                {"title": "React Native Docs", "type": "Article", "url": "https://reactnative.dev/docs/getting-started", "verified": True}
            ]
            return jsonify({"goal": learning_goal, "resources": fallback, "ai_generated": False})

        # Build a focused prompt that asks for JSON only (YouTube prioritized)
        prompt = f"""
        Provide a JSON array of high-quality resources for learning: "{learning_goal}".
        PRIORITIZE YouTube videos FIRST (5 recommended), then 3 web articles, include PDFs if available.
        Output JSON only. Example:
        [
          {{"title":"...","type":"YouTube"|"Article"|"PDF","url":"https://..."}},
          ...
        ]
        """

        model = genai.GenerativeModel("gemini-2.0-flash-exp")

        # Try multiple attempts for 429 errors
        raw_text = None
        for attempt in range(4):
            try:
                response = model.generate_content(prompt)
                raw_text = response.text.strip()
                break
            except Exception as e:
                errstr = str(e)
                # handle 429 or transient errors with backoff
                if "429" in errstr or "Resource exhausted" in errstr:
                    wait = 2 ** attempt
                    print(f"⏳ AI rate limit / 429 — retrying in {wait}s (attempt {attempt+1})")
                    time.sleep(wait)
                    continue
                else:
                    print("❌ AI generation error:", e)
                    raise

        if not raw_text:
            return jsonify({"error": "AI temporarily unavailable"}), 503

        # Extract JSON block if wrapped in ```json``` or similar
        if "```json" in raw_text:
            raw_json = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in raw_text:
            raw_json = raw_text.split("```", 1)[1].split("```", 1)[0].strip()
        else:
            raw_json = raw_text

        try:
            resources_list = json.loads(raw_json)
        except Exception as e:
            # If parsing fails, log and return a safe fallback
            print("⚠️ Could not parse AI JSON. Raw response:", raw_text[:400])
            return jsonify({"error": "AI returned invalid JSON", "raw": raw_text}), 500

        # Validate each resource (YouTube verification via oEmbed)
        validated = []
        for r in resources_list:
            try:
                r_title = r.get("title", "").strip()
                r_type = r.get("type", "").strip()
                r_url = r.get("url", "").strip()
                verified = False

                if not r_url:
                    r["verified"] = False
                    continue

                if r_type.lower() == "youtube" or "youtube.com" in r_url or "youtu.be" in r_url:
                    # Use YouTube oEmbed to check existence
                    oembed_url = f"https://www.youtube.com/oembed?url={requests.utils.requote_uri(r_url)}&format=json"
                    try:
                        resp = requests.get(oembed_url, timeout=6)
                        if resp.status_code == 200:
                            verified = True
                    except requests.RequestException as re:
                        # network error treat as unverified but keep for now
                        print("⚠️ YouTube oEmbed check failed:", re)
                        verified = False
                else:
                    # For articles / pdfs, try a HEAD request (some servers may not support HEAD)
                    try:
                        head = requests.head(r_url, allow_redirects=True, timeout=6)
                        if head.status_code >= 200 and head.status_code < 400:
                            verified = True
                        else:
                            # Try GET as fallback (some servers block HEAD)
                            getr = requests.get(r_url, timeout=6)
                            if getr.status_code >= 200 and getr.status_code < 400:
                                verified = True
                    except requests.RequestException as re:
                        print("⚠️ Link validation failed for", r_url, re)
                        verified = False

                r_out = {
                    "title": r_title or r_url,
                    "type": "YouTube" if "youtube" in r_type.lower() or "youtu" in r_url else (r_type or "Article"),
                    "url": r_url,
                    "verified": verified
                }

                # Option: only include verified items. If you want to keep unverified but mark them, comment out the next two lines.
                if verified:
                    validated.append(r_out)
                else:
                    # If you'd like to keep unverified entries but mark them, use validated.append(r_out)
                    print("ℹ️ Dropping unverified resource:", r_out.get("url"))

            except Exception as e:
                print("⚠️ Error validating resource entry:", r, e)
                continue

        # If AI returned no verified YT items, optionally fall back to a minimal curated list
        if len(validated) == 0:
            print("⚠️ No verified resources found — returning fallback list.")
            fallback = [
                {"title": "React Native Docs", "type": "Article", "url": "https://reactnative.dev/docs/getting-started", "verified": True}
            ]
            return jsonify({"goal": learning_goal, "resources": fallback, "ai_generated": True})

        return jsonify({"goal": learning_goal, "resources": validated, "ai_generated": True})

    except Exception as e:
        print("❌ Exception in ai_resource_corner:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/study-plan', methods=['POST'])
def ai_study_plan():
    """Use Gemini AI to generate optimized study schedule - MODIFIED to remove Day Xh format"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        learning_goal = data.get('learning_goal', '').strip()
        duration_constraint = data.get('duration_constraint', {})
        
        if not learning_goal:
            return jsonify({'error': 'Learning goal is required'}), 400

        if not GEMINI_API_KEY:
            return jsonify({'error': 'Gemini API key not configured'}), 500

        print(f"🤖 Gemini generating study plan for: {learning_goal}")

        prompt = f"""
        Create an optimized daily study plan for this learning goal:
        "{learning_goal}"

        Duration: {duration_constraint.get('totalDays', 1)} days
        Daily Study Time: {duration_constraint.get('dailyStudyHours', 3)} hours per day
        Total Study Hours: {duration_constraint.get('studyHours', 6)} hours
        Difficulty: {duration_constraint.get('difficultyLevel', 'intermediate')}
        Pace: {duration_constraint.get('recommendedPace', 'moderate')}

        Generate a realistic daily schedule that builds knowledge progressively.
        Each day should have:
        - Specific, achievable learning objectives
        - Key topics to cover (prioritize most important concepts)
        - Suggested practice activities (hands-on exercises)
        - Recommended breaks and study techniques

        IMPORTANT: Do NOT include hours in the day headers (e.g., use "Day 1" NOT "Day 13h")
        Focus on the content and learning objectives only.

        Make it practical and achievable for the given timeframe.

        Respond ONLY with JSON format:
        {{
            "study_plan": [
                {{
                    "day": 1,
                    "focus_area": "main topic for the day",
                    "learning_objectives": ["specific objective 1", "specific objective 2"],
                    "key_topics": ["topic 1", "topic 2", "topic 3"],
                    "practice_activities": ["hands-on activity 1", "practice exercise 2"],
                    "break_recommendations": "suggested break schedule (e.g., 25min study, 5min break)",
                    "estimated_hours": number
                }}
            ],
            "learning_strategy": "brief explanation of overall learning approach",
            "success_tips": ["practical tip 1", "tip 2", "tip 3"]
        }}
        """
        
        try:
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            response = model.generate_content(prompt)
            
            ai_response = response.text.strip()
            print(f"🤖 Gemini study plan response: {ai_response}")
            
            # Extract JSON from response
            if '```json' in ai_response:
                json_str = ai_response.split('```json')[1].split('```')[0].strip()
            elif '```' in ai_response:
                json_str = ai_response.split('```')[1].split('```')[0].strip()
            else:
                json_str = ai_response
            
            study_plan_data = json.loads(json_str)
            
            # Clean up any remaining hour references in focus areas
            for day_plan in study_plan_data.get('study_plan', []):
                if 'focus_area' in day_plan:
                    # Remove any hour patterns like "Day 13h" -> "Day 1"
                    day_plan['focus_area'] = clean_study_schedule_content(day_plan['focus_area'])
                
                # Also clean learning objectives
                if 'learning_objectives' in day_plan:
                    day_plan['learning_objectives'] = [
                        clean_study_schedule_content(obj) for obj in day_plan['learning_objectives']
                    ]
            
        except Exception as ai_error:
            print(f"❌ Gemini AI error: {ai_error}")
            # Fallback study plan - MODIFIED to remove hours
            study_plan_data = {
                "study_plan": [],
                "learning_strategy": "Progressive learning from fundamentals to advanced topics",
                "success_tips": [
                    "Take regular breaks to maintain focus",
                    "Practice consistently to reinforce learning",
                    "Review previous lessons before starting new ones"
                ]
            }
            
            total_days = duration_constraint.get('totalDays', 1)
            for day in range(1, total_days + 1):
                if day == 1:
                    focus = "Fundamentals & Setup"
                    objectives = ["Understand basic concepts", "Set up learning environment"]
                elif day == total_days:
                    focus = "Review & Projects"
                    objectives = ["Review all concepts", "Complete practical project"]
                elif day <= total_days * 0.3:
                    focus = "Core Concepts"
                    objectives = ["Master essential topics", "Build foundational knowledge"]
                elif day <= total_days * 0.7:
                    focus = "Advanced Topics"
                    objectives = ["Learn advanced techniques", "Solve complex problems"]
                else:
                    focus = "Practice & Implementation"
                    objectives = ["Apply knowledge practically", "Build real projects"]
                
                study_plan_data["study_plan"].append({
                    "day": day,
                    "focus_area": focus,
                    "learning_objectives": objectives,
                    "key_topics": [f"Key topic {day}.1", f"Key topic {day}.2"],
                    "practice_activities": [f"Practice exercise {day}.1", f"Hands-on activity {day}.2"],
                    "break_recommendations": "25 minutes study, 5 minutes break",
                    "estimated_hours": duration_constraint.get('dailyStudyHours', 3)
                })
        
        print(f"✅ AI study plan generated with {len(study_plan_data['study_plan'])} days")
        
        return jsonify({
            "study_plan": study_plan_data,
            "ai_optimized": True
        })
        
    except Exception as e:
        print(f"❌ AI study plan generation failed: {str(e)}")
        # Fallback to basic schedule - MODIFIED to remove hours
        basic_schedule = []
        total_days = duration_constraint.get('totalDays', 1)
        daily_hours = duration_constraint.get('dailyStudyHours', 3)
        
        for day in range(1, total_days + 1):
            if day == 1:
                focus = "Fundamentals & Setup"
            elif day == total_days:
                focus = "Review & Projects"
            elif day <= total_days * 0.3:
                focus = "Core Concepts"
            elif day <= total_days * 0.7:
                focus = "Advanced Topics"
            else:
                focus = "Practice & Implementation"
                
            basic_schedule.append({
                "day": day,
                "focus_area": focus,
                "study_hours": daily_hours
            })
        
        return jsonify({
            "study_plan": {
                "study_plan": basic_schedule,
                "learning_strategy": "Progressive learning from basics to advanced",
                "success_tips": ["Take regular breaks", "Practice consistently", "Review previous lessons"]
            },
            "ai_optimized": False,
            "error": str(e)
        })
def clean_study_schedule_content(content):
    """Remove Study Period and Daily Commitment patterns from content"""
    import re
    
    if not content:
        return content
    
    # Remove "Day Xh" patterns (e.g., "Day 13h" -> "Day 1")
    content = re.sub(r'Day\s*(\d+)\s*\d*h', r'Day \1', content, flags=re.IGNORECASE)
    
    # Remove Study Period patterns
    content = re.sub(r'\d+\s*Day\s*Study\s*Period\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'Study\s*Period\s*', '', content, flags=re.IGNORECASE)
    
    # Remove Daily Commitment patterns  
    content = re.sub(r'\d+h\/Day\s*Daily\s*Commitment\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'Daily\s*Commitment\s*', '', content, flags=re.IGNORECASE)
    
    # Clean up any double spaces or empty lines
    content = re.sub(r'\s+', ' ', content).strip()
    
    return content

@app.route('/api/generate-plan', methods=['POST'])
def generate_plan():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        learning_goal = data.get('goal', '').strip()
        duration_constraint = data.get('duration_constraint', {})
        
        if not learning_goal:
            return jsonify({'error': 'Learning goal is required'}), 400
        
        print(f"🎯 Generating lesson plan for: {learning_goal}")
        print(f"⏰ Duration constraint: {duration_constraint}")
        
        # Generate syllabus with duration awareness
        syllabus = functions['create_syllabus'](learning_goal)
        
        # Apply duration constraint if provided, otherwise use parsed duration
        if duration_constraint and duration_constraint.get('totalHours'):
            target_hours = duration_constraint['studyHours']
        else:
            # Parse duration from goal
            target_hours, _ = DurationParser.parse_duration(learning_goal)
            target_hours = int(target_hours * 0.7)  # 70% for study
        
        # Always apply duration adjustment to ensure realistic scope
        syllabus = DurationParser.adjust_syllabus_to_duration(syllabus, target_hours)
        syllabus['duration_constraint'] = {
            'total_hours': target_hours / 0.7,  # Convert back to total hours
            'study_hours': target_hours,
            'duration_text': f"{target_hours} study hours"
        }
        
        current_data['syllabus'] = syllabus
        print(f"✅ Syllabus generated with {len(syllabus.get('units', []))} units")
        print(f"📊 Target study hours: {target_hours}")
        
        # Rest of the function remains the same...
        # Save syllabus to temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(syllabus, f, indent=2)
            temp_file = f.name
        
        try:
            # Generate lesson plan
            lesson_plan = functions['generate_lesson_plan'](temp_file)
            current_data['lesson_plan'] = lesson_plan
            print("✅ Lesson plan generated successfully")
            
        except Exception as e:
            print(f"❌ Lesson plan generation failed: {e}")
            lesson_plan = generate_fallback_lesson_plan(temp_file)
            current_data['lesson_plan'] = lesson_plan
            print("🔄 Using fallback lesson plan")
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        return jsonify(lesson_plan)
        
    except Exception as e:
        print(f"❌ Error in generate_plan: {str(e)}")
        return jsonify({'error': f'Failed to generate lesson plan: {str(e)}'}), 500

@app.route('/api/download-syllabus', methods=['GET'])
def download_syllabus():
    try:
        if not current_data['syllabus']:
            return jsonify({'error': 'No syllabus available. Generate a lesson plan first.'}), 400
        
        return jsonify({
            'syllabus': current_data['syllabus'],
            'filename': f"{current_data['syllabus']['goal'].replace(' ', '_')}_syllabus.json"
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Other existing routes remain the same...
@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Handle AI chat messages"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
        
        user_message = data.get('message', '').strip()
        course_context = data.get('course_context', {})
        chat_history = data.get('chat_history', [])
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Generate AI response
        try:
            from ai_service import ai_assistant
            ai_response = ai_assistant.generate_learning_response(
                user_message, 
                course_context, 
                chat_history
            )
        except:
            # Fallback AI response
            ai_response = f"I'm here to help you learn about {course_context.get('current_topic', 'your course')}. For detailed assistance, please ensure the AI service is properly configured."
        
        return jsonify({
            'response': ai_response,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
    except Exception as e:
        print(f"Error in AI chat: {e}")
        return jsonify({'error': f'AI service error: {str(e)}'}), 500

@app.route('/api/ai/quick-action', methods=['POST'])
def ai_quick_action():
    """Handle quick actions like examples, quizzes, etc."""
    try:
        data = request.get_json()
        action_type = data.get('action_type', '')
        course_context = data.get('course_context', {})
        
        # Create specific prompts for different actions
        action_prompts = {
            'example': f"Provide a practical, real-world example related to {course_context.get('current_unit', 'the current topic')}. Include code if it's a programming topic.",
            'quiz': f"Create a short quiz (2-3 questions) about {course_context.get('current_unit', 'the current topic')}. Include multiple choice questions with explanations.",
            'practice': f"Provide a hands-on practice exercise for {course_context.get('current_unit', 'the current topic')}. Make it practical and include step-by-step guidance.",
            'explain': f"Explain the key concepts of {course_context.get('current_unit', 'the current topic')} in simple terms. Break it down for a beginner."
        }
        
        user_message = action_prompts.get(action_type, "Help with learning this topic")
        
        try:
            from ai_service import ai_assistant
            ai_response = ai_assistant.generate_learning_response(
                user_message, 
                course_context, 
                []
            )
        except:
            ai_response = f"I can help with {action_type} for {course_context.get('current_unit', 'this topic')}. Please ensure the AI service is properly configured."
        
        return jsonify({
            'response': ai_response,
            'action_type': action_type
        })
        
    except Exception as e:
        print(f"Error in AI quick action: {e}")
        return jsonify({'error': f'AI service error: {str(e)}'}), 500
        
@app.route('/api/test-syllabus', methods=['POST'])
def test_syllabus():
    """Test endpoint to check syllabus generation"""
    try:
        data = request.get_json()
        learning_goal = data.get('goal', 'Test Course')
        
        syllabus = functions['create_syllabus'](learning_goal)
        
        return jsonify({
            'status': 'success',
            'syllabus': syllabus,
            'units_count': len(syllabus.get('units', [])),
            'total_lessons': sum(len(unit.get('lessons', [])) for unit in syllabus.get('units', []))
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate quiz questions using Gemini AI"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
        
        user_message = data.get('message', '').strip()
        course_context = data.get('course_context', {})
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Generate AI response using the same chat function
        try:
            from llm_api import chat
            ai_response = chat(user_message)
        except:
            ai_response = "Quiz generation service is currently unavailable. Please try again later."
        
        return jsonify({
            'response': ai_response,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
    except Exception as e:
        print(f"Error in AI quiz generation: {e}")
        return jsonify({'error': f'AI service error: {str(e)}'}), 500
def clean_study_schedule_content(content):
    """Remove Study Period and Daily Commitment patterns from content"""
    import re
    
    if not content:
        return content
    
    # Remove "Day Xh" patterns (e.g., "Day 13h" -> "Day 1")
    content = re.sub(r'Day\s*(\d+)\s*\d*h', r'Day \1', content, flags=re.IGNORECASE)
    
    # Remove Study Period patterns
    content = re.sub(r'\d+\s*Day\s*Study\s*Period\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'Study\s*Period\s*', '', content, flags=re.IGNORECASE)
    
    # Remove Daily Commitment patterns  
    content = re.sub(r'\d+h\/Day\s*Daily\s*Commitment\s*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'Daily\s*Commitment\s*', '', content, flags=re.IGNORECASE)
    
    # Clean up any double spaces or empty lines
    content = re.sub(r'\s+', ' ', content).strip()
    
    return content
if __name__ == '__main__':
    print("🚀 Starting AI-Powered Lesson Plan Generator Server...")
    print("📝 Access the application at: http://localhost:5000")
    print("🔧 CORS enabled for frontend-backend communication")
    print("🤖 Gemini AI Integration: " + ("✅ Enabled" if GEMINI_API_KEY else "❌ Disabled - Set GEMINI_API_KEY in .env"))
    print("⏰ Smart Duration Planning: ✅ Enabled")
    print("📥 Download features enabled")
    print("🎯 Available functions:", list(functions.keys()))
    app.run(debug=True, port=5000, host='0.0.0.0')