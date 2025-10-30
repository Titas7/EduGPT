# [file name]: duration_parser.py
import re

class DurationParser:
    @staticmethod
    def parse_duration(learning_goal):
        learning_goal_lower = learning_goal.lower()
        
        # STRICT hour matching - prioritize hours above everything else
        hour_patterns = [
            r'(\d+)\s*hour',
            r'(\d+)\s*hr',
            r'(\d+)\s*h\b',  # \b ensures it's not part of another word
        ]
        
        for pattern in hour_patterns:
            match = re.search(pattern, learning_goal_lower)
            if match:
                value = int(match.group(1))
                print(f"🔍 STRICT HOUR MATCH: {value} hours from pattern: {pattern}")
                return value, f"{value} hour{'s' if value > 1 else ''}"
        
        # Only if no hours found, check for other time units
        other_patterns = [
            r'(\d+)\s*day',
            r'(\d+)\s*week', 
            r'(\d+)\s*month'
        ]
        
        for pattern in other_patterns:
            match = re.search(pattern, learning_goal_lower)
            if match:
                value = int(match.group(1))
                if 'day' in pattern:
                    return value * 24, f"{value} day{'s' if value > 1 else ''}"
                elif 'week' in pattern:
                    return value * 7 * 24, f"{value} week{'s' if value > 1 else ''}"
                elif 'month' in pattern:
                    return value * 30 * 24, f"{value} month{'s' if value > 1 else ''}"
        
        # Default based on goal complexity
        if any(x in learning_goal_lower for x in ['basic', 'introduction', 'fundamental', 'crash']):
            return 8, "8 hours"
        elif any(x in learning_goal_lower for x in ['intermediate', 'comprehensive']):
            return 20, "20 hours"
        elif any(x in learning_goal_lower for x in ['advanced', 'master', 'complete']):
            return 40, "40 hours"
        else:
            return 24, "24 hours"

    @staticmethod
    def adjust_syllabus_to_duration(syllabus, max_hours):
        """Adjust syllabus to fit within duration constraint"""
        total_lessons = sum(len(unit.get('lessons', [])) for unit in syllabus.get('units', []))
        
        if total_lessons > max_hours:
            print(f"📊 Adjusting syllabus: {total_lessons} lessons → {max_hours} max hours")
            # Reduce lessons proportionally but keep at least 1 lesson per unit
            reduction_factor = max_hours / total_lessons
            for unit in syllabus['units']:
                if 'lessons' in unit:
                    new_count = max(1, int(len(unit['lessons']) * reduction_factor))
                    unit['lessons'] = unit['lessons'][:new_count]
                    print(f"  → Unit '{unit['title']}': {len(unit['lessons'])} lessons")
        
        return syllabus

    @staticmethod
    def calculate_realistic_lesson_count(total_hours):
        """Calculate realistic number of lessons based on total hours"""
        # For hour-based goals, be more aggressive with lesson count
        lesson_duration = 1.0  # 1 hour per lesson for hour-constrained goals
        practice_ratio = 0.2   # 20% practice time for intensive courses
        
        available_lesson_time = total_hours * (1 - practice_ratio)
        lesson_count = max(1, int(available_lesson_time / lesson_duration))
        print(f"📚 Realistic lesson count for {total_hours}h: {lesson_count} lessons")
        return lesson_count

    @staticmethod
    def is_hour_constrained(learning_goal):
        """Check if the learning goal has an hour constraint"""
        learning_goal_lower = learning_goal.lower()
        hour_indicators = ['hour', 'hr', ' h ']
        return any(indicator in learning_goal_lower for indicator in hour_indicators)