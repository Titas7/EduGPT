// Configuration
const API_BASE = 'http://localhost:5000/api';
let currentLessonPlan = null;
// Filter out unwanted sections from lesson content
// Comprehensive filter to remove unwanted sections from ALL content
function filterUnwantedSections(content) {
    if (!content || typeof content !== 'string') return content || '';
    
    console.log('🔍 Filtering content:', content.substring(0, 100) + '...');
    
    // More aggressive patterns to catch all variations
    const unwantedPatterns = [
        // Study Period patterns
        /# Learning Plan\s*\n.*Study Period.*\n.*Daily Commitment.*\n/gi,
        /\d+\s*Day\s*Study\s*Period\s*/gi,
        /Study\s*Period\s*/gi,
        /Study Period:\s*\d+\s*Days?\s*/gi,
        /Study Period\s*:\s*\d+\s*Days?/gi,
        
        // Daily Commitment patterns
        /\d+h\/Day\s*Daily\s*Commitment\s*/gi,
        /Daily\s*Commitment\s*/gi,
        /Daily Commitment:\s*\d+\s*hours?\s*\/\s*Day\s*/gi,
        /Daily Commitment\s*:\s*\d+h\/Day/gi,
        
        // Combined patterns
        /\d+\s*Day\s*Study\s*Period\s*\n\s*\d+h\/Day\s*Daily\s*Commitment\s*/gi,
        /Study Period.*Daily Commitment/gi,
        /Daily Commitment.*Study Period/gi,
        
        // Hour patterns in day headers
        /Day\s*\d+\s*\d*h/gi,
        /Day\s*\d+h/gi,
        
        // Specific patterns from your example
        /\d+ Day Study Period\s*\n\d+h\/Day Daily Commitment\s*\n/gi
    ];
    
    let filteredContent = content;
    let changesMade = false;
    
    unwantedPatterns.forEach((pattern, index) => {
        const original = filteredContent;
        filteredContent = filteredContent.replace(pattern, '');
        if (original !== filteredContent) {
            changesMade = true;
            console.log(`✅ Removed pattern ${index + 1}`);
        }
    });
    
    // Clean up resulting empty lines and extra spaces
    filteredContent = filteredContent
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/^\s*[\r\n]/gm, '')
        .replace(/\s+$/gm, '')
        .trim();
    
    if (changesMade) {
        console.log('✅ Content filtered successfully');
    }
    
    return filteredContent;
}
// Realistic Duration Parser Class - FIXED VERSION
class DurationParser {
    static parseDuration(learningGoal) {
        const learningGoalLower = learningGoal.toLowerCase();
        
        // STRICT HOUR MATCHING - PRIORITIZE HOURS ABOVE EVERYTHING
        const hourPatterns = [
            /(\d+)\s*hour(s)?/i,
            /(\d+)\s*hr(s)?/i,  
            /(\d+)\s*h\b/i
        ];

        // Check for hours first
        for (const pattern of hourPatterns) {
            const match = learningGoalLower.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                console.log(`🔍 STRICT HOUR MATCH: ${value} hours from '${learningGoal}'`);
                
                // For hour-constrained goals, treat as intensive single-day session
                return {
                    totalDays: 1, // Show as single intensive day
                    totalHours: value,
                    durationText: `${value} hour${value > 1 ? 's' : ''}`,
                    dailyStudyHours: value, // All hours in one day
                    studyHours: value,
                    practiceHours: Math.floor(value * 0.2), // 20% practice for intensive
                    aiOptimized: false,
                    rationale: `Intensive ${value}-hour learning session`,
                    difficultyLevel: "intensive",
                    recommendedPace: "intensive",
                    constraintType: "hours"
                };
            }
        }

        // Only if no hours found, check for other time units
        const otherPatterns = [
            /(\d+)\s*day(s)?/i,
            /(\d+)\s*week(s)?/i,
            /(\d+)\s*month(s)?/i
        ];

        let totalDays = null;
        let totalHours = null;
        let durationText = '';

        for (const pattern of otherPatterns) {
            const match = learningGoalLower.match(pattern);
            if (match) {
                const value = parseInt(match[1]);
                
                if (pattern.toString().includes('day')) {
                    totalDays = value;
                    totalHours = this.calculateRealisticStudyHours(totalDays);
                    durationText = `${value} day${value > 1 ? 's' : ''}`;
                } else if (pattern.toString().includes('week')) {
                    totalDays = value * 7;
                    totalHours = this.calculateRealisticStudyHours(totalDays);
                    durationText = `${value} week${value > 1 ? 's' : ''}`;
                } else if (pattern.toString().includes('month')) {
                    totalDays = value * 30;
                    totalHours = this.calculateRealisticStudyHours(totalDays);
                    durationText = `${value} month${value > 1 ? 's' : ''}`;
                }
                break;
            }
        }

        // Default if no time specified
        if (!totalDays) {
            totalDays = 1;
            totalHours = this.calculateRealisticStudyHours(totalDays);
            durationText = '1 day';
        }

        return {
            totalDays,
            totalHours,
            durationText,
            dailyStudyHours: this.getDailyStudyHours(totalDays),
            studyHours: totalHours,
            practiceHours: Math.floor(totalHours * 0.3),
            aiOptimized: false,
            rationale: "Basic duration calculation",
            difficultyLevel: "intermediate",
            recommendedPace: "moderate",
            constraintType: "calculated"
        };
    }

    static calculateRealisticStudyHours(totalDays) {
        if (totalDays <= 1) return 4;
        if (totalDays <= 3) return totalDays * 3;
        if (totalDays <= 7) return totalDays * 2.5;
        return totalDays * 2;
    }

    static getDailyStudyHours(totalDays) {
        if (totalDays <= 1) return 4;
        if (totalDays <= 3) return 3;
        if (totalDays <= 7) return 2.5;
        return 2;
    }

    static validatePlanDuration(lessonPlan, durationConstraint) {
        const estimatedHours = this.calculateTotalHours(lessonPlan);
        console.log(`📊 Duration Check: Estimated ${estimatedHours}h vs Available ${durationConstraint.studyHours}h`);
        console.log(`📝 Constraint Type: ${durationConstraint.constraintType}`);
        
        if (estimatedHours > durationConstraint.studyHours) {
            console.log(`⚠️ Plan exceeds duration constraint. Adjusting...`);
            return this.adjustPlanToFitDuration(lessonPlan, durationConstraint);
        }
        
        return lessonPlan;
    }

    static calculateTotalHours(lessonPlan) {
        let totalHours = 0;
        
        if (lessonPlan.comprehensive_lesson_plan) {
            Object.values(lessonPlan.comprehensive_lesson_plan).forEach(unit => {
                if (unit.lessons) {
                    unit.lessons.forEach(lesson => {
                        const lessonHours = this.parseLessonDuration(lesson.lesson_duration);
                        totalHours += lessonHours;
                    });
                }
            });
        }
        
        return totalHours;
    }

    static parseLessonDuration(durationText) {
        if (!durationText) return 1;
        
        const hourMatch = durationText.match(/(\d+\.?\d*)\s*hour/i);
        const minuteMatch = durationText.match(/(\d+)\s*min/i);
        
        if (hourMatch) return parseFloat(hourMatch[1]);
        if (minuteMatch) return Math.ceil(parseInt(minuteMatch[1]) / 60);
        
        return 1;
    }

    static adjustPlanToFitDuration(lessonPlan, durationConstraint) {
        const maxStudyHours = durationConstraint.studyHours;
        
        if (lessonPlan.comprehensive_lesson_plan) {
            const units = Object.values(lessonPlan.comprehensive_lesson_plan);
            
            let currentTotalHours = 0;
            const unitHours = [];
            
            // Calculate current hours
            units.forEach(unit => {
                let unitHourCount = 0;
                if (unit.lessons) {
                    unit.lessons.forEach(lesson => {
                        unitHourCount += this.parseLessonDuration(lesson.lesson_duration);
                    });
                }
                unitHours.push(unitHourCount);
                currentTotalHours += unitHourCount;
            });
            
            console.log(`📊 Current total: ${currentTotalHours}h, Max allowed: ${maxStudyHours}h`);
            
            if (currentTotalHours > maxStudyHours) {
                const reductionRatio = maxStudyHours / currentTotalHours;
                console.log(`📉 Reduction ratio: ${reductionRatio}`);
                
                units.forEach((unit, index) => {
                    if (unit.lessons && unit.lessons.length > 0) {
                        const targetUnitHours = Math.max(1, Math.floor(unitHours[index] * reductionRatio));
                        const lessonsPerHour = unit.lessons.length / unitHours[index];
                        const newLessonCount = Math.max(1, Math.floor(targetUnitHours * lessonsPerHour));
                        
                        console.log(`🔄 Unit ${index}: ${unit.lessons.length} → ${newLessonCount} lessons`);
                        
                        unit.lessons = unit.lessons.slice(0, newLessonCount);
                        unit.total_lessons = newLessonCount;
                        unit.unit_duration = `${targetUnitHours} hour${targetUnitHours > 1 ? 's' : ''}`;
                        
                        // Update lesson durations for hour-constrained plans
                        if (durationConstraint.constraintType === 'hours') {
                            unit.lessons.forEach(lesson => {
                                lesson.lesson_duration = "1 hour"; // Standardize for intensive sessions
                            });
                        }
                    }
                });
            }
        }

        lessonPlan.total_estimated_duration = this.formatDurationForDisplay(durationConstraint);
        lessonPlan.original_duration_constraint = durationConstraint;
        
        return lessonPlan;
    }

    static formatDurationForDisplay(durationConstraint) {
        if (durationConstraint.constraintType === 'hours') {
            return `${durationConstraint.studyHours} hour${durationConstraint.studyHours > 1 ? 's' : ''} (Intensive Session)`;
        } else if (durationConstraint.totalDays === 1) {
            return `${durationConstraint.studyHours} hours (1 day)`;
        } else {
            return `${durationConstraint.studyHours} hours (${durationConstraint.totalDays} days)`;
        }
    }

    static generateStudySchedule(durationConstraint) {
        const schedule = [];
        
        // Handle hour-constrained goals differently
        if (durationConstraint.constraintType === 'hours') {
            return [{
                day: 1,
                studyHours: durationConstraint.studyHours,
                focus: "Intensive Learning Session",
                isIntensive: true
            }];
        }
        
        // Normal multi-day schedule
        const totalDays = durationConstraint.totalDays;
        const dailyHours = durationConstraint.dailyStudyHours;
        
        for (let day = 1; day <= totalDays; day++) {
            schedule.push({
                day: day,
                studyHours: dailyHours,
                focus: this.getDailyFocus(day, totalDays)
            });
        }
        
        return schedule;
    }

    static getDailyFocus(day, totalDays) {
        if (day === 1) return "Fundamentals & Setup";
        if (day === totalDays) return "Review & Projects";
        if (day <= Math.ceil(totalDays * 0.3)) return "Core Concepts";
        if (day <= Math.ceil(totalDays * 0.7)) return "Advanced Topics";
        return "Practice & Implementation";
    }

    static isHourConstrained(learningGoal) {
        const learningGoalLower = learningGoal.toLowerCase();
        const hourIndicators = ['hour', 'hr', ' h '];
        return hourIndicators.some(indicator => learningGoalLower.includes(indicator));
    }
}

// AI Duration Planner Class - UPDATED for strict hour enforcement
class AIDurationPlanner {
    static async getSmartDuration(learningGoal, useAI = true) {
        // First check if it's hour-constrained
        const isHourConstrained = DurationParser.isHourConstrained(learningGoal);
        
        if (isHourConstrained) {
            console.log('🚨 HOUR CONSTRAINT DETECTED - Using strict hour enforcement');
            const strictDuration = DurationParser.parseDuration(learningGoal);
            console.log('⏰ Strict hour constraint:', strictDuration);
            return strictDuration;
        }

        if (!useAI) {
            return DurationParser.parseDuration(learningGoal);
        }

        try {
            console.log('🤖 Consulting Gemini AI for smart duration planning...');
            
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

            console.log('✅ AI duration recommendation:', data.duration_constraint);
            return data.duration_constraint;

        } catch (error) {
            console.warn('❌ AI duration planning failed, using fallback:', error);
            return DurationParser.parseDuration(learningGoal);
        }
    }

    static async generateSmartStudyPlan(learningGoal, durationConstraint) {
        try {
            console.log('🤖 Gemini generating AI-optimized study plan...');
            
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
            return {
                study_plan: DurationParser.generateStudySchedule(durationConstraint),
                learning_strategy: durationConstraint.constraintType === 'hours' 
                    ? "Intensive focused learning approach" 
                    : "Progressive learning approach",
                success_tips: durationConstraint.constraintType === 'hours'
                    ? ["Take short breaks every hour", "Stay hydrated", "Focus on practical application"]
                    : ["Take regular breaks", "Practice consistently", "Review previous lessons"]
            };
        }
    }
}

// DOM Elements
// DOM Elements
const elements = {
    learningGoal: document.getElementById('learningGoal'),
    generateBtn: document.getElementById('generateBtn'),
    loadingSection: document.getElementById('loadingSection'),
    resultsSection: document.getElementById('resultsSection'),
    downloadSection: document.getElementById('downloadSection'),
    messageSection: document.getElementById('messageSection'),
    courseOverview: document.getElementById('courseOverview'),
    unitsContainer: document.getElementById('unitsContainer')
};

// Initialize the application
function init() {
    setupEventListeners();
    testServerConnection();
    checkJSZip();
    injectAdditionalCSS();
}

// Check if JSZip is loaded
function checkJSZip() {
    if (typeof JSZip === 'undefined') {
        console.error('❌ JSZip not loaded. Download features may not work.');
        showMessage('⚠️ Download features require JSZip library', 'error');
    } else {
        console.log('✅ JSZip loaded successfully');
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.generateBtn.addEventListener('click', generateLessonPlan);
    
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const goal = chip.getAttribute('data-goal');
            elements.learningGoal.value = goal;
            elements.learningGoal.focus();
        });
    });
    
    elements.learningGoal.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            generateLessonPlan();
        }
    });
}

// Test server connection
async function testServerConnection() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        console.log('✅ Server connection successful:', data);
        
        if (data.gemini_available) {
            showMessage('🤖 Gemini AI is ready for smart planning!', 'success');
        } else {
            showMessage('⚠️ Gemini AI not configured - using basic planning', 'error');
        }
    } catch (error) {
        console.error('❌ Cannot connect to server:', error);
        showMessage('⚠️ Make sure the backend server is running on port 5000', 'error');
    }
}
// ✅ AI Goal Overview Function
async function generateGoalOverview(learningGoal) {
    try {
        const response = await fetch(`${API_BASE}/ai/goal-overview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ learning_goal: learningGoal }),
        });
        const data = await response.json();
        
        if (data.overview) {
            const overviewHTML = `
                <div class="ai-goal-overview fade-in">
                    <h3><i class="fas fa-lightbulb"></i> AI-Generated Goal Overview</h3>
                    <p>${data.overview}</p>
                </div>
            `;

            // ✅ Remove old overview if it exists
            const existingOverview = elements.unitsContainer.querySelector('.ai-goal-overview');
            if (existingOverview) existingOverview.remove();

            // ✅ Insert just before Units section
            elements.unitsContainer.insertAdjacentHTML('afterbegin', overviewHTML);
        }
    } catch (err) {
        console.error("❌ Failed to fetch AI overview:", err);
    }
}


// Generate lesson plan with AI optimization
async function generateLessonPlan() {
    const learningGoal = elements.learningGoal.value.trim();

    if (!learningGoal) {
        showMessage('🎯 Please enter a learning goal to get started', 'error');
        return;
    }

    // ✅ Now generate the AI overview only if there’s a valid goal
    await generateGoalOverview(learningGoal);
    
    showLoadingState();
    
    try {
        console.log('📤 Generating AI-optimized lesson plan for:', learningGoal);
        
        // Step 1: Get AI-optimized duration from Gemini
        showMessage('🤖 Gemini AI is analyzing your learning goal...', 'success');
        const durationConstraint = await AIDurationPlanner.getSmartDuration(learningGoal, true);
        console.log('⏰ AI duration constraint:', durationConstraint);
        
        // Step 2: Generate smart study plan with AI
        showMessage('📚 Creating AI-optimized study schedule...', 'success');
        const studyPlan = await AIDurationPlanner.generateSmartStudyPlan(learningGoal, durationConstraint);
        console.log('📅 AI study plan:', studyPlan);
        
        // Step 3: Generate the actual lesson plan with duration constraint
        showMessage('🎯 Generating detailed lesson content...', 'success');
        const response = await fetch(`${API_BASE}/generate-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                goal: learningGoal,
                duration_constraint: durationConstraint
            })
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('✅ Received lesson plan:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Step 4: Combine AI insights with lesson plan
        const validatedPlan = DurationParser.validatePlanDuration(data, durationConstraint);
        validatedPlan.aiStudyPlan = studyPlan;
        validatedPlan.durationConstraint = durationConstraint;
        
        currentLessonPlan = validatedPlan;
        
        displayResults(validatedPlan);
        await fetchResources(learningGoal);

        // ✅ Add Resource Corner Button
        const resourceButtonHTML = `
            <div class="resource-corner-btn fade-in">
                <button id="openResourceCorner" class="resource-btn">
                     📚 Open Resource Corner
                </button>
            </div>
        `;
elements.unitsContainer.insertAdjacentHTML('beforeend', resourceButtonHTML);

// Open Resource Page
document.getElementById("openResourceCorner").addEventListener("click", () => {
    const goal = encodeURIComponent(elements.learningGoal.value.trim());
    window.open(`resources.html?goal=${goal}`, "_blank");
});

        
        if (durationConstraint.aiOptimized) {
            showMessage('🎉 AI-optimized lesson plan generated successfully!', 'success');
        } else {
            showMessage('✅ Lesson plan generated with basic duration calculation', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error generating lesson plan:', error);
        showMessage('❌ ' + error.message, 'error');
    } finally {
        hideLoadingState();
    }
}


// Show loading state
function showLoadingState() {
    elements.loadingSection.classList.remove('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI is Planning...';
    animateProgressSteps();
}

// Hide loading state
function hideLoadingState() {
    elements.loadingSection.classList.add('hidden');
    elements.generateBtn.disabled = false;
    elements.generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Lesson Plan';
}

// Animate progress steps
function animateProgressSteps() {
    const steps = document.querySelectorAll('.progress-steps .step');
    steps.forEach(step => step.classList.remove('active'));
    
    let currentStep = 0;
    const stepInterval = setInterval(() => {
        if (currentStep > 0) {
            steps[currentStep - 1].classList.remove('active');
        }
        
        if (currentStep < steps.length) {
            steps[currentStep].classList.add('active');
            currentStep++;
        } else {
            clearInterval(stepInterval);
        }
    }, 800);
}
async function fetchResources(learningGoal) {
    console.log("📚 Fetching resources for:", learningGoal);

    try {
        const res = await fetch(`${API_BASE}/ai/resources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ learning_goal: learningGoal })
        });

        const data = await res.json();
        console.log("✅ Resources:", data);

        localStorage.setItem("aiResources", JSON.stringify(data));
    } catch (err) {
        console.error("❌ Resource fetch failed:", err);
    }
}

// Display results with AI insights
function displayResults(lessonPlan) {
    elements.resultsSection.classList.remove('hidden');
    elements.downloadSection.classList.remove('hidden');
    
    displayCourseOverview(lessonPlan);
    displayStudySchedule(lessonPlan);
    displayUnits(lessonPlan);
    
    setTimeout(() => {
        elements.resultsSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 500);
}

// Display course overview with AI insights - MODIFIED to remove Study Period and Daily Commitment
// Display course overview with AI insights - MODIFIED to remove Study Period and Daily Commitment
function displayCourseOverview(lessonPlan) {
    // ⛔ Do nothing — hides the "Learning Plan" overview card completely
    elements.courseOverview.innerHTML = "";
}

// Filter out unwanted sections from lesson content
function filterUnwantedSections(content) {
    if (!content) return '';
    
    // Remove "Study Period" and "Daily Commitment" lines
    const unwantedPatterns = [
        /# Learning Plan\s*\n.*Study Period.*\n.*Daily Commitment.*\n/gi,
        /\d+ Day Study Period\s*\n\d+h\/Day Daily Commitment\s*\n/gi,
        /Study Period\s*\nDaily Commitment\s*\n/gi
    ];
    
    let filteredContent = content;
    unwantedPatterns.forEach(pattern => {
        filteredContent = filteredContent.replace(pattern, '');
    });
    
    return filteredContent;
}

// Display AI-optimized study schedule - MODIFIED to remove Day Xh header format
// Display AI-optimized study schedule - MODIFIED to remove Day Xh header format
function displayStudySchedule(lessonPlan) {
    // ⛔ Do nothing — hides the daily goals or study schedule section completely
    const existingSchedule = elements.unitsContainer.querySelector('.basic-schedule, .ai-schedule, .study-schedule');
    if (existingSchedule) existingSchedule.remove(); // clean up old ones
}


// Get total lessons count
function getTotalLessons(lessonPlan) {
    let total = 0;
    if (lessonPlan.comprehensive_lesson_plan) {
        Object.values(lessonPlan.comprehensive_lesson_plan).forEach(unit => {
            total += unit.total_lessons || (unit.lessons ? unit.lessons.length : 0);
        });
    }
    return total;
}

// Display units and lessons
// Display units and lessons WITH FILTERING
function displayUnits(lessonPlan) {
    // Remove existing units (keep the study schedule)
    const existingUnits = elements.unitsContainer.querySelectorAll('.unit-card');
    existingUnits.forEach(unit => unit.remove());
    
    if (!lessonPlan.comprehensive_lesson_plan) return;
    
    let unitNumber = 1;
    Object.entries(lessonPlan.comprehensive_lesson_plan).forEach(([unitKey, unitData]) => {
        const unitElement = createUnitElement(unitData, unitNumber);
        elements.unitsContainer.appendChild(unitElement);
        unitNumber++;
    });
}

// Create unit element
// Create unit element
// Create unit element WITH FILTERING
function createUnitElement(unitData, unitNumber) {
    const unitDiv = document.createElement('div');
    unitDiv.className = 'unit-card';
    
    // Filter out unwanted sections from ALL unit content
    const filteredObjective = filterUnwantedSections(unitData.unit_objective || '');
    const filteredTitle = filterUnwantedSections(unitData.unit_title || '');
    const filteredOutcomes = (unitData.unit_outcomes || []).map(outcome => 
        filterUnwantedSections(outcome)
    );
    
    unitDiv.innerHTML = `
        <div class="unit-header">
            <h3 class="unit-title">Unit ${unitNumber}: ${filteredTitle}</h3>
            <div class="unit-meta">
                <span class="meta-item">
                    <i class="fas fa-clock"></i>
                    ${unitData.unit_duration || 'No duration specified'}
                </span>
                <span class="meta-item">
                    <i class="fas fa-book-open"></i>
                    ${unitData.total_lessons || 0} lessons
                </span>
            </div>
        </div>
        
        <div class="unit-objective">
            <strong>Objective:</strong> ${filteredObjective}
        </div>
        
        <div class="unit-outcomes">
            <h4>Learning Outcomes:</h4>
            <div class="outcomes-list">
                ${filteredOutcomes.map(outcome => 
                    `<div class="outcome-item">✓ ${outcome}</div>`
                ).join('')}
            </div>
        </div>
        
        <div class="lessons-list">
            <h4>Lessons:</h4>
            ${(unitData.lessons || []).map(lesson => createLessonElement(lesson)).join('')}
        </div>
    `;
    
    return unitDiv;
}
// Create lesson element
// Create lesson element
// Create lesson element WITH FILTERING
function createLessonElement(lesson) {
    if (!lesson) return '';
    
    const filteredTitle = filterUnwantedSections(lesson.lesson_title || '');
    const filteredConcepts = (lesson.key_concepts || []).map(concept => 
        filterUnwantedSections(concept)
    );
    const filteredTopics = (lesson.important_topics || []).map(topic => 
        filterUnwantedSections(topic)
    );
    
    return `
        <div class="lesson-simple">
            <div class="lesson-header-simple">
                <span class="lesson-title-simple">
                    <strong>Lesson ${lesson.lesson_number || 'N/A'}:</strong> ${filteredTitle}
                </span>
                <span class="lesson-duration-simple">${lesson.lesson_duration || 'No duration'}</span>
            </div>
            ${filteredConcepts.length > 0 ? `
                <div class="lesson-concepts">
                    <strong>Key Concepts:</strong> ${filteredConcepts.join(', ')}
                </div>
            ` : ''}
        </div>
    `;
}

// Download functions
function downloadSyllabus() {
    if (!currentLessonPlan) {
        showMessage('Please generate a lesson plan first', 'error');
        return;
    }
    
    try {
        const syllabusData = {
            course: currentLessonPlan.course,
            goal: currentLessonPlan.course,
            total_duration: currentLessonPlan.total_estimated_duration,
            total_units: currentLessonPlan.total_units,
            generated_date: currentLessonPlan.generated_date,
            duration_constraint: currentLessonPlan.durationConstraint || currentLessonPlan.original_duration_constraint,
            ai_study_plan: currentLessonPlan.aiStudyPlan,
            units: Object.values(currentLessonPlan.comprehensive_lesson_plan).map(unit => ({
                title: filterUnwantedSections(unit.unit_title),
                duration: unit.unit_duration,
                objective: filterUnwantedSections(unit.unit_objective),
                total_lessons: unit.total_lessons,
                lessons: unit.lessons.map(lesson => ({
                    number: lesson.lesson_number,
                    title: filterUnwantedSections(lesson.lesson_title),
                    duration: lesson.lesson_duration,
                    key_concepts: lesson.key_concepts,
                    important_topics: lesson.important_topics,
                    time_breakdown: lesson.time_breakdown
                })),
                outcomes: unit.unit_outcomes.map(outcome => filterUnwantedSections(outcome))
            }))
        };
        
        const filename = `${currentLessonPlan.course.replace(/[^a-z0-9]/gi, '_')}_syllabus.json`;
        downloadJSON(syllabusData, filename);
        showMessage('📚 Syllabus downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading syllabus:', error);
        showMessage('❌ Failed to download syllabus', 'error');
    }
}

function downloadLessonPlan() {
    if (!currentLessonPlan) {
        showMessage('Please generate a lesson plan first', 'error');
        return;
    }
    
    try {
        const filename = `${currentLessonPlan.course.replace(/[^a-z0-9]/gi, '_')}_lesson_plan.json`;
        downloadJSON(currentLessonPlan, filename);
        showMessage('📋 Lesson plan downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading lesson plan:', error);
        showMessage('❌ Failed to download lesson plan', 'error');
    }
}

function downloadTextPlan() {
    if (!currentLessonPlan) {
        showMessage('Please generate a lesson plan first', 'error');
        return;
    }
    
    try {
        let textContent = `AI-OPTIMIZED LESSON PLAN: ${currentLessonPlan.course}\n`;
        textContent += `Total Duration: ${currentLessonPlan.total_estimated_duration}\n`;
        textContent += `Total Units: ${currentLessonPlan.total_units}\n`;
        textContent += `Generated: ${currentLessonPlan.generated_date}\n\n`;
        
        const durationConstraint = currentLessonPlan.durationConstraint || currentLessonPlan.original_duration_constraint;
        if (durationConstraint) {
            textContent += `AI Duration Analysis: ${durationConstraint.rationale}\n`;
            textContent += `Difficulty Level: ${durationConstraint.difficultyLevel}\n`;
            textContent += `Recommended Pace: ${durationConstraint.recommendedPace}\n\n`;
        }
        
        textContent += '='.repeat(60) + '\n\n';

        let unitNumber = 1;
        Object.values(currentLessonPlan.comprehensive_lesson_plan).forEach(unitData => {
            textContent += `UNIT ${unitNumber}: ${filterUnwantedSections(unitData.unit_title)}\n`;
            textContent += `Duration: ${unitData.unit_duration} | Lessons: ${unitData.total_lessons}\n`;
            textContent += `Objective: ${filterUnwantedSections(unitData.unit_objective)}\n\n`;
            
            textContent += 'Learning Outcomes:\n';
            unitData.unit_outcomes.forEach(outcome => {
                textContent += `✓ ${filterUnwantedSections(outcome)}\n`;
            });
            textContent += '\n';
            
            textContent += 'Lessons:\n';
            unitData.lessons.forEach(lesson => {
                textContent += `Lesson ${lesson.lesson_number}: ${filterUnwantedSections(lesson.lesson_title)}\n`;
                textContent += `Duration: ${lesson.lesson_duration}\n`;
                textContent += `Key Concepts: ${lesson.key_concepts.join(', ')}\n\n`;
            });
            textContent += '='.repeat(60) + '\n\n';
            unitNumber++;
        });

        const filename = `${currentLessonPlan.course.replace(/[^a-z0-9]/gi, '_')}_lesson_plan.txt`;
        downloadText(textContent, filename);
        showMessage('📄 Text version downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading text plan:', error);
        showMessage('❌ Failed to download text version', 'error');
    }
}

async function downloadAll() {
    if (!currentLessonPlan) {
        showMessage('Please generate a lesson plan first', 'error');
        return;
    }
    
    if (typeof JSZip === 'undefined') {
        showMessage('❌ JSZip library not loaded. Cannot create zip file.', 'error');
        return;
    }
    
    try {
        showMessage('📦 Creating AI-optimized download package...', 'success');
        
        const syllabusData = {
            course: currentLessonPlan.course,
            goal: currentLessonPlan.course,
            total_duration: currentLessonPlan.total_estimated_duration,
            total_units: currentLessonPlan.total_units,
            generated_date: currentLessonPlan.generated_date,
            duration_constraint: currentLessonPlan.durationConstraint || currentLessonPlan.original_duration_constraint,
            ai_study_plan: currentLessonPlan.aiStudyPlan,
            units: Object.values(currentLessonPlan.comprehensive_lesson_plan).map(unit => ({
                title: filterUnwantedSections(unit.unit_title),
                duration: unit.unit_duration,
                objective: filterUnwantedSections(unit.unit_objective),
                total_lessons: unit.total_lessons,
                lessons: unit.lessons.map(lesson => ({
                    number: lesson.lesson_number,
                    title: filterUnwantedSections(lesson.lesson_title),
                    duration: lesson.lesson_duration,
                    key_concepts: lesson.key_concepts,
                    important_topics: lesson.important_topics,
                    time_breakdown: lesson.time_breakdown
                })),
                outcomes: unit.unit_outcomes.map(outcome => filterUnwantedSections(outcome))
            }))
        };

        let textContent = `AI-OPTIMIZED LESSON PLAN: ${currentLessonPlan.course}\n`;
        textContent += `Total Duration: ${currentLessonPlan.total_estimated_duration}\n`;
        textContent += `Total Units: ${currentLessonPlan.total_units}\n\n`;

        // Create zip file
        const zip = new JSZip();
        
        // Add files to zip
        zip.file("syllabus.json", JSON.stringify(syllabusData, null, 2));
        zip.file("lesson-plan.json", JSON.stringify(currentLessonPlan, null, 2));
        zip.file("lesson-plan.txt", textContent);
        zip.file("README.txt", 
            `AI-Optimized Lesson Plan Files\n` +
            `=============================\n\n` +
            `Course: ${currentLessonPlan.course}\n` +
            `Total Duration: ${currentLessonPlan.total_estimated_duration}\n` +
            `Total Units: ${currentLessonPlan.total_units}\n` +
            `Generated: ${currentLessonPlan.generated_date}\n` +
            `AI Optimized: ${syllabusData.duration_constraint?.aiOptimized ? 'Yes 🤖' : 'No'}\n\n` +
            `Files included:\n` +
            `• syllabus.json - Course structure with AI insights\n` +
            `• lesson-plan.json - Detailed AI-optimized lesson plan\n` +
            `• lesson-plan.txt - Simple text version\n\n` +
            `Happy learning with AI! 🚀`
        );

        // Generate and download zip
        const content = await zip.generateAsync({type: "blob"});
        const filename = `${currentLessonPlan.course.replace(/[^a-z0-9]/gi, '_')}_ai_optimized_package.zip`;
        
        downloadBlob(content, filename);
        showMessage('⭐ AI-optimized package downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating zip file:', error);
        showMessage('❌ Failed to create download package', 'error');
    }
}

// Utility functions
function downloadJSON(data, filename) {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, filename);
    } catch (error) {
        console.error('Error in downloadJSON:', error);
        showMessage('❌ Download failed', 'error');
    }
}

function downloadText(content, filename) {
    try {
        const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
        downloadBlob(blob, filename);
    } catch (error) {
        console.error('Error in downloadText:', error);
        showMessage('❌ Download failed', 'error');
    }
}

function downloadBlob(blob, filename) {
    try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
        console.error('Error in downloadBlob:', error);
        showMessage('❌ Download failed', 'error');
    }
}

function showMessage(message, type = 'error') {
    if (!elements.messageSection) return;
    
    elements.messageSection.innerHTML = `
        <div class="message ${type}">
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
            ${message}
        </div>
    `;
    elements.messageSection.classList.remove('hidden');
    
    if (type !== 'error') {
        setTimeout(() => {
            if (elements.messageSection) {
                elements.messageSection.classList.add('hidden');
            }
        }, 5000);
    }
}

function hideMessage() {
    if (elements.messageSection) {
        elements.messageSection.classList.add('hidden');
    }
}

// Generate new plan
function generateNewPlan() {
    elements.resultsSection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.learningGoal.value = '';
    elements.learningGoal.focus();
    
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Start interactive learning
function startInteractiveLearning() {
    if (!currentLessonPlan) {
        showMessage('Please generate a lesson plan first', 'error');
        return;
    }
    
    localStorage.setItem('currentLessonPlan', JSON.stringify(currentLessonPlan));
    const courseData = encodeURIComponent(JSON.stringify(currentLessonPlan));
    window.location.href = `learning.html?course=${courseData}`;
}

// Inject CSS for AI features
// Enhanced CSS for beautiful intensive design
function injectAdditionalCSS() {
    const additionalCSS = `
    /* Intensive Hero Section */
    .intensive-hero {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 20px;
        padding: 30px;
        margin-bottom: 30px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }

    .hero-header {
        text-align: center;
        margin-bottom: 30px;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255,255,255,0.2);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9em;
        font-weight: 600;
        margin-bottom: 15px;
    }

    .intensive-hero h2 {
        font-size: 2.2em;
        margin: 0 0 10px 0;
        font-weight: 700;
    }

    .hero-subtitle {
        font-size: 1.1em;
        opacity: 0.9;
        margin: 0;
    }

    /* Intensive Stats */
    .intensive-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 30px 0;
    }

    .stat-card {
        background: rgba(255,255,255,0.1);
        border-radius: 15px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
    }

    .stat-card.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-card.success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); }
    .stat-card.warning { background: linear-gradient(135deg, #ff9800 0%, #e68900 100%); }
    .stat-card.danger { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); }

    .stat-icon {
        font-size: 2em;
        opacity: 0.9;
    }

    .stat-value {
        font-size: 1.8em;
        font-weight: 700;
        line-height: 1;
    }

    .stat-label {
        font-size: 0.9em;
        opacity: 0.9;
        margin-top: 5px;
    }

    /* Intensive Features */
    .intensive-features {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin: 30px 0;
    }

    .feature {
        display: flex;
        align-items: flex-start;
        gap: 15px;
        background: rgba(255,255,255,0.1);
        padding: 20px;
        border-radius: 12px;
        backdrop-filter: blur(10px);
    }

    .feature-icon {
        font-size: 1.5em;
        color: #ffd700;
    }

    .feature-content h4 {
        margin: 0 0 8px 0;
        font-size: 1.1em;
    }

    .feature-content p {
        margin: 0;
        opacity: 0.9;
        font-size: 0.9em;
        line-height: 1.4;
    }

    /* Intensive Tips */
    .intensive-tips {
        background: rgba(255,255,255,0.1);
        border-radius: 15px;
        padding: 25px;
        margin-top: 30px;
    }

    .intensive-tips h4 {
        margin: 0 0 20px 0;
        text-align: center;
        font-size: 1.3em;
    }

    .tips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
    }

    .tip-card {
        background: rgba(255,255,255,0.15);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        transition: transform 0.3s ease;
    }

    .tip-card:hover {
        transform: translateY(-5px);
    }

    .tip-card i {
        font-size: 2em;
        color: #ffd700;
        margin-bottom: 15px;
    }

    .tip-card h5 {
        margin: 0 0 10px 0;
        font-size: 1.1em;
    }

    .tip-card p {
        margin: 0;
        font-size: 0.9em;
        opacity: 0.9;
        line-height: 1.4;
    }

    /* Intensive Schedule */
    .intensive-schedule {
        background: white;
        border-radius: 20px;
        padding: 30px;
        margin: 30px 0;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }

    .schedule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #f0f0f0;
    }

    .schedule-header h3 {
        margin: 0;
        color: #333;
        font-size: 1.8em;
    }

    .session-badge {
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Timeline */
    .timeline {
        position: relative;
        margin: 40px 0;
    }

    .timeline::before {
        content: '';
        position: absolute;
        left: 30px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: linear-gradient(to bottom, #667eea, #764ba2);
    }

    .timeline-item {
        display: flex;
        margin-bottom: 40px;
        position: relative;
    }

    .timeline-marker {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.5em;
        z-index: 2;
        flex-shrink: 0;
    }

    .timeline-content {
        flex: 1;
        background: #f8f9fa;
        margin-left: 20px;
        padding: 20px;
        border-radius: 12px;
        border-left: 4px solid #667eea;
    }

    .timeline-content h4 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 1.2em;
    }

    .timeline-content p {
        margin: 0 0 15px 0;
        color: #666;
        line-height: 1.5;
    }

    .timeline-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .tag {
        background: #667eea;
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 0.8em;
        font-weight: 500;
    }

    /* Intensive Actions */
    .intensive-actions {
        background: #f8f9fa;
        border-radius: 15px;
        padding: 25px;
        margin-top: 30px;
    }

    .intensive-actions h4 {
        text-align: center;
        margin: 0 0 25px 0;
        color: #333;
        font-size: 1.4em;
    }

    .action-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
    }

    .action-card {
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        text-align: center;
    }

    .action-card i {
        font-size: 2em;
        color: #667eea;
        margin-bottom: 15px;
    }

    .action-card h5 {
        margin: 0 0 15px 0;
        color: #333;
        font-size: 1.1em;
    }

    .action-card ul {
        margin: 0;
        padding: 0;
        list-style: none;
        text-align: left;
    }

    .action-card li {
        padding: 5px 0;
        color: #666;
        position: relative;
        padding-left: 20px;
    }

    .action-card li::before {
        content: '✓';
        position: absolute;
        left: 0;
        color: #4CAF50;
        font-weight: bold;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .intensive-stats {
            grid-template-columns: 1fr;
        }
        
        .intensive-features {
            grid-template-columns: 1fr;
        }
        
        .tips-grid {
            grid-template-columns: 1fr;
        }
        
        .action-cards {
            grid-template-columns: 1fr;
        }
        
        .schedule-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
        }
        
        .timeline-marker {
            width: 50px;
            height: 50px;
            font-size: 1.2em;
        }
    }

    /* Animation for cards */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .intensive-hero,
    .intensive-schedule,
    .timeline-item,
    .action-card {
        animation: fadeInUp 0.6s ease-out;
    }

    .timeline-item:nth-child(1) { animation-delay: 0.1s; }
    .timeline-item:nth-child(2) { animation-delay: 0.2s; }
    .timeline-item:nth-child(3) { animation-delay: 0.3s; }
    .action-card:nth-child(1) { animation-delay: 0.1s; }
    .action-card:nth-child(2) { animation-delay: 0.2s; }
    .action-card:nth-child(3) { animation-delay: 0.3s; }
    /* 🩵 Remove unwanted blue horizontal bar */
    .ai-goal-overview::before,
    .ai-goal-overview::after,
    .results-section::before,
    .results-section::after,
    .unitsContainer::before,
    .unitsContainer::after,
    #courseOverview::before,
    #courseOverview::after,
    hr {
        display: none !important;
        border: none !important;
        background: none !important;
        content: none !important;
        }   

    `;

    if (!document.querySelector('#intensive-css')) {
        const style = document.createElement('style');
        style.id = 'intensive-css';
        style.textContent = additionalCSS;
        document.head.appendChild(style);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    init();
});