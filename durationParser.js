// scripts/durationParser.js

class DurationParser {
    static parseDuration(learningGoal) {
        const timePatterns = [
            // "X days" pattern
            /(\d+)\s*day(s)?/i,
            // "X hours" pattern  
            /(\d+)\s*hour(s)?/i,
            // "X weeks" pattern
            /(\d+)\s*week(s)?/i,
            // "X months" pattern
            /(\d+)\s*month(s)?/i
        ];

        let totalHours = null;
        let durationText = '';

        for (const pattern of timePatterns) {
            const match = learningGoal.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                
                if (pattern.toString().includes('day')) {
                    totalHours = value * 24; // Convert days to hours
                    durationText = `${value} day${value > 1 ? 's' : ''}`;
                } else if (pattern.toString().includes('hour')) {
                    totalHours = value;
                    durationText = `${value} hour${value > 1 ? 's' : ''}`;
                } else if (pattern.toString().includes('week')) {
                    totalHours = value * 7 * 24; // Convert weeks to hours
                    durationText = `${value} week${value > 1 ? 's' : ''}`;
                } else if (pattern.toString().includes('month')) {
                    totalHours = value * 30 * 24; // Convert months to hours
                    durationText = `${value} month${value > 1 ? 's' : ''}`;
                }
                break;
            }
        }

        // If no specific duration found, use default
        if (!totalHours) {
            totalHours = 24; // Default to 1 day
            durationText = '1 day';
        }

        return {
            totalHours,
            durationText,
            studyHours: Math.floor(totalHours * 0.7), // 70% for actual study
            practiceHours: Math.floor(totalHours * 0.3) // 30% for practice
        };
    }

    static validateAndAdjustPlan(lessonPlan, durationConstraint) {
        const estimatedTotalHours = this.calculateTotalHours(lessonPlan);
        
        if (estimatedTotalHours > durationConstraint.totalHours) {
            return this.adjustPlanToFitDuration(lessonPlan, durationConstraint);
        }
        
        return lessonPlan;
    }

    static calculateTotalHours(lessonPlan) {
        let totalHours = 0;
        
        if (lessonPlan.units) {
            lessonPlan.units.forEach(unit => {
                if (unit.lessons) {
                    unit.lessons.forEach(lesson => {
                        // Estimate 1 hour per lesson if no duration specified
                        totalHours += 1;
                    });
                }
            });
        }
        
        return totalHours;
    }

    static adjustPlanToFitDuration(lessonPlan, durationConstraint) {
        const maxStudyHours = durationConstraint.studyHours;
        const availableHoursPerUnit = maxStudyHours / (lessonPlan.units?.length || 1);
        
        // Adjust lessons per unit to fit duration
        lessonPlan.units.forEach(unit => {
            if (unit.lessons && unit.lessons.length > availableHoursPerUnit) {
                unit.lessons = unit.lessons.slice(0, Math.floor(availableHoursPerUnit));
            }
        });

        // Update course duration in the plan
        lessonPlan.duration = durationConstraint.durationText;
        lessonPlan.totalHours = durationConstraint.totalHours;
        
        return lessonPlan;
    }
}