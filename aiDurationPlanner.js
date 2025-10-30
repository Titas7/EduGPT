// scripts/aiDurationPlanner.js

class AIDurationPlanner {
    static async getSmartDuration(learningGoal, useAI = true) {
        if (!useAI) {
            // Fallback to basic duration parser
            return DurationParser.parseDuration(learningGoal);
        }

        try {
            console.log('🤖 Consulting AI for smart duration planning...');
            
            const response = await fetch(`${API_BASE}/ai/smart-duration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    learning_goal: learningGoal
                })
            });

            if (!response.ok) {
                throw new Error('AI service unavailable');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            console.log('✅ AI duration recommendation:', data);
            return data.duration_constraint;

        } catch (error) {
            console.warn('❌ AI duration planning failed, using fallback:', error);
            // Fallback to basic duration parser
            return DurationParser.parseDuration(learningGoal);
        }
    }

    static async generateSmartStudyPlan(learningGoal, durationConstraint) {
        try {
            console.log('🤖 Generating AI-optimized study plan...');
            
            const response = await fetch(`${API_BASE}/ai/study-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    learning_goal: learningGoal,
                    duration_constraint: durationConstraint
                })
            });

            if (!response.ok) {
                throw new Error('AI service unavailable');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            return data.study_plan;

        } catch (error) {
            console.warn('❌ AI study plan failed, using basic schedule:', error);
            return DurationParser.generateStudySchedule(durationConstraint);
        }
    }
}