# [file name]: main_enhanced.py

from syllabus_agent import create_syllabus
from lesson_plan_generator import generate_comprehensive_lesson_plan
import json
import os

def main():
    print("🎓 ENHANCED SYLLABUS & LESSON PLAN GENERATOR")
    print("=" * 50)
    
    # Get learning goal from user
    goal = input("Enter your learning goal: ").strip()
    if not goal:
        goal = "Data Science with Python"
        print(f"Using default goal: {goal}")
    
    # Generate syllabus
    print("\n🔄 Generating comprehensive syllabus...")
    syllabus = create_syllabus(goal)
    
    # Save syllabus to file
    with open('generated_syllabus.json', 'w', encoding='utf-8') as f:
        json.dump(syllabus, f, indent=2)
    print("✅ Syllabus saved as 'generated_syllabus.json'")
    
    # Generate comprehensive lesson plan
    print("\n🔄 Generating detailed lesson plan with topics and time estimates...")
    lesson_plan = generate_comprehensive_lesson_plan('generated_syllabus.json')
    
    if lesson_plan:
        print(f"\n📊 GENERATION COMPLETE!")
        print(f"   Course: {syllabus['goal']}")
        print(f"   Total Units: {len(syllabus.get('units', []))}")
        print(f"   Total Duration: {lesson_plan['total_estimated_duration']}")
        
        # Display sample from first unit
        first_unit = list(lesson_plan['comprehensive_lesson_plan'].values())[0]
        print(f"\n📚 SAMPLE FROM FIRST UNIT: {first_unit['unit_title']}")
        print(f"   Unit Duration: {first_unit['unit_duration']}")
        
        if first_unit['lessons']:
            first_lesson = first_unit['lessons'][0]
            print(f"\n   📖 Sample Lesson: {first_lesson['lesson_title']}")
            print(f"      Duration: {first_lesson['lesson_duration']}")
            print(f"      Key Concepts:")
            for concept in first_lesson['key_concepts'][:3]:
                print(f"        • {concept}")
            print(f"      Important Topics:")
            for topic in first_lesson['important_topics'][:2]:
                print(f"        • {topic}")

if __name__ == "__main__":
    main()
