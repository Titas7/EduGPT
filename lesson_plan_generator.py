# [file name]: enhanced_lesson_plan.py

import json
from datetime import datetime

def generate_comprehensive_lesson_plan(syllabus_file: str = 'generated_syllabus.json'):
    """
    Generate a comprehensive lesson plan with detailed topics, key concepts, and time estimates
    for each unit and lesson from the syllabus.
    """
    
    try:
        with open(syllabus_file, 'r', encoding='utf-8') as f:
            syllabus = json.load(f)
    except FileNotFoundError:
        print(f"❌ Syllabus file '{syllabus_file}' not found.")
        return
    
    print("🎓 COMPREHENSIVE LESSON PLAN GENERATOR")
    print("=" * 60)
    
    course_goal = syllabus.get('goal', 'Unknown Course')
    units = syllabus.get('units', [])
    
    # Calculate total course duration
    total_course_hours = calculate_total_course_duration(course_goal)
    
    lesson_plan = {
        "course": course_goal,
        "generated_date": datetime.now().strftime("%Y-%m-%d"),
        "total_estimated_duration": f"{total_course_hours} hours",
        "total_units": len(units),
        "comprehensive_lesson_plan": {}
    }
    
    # Generate lesson plan for each unit
    for unit_index, unit in enumerate(units, 1):
        unit_title = unit.get('title', f'Unit {unit_index}')
        lessons = unit.get('lessons', [])
        outcomes = unit.get('outcomes', [])
        
        # Calculate unit time
        unit_hours = total_course_hours / len(units)
        lesson_hours = unit_hours / len(lessons) if lessons else 0
        
        unit_plan = {
            "unit_title": unit_title,
            "unit_objective": generate_unit_objective(unit_title, outcomes),
            "unit_outcomes": outcomes,
            "unit_duration": f"{unit_hours:.1f} hours",
            "total_lessons": len(lessons),
            "lessons": []
        }
        
        print(f"\n📚 UNIT {unit_index}: {unit_title}")
        print(f"   ⏰ Duration: {unit_hours:.1f} hours")
        print(f"   🎯 Objective: {unit_plan['unit_objective']}")
        print(f"   📋 Key Outcomes:")
        for outcome in outcomes:
            print(f"      • {outcome}")
        
        # Generate detailed lesson plans
        for lesson_index, lesson_title in enumerate(lessons, 1):
            lesson_details = generate_lesson_details(
                lesson_title, lesson_index, lesson_hours, 
                unit_title, course_goal, outcomes
            )
            unit_plan["lessons"].append(lesson_details)
            
            # Print lesson summary
            print(f"\n   📖 Lesson {lesson_index}: {lesson_title}")
            print(f"      ⏰ Duration: {lesson_hours:.1f} hours")
            print(f"      🎯 Key Concepts:")
            for concept in lesson_details.get('key_concepts', [])[:3]:
                print(f"         • {concept}")
            print(f"      📝 Important Topics:")
            for topic in lesson_details.get('important_topics', [])[:2]:
                print(f"         • {topic}")
        
        lesson_plan["comprehensive_lesson_plan"][f"unit_{unit_index}"] = unit_plan
    
    # Save comprehensive lesson plan
    output_file = 'comprehensive_lesson_plan.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lesson_plan, f, indent=2)
    
    print(f"\n✅ Comprehensive lesson plan saved as '{output_file}'")
    
    # Generate formatted text output
    generate_formatted_output(lesson_plan)
    
    return lesson_plan

def calculate_total_course_duration(course_goal: str) -> float:
    """Calculate total course duration based on course goal"""
    goal_lower = course_goal.lower()
    
    if any(x in goal_lower for x in ['introduction', 'basic', 'fundamental', 'crash course', '1 day']):
        return 8.0  # 8 hours
    elif any(x in goal_lower for x in ['intermediate', 'comprehensive', '1 week']):
        return 20.0  # 20 hours
    elif any(x in goal_lower for x in ['advanced', 'complete', 'master', '1 month']):
        return 40.0  # 40 hours
    elif any(x in goal_lower for x in ['expert', 'professional', 'comprehensive mastery']):
        return 60.0  # 60 hours
    else:
        return 24.0  # Default 24 hours

def generate_unit_objective(unit_title: str, outcomes: list) -> str:
    """Generate a unit objective based on title and outcomes"""
    if outcomes:
        return f"Master {unit_title.lower()} concepts and achieve: {', '.join(outcomes[:2])}"
    else:
        return f"Develop comprehensive understanding and practical skills in {unit_title.lower()}"

def generate_lesson_details(lesson_title: str, lesson_index: int, lesson_hours: float, 
                          unit_title: str, course_goal: str, outcomes: list) -> dict:
    """Generate detailed lesson content with topics and key concepts"""
    
    # Extract key concepts from lesson title and context
    key_concepts = extract_key_concepts(lesson_title, unit_title, course_goal)
    
    # Generate important topics
    important_topics = generate_important_topics(lesson_title, unit_title, key_concepts)
    
    # Generate time breakdown
    time_breakdown = generate_time_breakdown(lesson_hours)
    
    return {
        "lesson_number": lesson_index,
        "lesson_title": lesson_title,
        "lesson_duration": f"{lesson_hours:.1f} hours",
        "key_concepts": key_concepts,
        "important_topics": important_topics,
        "time_breakdown": time_breakdown,
        "learning_objectives": generate_learning_objectives(lesson_title, key_concepts),
        "prerequisites": generate_prerequisites(lesson_index, unit_title),
        "assessment_methods": generate_assessment_methods(lesson_title)
    }

def extract_key_concepts(lesson_title: str, unit_title: str, course_goal: str) -> list:
    """Extract key concepts from lesson context"""
    concepts = []
    
    # Common concept mappings
    concept_map = {
        'introduction': ['Fundamental Principles', 'Basic Terminology', 'Course Overview'],
        'basic': ['Core Concepts', 'Fundamental Techniques', 'Essential Skills'],
        'fundamental': ['Key Principles', 'Basic Operations', 'Core Methodology'],
        'advanced': ['Complex Techniques', 'Advanced Applications', 'Expert Methods'],
        'project': ['Practical Implementation', 'Real-world Application', 'Project Development'],
        'lab': ['Hands-on Practice', 'Experimental Learning', 'Skill Application'],
        'practice': ['Skill Development', 'Application Exercises', 'Practical Scenarios']
    }
    
    lesson_lower = lesson_title.lower()
    unit_lower = unit_title.lower()
    
    # Add concepts based on keywords
    for keyword, concept_list in concept_map.items():
        if keyword in lesson_lower:
            concepts.extend(concept_list)
    
    # Add unit-specific concepts
    if 'python' in unit_lower or 'programming' in unit_lower:
        concepts.extend(['Syntax', 'Data Structures', 'Control Flow', 'Functions'])
    if 'data' in unit_lower:
        concepts.extend(['Data Analysis', 'Data Manipulation', 'Data Visualization'])
    if 'machine learning' in unit_lower:
        concepts.extend(['Algorithms', 'Model Training', 'Prediction', 'Evaluation'])
    if 'statistics' in unit_lower:
        concepts.extend(['Descriptive Statistics', 'Probability', 'Inferential Methods'])
    
    # Ensure we have at least 3 concepts
    while len(concepts) < 3:
        concepts.append(f"Core Concept {len(concepts) + 1}")
    
    return concepts[:5]  # Return max 5 concepts

def generate_important_topics(lesson_title: str, unit_title: str, key_concepts: list) -> list:
    """Generate important topics for the lesson"""
    topics = []
    
    # Base topics from lesson title
    topics.append(f"Understanding {lesson_title}")
    topics.append(f"Practical applications of {lesson_title}")
    
    # Add concept-specific topics
    for concept in key_concepts[:2]:
        topics.append(f"Deep dive into {concept}")
    
    # Add unit-specific topics
    unit_lower = unit_title.lower()
    if 'python' in unit_lower:
        topics.extend(['Code Examples', 'Best Practices', 'Common Pitfalls'])
    if 'data' in unit_lower:
        topics.extend(['Data Processing', 'Analysis Techniques', 'Result Interpretation'])
    
    return topics[:6]  # Return max 6 topics

def generate_time_breakdown(lesson_hours: float) -> dict:
    """Generate detailed time breakdown for the lesson"""
    total_minutes = lesson_hours * 60
    
    return {
        "theory_concepts": f"{int(total_minutes * 0.3)} minutes",
        "practical_exercises": f"{int(total_minutes * 0.4)} minutes",
        "examples_demonstrations": f"{int(total_minutes * 0.2)} minutes",
        "review_assessment": f"{int(total_minutes * 0.1)} minutes"
    }

def generate_learning_objectives(lesson_title: str, key_concepts: list) -> list:
    """Generate learning objectives for the lesson"""
    objectives = [
        f"Understand the core principles of {lesson_title}",
        f"Apply {key_concepts[0] if key_concepts else 'key concepts'} in practical scenarios",
        f"Demonstrate proficiency in {lesson_title} techniques"
    ]
    
    if len(key_concepts) > 1:
        objectives.append(f"Analyze relationships between {key_concepts[0]} and {key_concepts[1]}")
    
    return objectives

def generate_prerequisites(lesson_index: int, unit_title: str) -> list:
    """Generate prerequisites for the lesson"""
    if lesson_index == 1:
        return ["Basic computer literacy", "Willingness to learn"]
    else:
        return [
            f"Completion of previous lessons in {unit_title}",
            "Understanding of fundamental concepts covered earlier",
            "Basic practical skills from preceding lessons"
        ]

def generate_assessment_methods(lesson_title: str) -> list:
    """Generate assessment methods for the lesson"""
    return [
        f"Practical exercise on {lesson_title}",
        "Concept understanding quiz",
        "Hands-on project application",
        "Peer review and discussion"
    ]

def generate_formatted_output(lesson_plan: dict):
    """Generate a beautifully formatted text output of the lesson plan"""
    
    output_file = 'formatted_lesson_plan.txt'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("🎓 COMPREHENSIVE LESSON PLAN\n")
        f.write("=" * 60 + "\n\n")
        
        f.write(f"COURSE: {lesson_plan['course']}\n")
        f.write(f"TOTAL DURATION: {lesson_plan['total_estimated_duration']}\n")
        f.write(f"TOTAL UNITS: {lesson_plan['total_units']}\n")
        f.write(f"GENERATED: {lesson_plan['generated_date']}\n\n")
        
        f.write("=" * 60 + "\n")
        f.write("DETAILED UNIT-BY-UNIT LESSON PLAN\n")
        f.write("=" * 60 + "\n\n")
        
        comprehensive_plan = lesson_plan['comprehensive_lesson_plan']
        
        for unit_key, unit_data in comprehensive_plan.items():
            f.write(f"📚 {unit_data['unit_title'].upper()}\n")
            f.write("-" * 50 + "\n")
            f.write(f"Unit Objective: {unit_data['unit_objective']}\n")
            f.write(f"Duration: {unit_data['unit_duration']} | Lessons: {unit_data['total_lessons']}\n\n")
            
            f.write("Unit Outcomes:\n")
            for outcome in unit_data['unit_outcomes']:
                f.write(f"  • {outcome}\n")
            f.write("\n")
            
            for lesson in unit_data['lessons']:
                f.write(f"  📖 LESSON {lesson['lesson_number']}: {lesson['lesson_title']}\n")
                f.write(f"     Duration: {lesson['lesson_duration']}\n\n")
                
                f.write("     Key Concepts:\n")
                for concept in lesson['key_concepts']:
                    f.write(f"       • {concept}\n")
                
                f.write("\n     Important Topics:\n")
                for topic in lesson['important_topics']:
                    f.write(f"       • {topic}\n")
                
                f.write("\n     Time Breakdown:\n")
                for activity, time in lesson['time_breakdown'].items():
                    f.write(f"       • {activity.replace('_', ' ').title()}: {time}\n")
                
                f.write("\n     Learning Objectives:\n")
                for objective in lesson['learning_objectives']:
                    f.write(f"       • {objective}\n")
                
                f.write("\n" + "  " + "-" * 40 + "\n\n")
            
            f.write("=" * 60 + "\n\n")
    
    print(f"✅ Formatted lesson plan saved as '{output_file}'")

# Main execution
if __name__ == "__main__":
    generate_comprehensive_lesson_plan()
