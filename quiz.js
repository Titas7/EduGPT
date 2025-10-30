// quiz.js - Separate Quiz Page Functionality
let currentCourse = null;
let currentQuiz = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    startTime: null,
    selectedUnit: null,
    isComprehensive: false
};

// Initialize quiz page
function initQuizPage() {
    loadCourseData();
    setupEventListeners();
    updateQuizUI();
}

// Load course data from URL parameters or localStorage
function loadCourseData() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseData = urlParams.get('course');
    
    if (courseData) {
        try {
            currentCourse = JSON.parse(decodeURIComponent(courseData));
        } catch (e) {
            console.error('Error parsing course data:', e);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
    
    if (currentCourse) {
        displayCourseOverview();
        displayUnits();
    } else {
        showError('No course data found. Please generate a lesson plan first.');
    }
}

function loadFromLocalStorage() {
    const savedCourse = localStorage.getItem('currentLessonPlan');
    if (savedCourse) {
        currentCourse = JSON.parse(savedCourse);
    }
}

function displayCourseOverview() {
    if (!currentCourse) return;
    
    document.getElementById('learningGoalText').textContent = currentCourse.course;
    document.getElementById('courseTitle').textContent = `Quiz: ${currentCourse.course}`;
    document.getElementById('courseBadge').textContent = currentCourse.course.split(' ')[0] + ' Course';
    
    // Calculate totals
    const units = Object.values(currentCourse.comprehensive_lesson_plan);
    const totalLessons = units.reduce((sum, unit) => sum + (unit.total_lessons || unit.lessons.length), 0);
    
    document.getElementById('totalUnits').textContent = `${units.length} Units`;
    document.getElementById('totalLessons').textContent = `${totalLessons} Lessons`;
    document.getElementById('totalDuration').textContent = currentCourse.total_estimated_duration;
}

function displayUnits() {
    const unitsGrid = document.getElementById('unitsGrid');
    if (!currentCourse || !unitsGrid) return;
    
    unitsGrid.innerHTML = '';
    
    Object.entries(currentCourse.comprehensive_lesson_plan).forEach(([unitKey, unitData], index) => {
        const unitElement = createUnitCard(unitData, index + 1);
        unitsGrid.appendChild(unitElement);
    });
}

function createUnitCard(unitData, unitNumber) {
    const unitDiv = document.createElement('div');
    unitDiv.className = 'unit-card';
    unitDiv.onclick = () => startUnitQuiz(unitData, unitNumber);
    
    unitDiv.innerHTML = `
        <div class="unit-header">
            <h3 class="unit-title">Unit ${unitNumber}: ${unitData.unit_title}</h3>
            <div class="unit-meta">
                <span class="unit-duration">${unitData.unit_duration}</span>
                <span class="unit-lessons">${unitData.total_lessons} lessons</span>
            </div>
        </div>
        
        <div class="unit-objective">
            ${unitData.unit_objective}
        </div>
        
        <div class="unit-outcomes">
            <h4>Learning Outcomes:</h4>
            <div class="outcomes-list">
                ${unitData.unit_outcomes.slice(0, 3).map(outcome => 
                    `<div class="outcome-item">${outcome}</div>`
                ).join('')}
                ${unitData.unit_outcomes.length > 3 ? 
                    `<div class="outcome-item">+ ${unitData.unit_outcomes.length - 3} more outcomes</div>` : ''
                }
            </div>
        </div>
        
        <button class="start-quiz-btn" onclick="event.stopPropagation(); startUnitQuiz(${unitNumber})">
            <i class="fas fa-play"></i>
            Start Unit Quiz
        </button>
    `;
    
    return unitDiv;
}

// Quiz Management
async function startUnitQuiz(unitNumber) {
    const units = Object.values(currentCourse.comprehensive_lesson_plan);
    const unitData = units[unitNumber - 1];
    
    if (!unitData) {
        showError('Unit not found');
        return;
    }
    
    currentQuiz.selectedUnit = unitData;
    currentQuiz.isComprehensive = false;
    
    showLoading(true);
    
    try {
        const questions = await generateUnitQuestionsWithGemini(unitData, unitNumber);
        if (questions.length > 0) {
            startQuizSession(questions, `Unit ${unitNumber}: ${unitData.unit_title}`);
        } else {
            throw new Error('No questions generated');
        }
    } catch (error) {
        console.error('Error starting unit quiz:', error);
        showError('Failed to generate quiz questions. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function startComprehensiveQuiz() {
    currentQuiz.selectedUnit = null;
    currentQuiz.isComprehensive = true;
    
    showLoading(true);
    
    try {
        const allQuestions = [];
        const units = Object.values(currentCourse.comprehensive_lesson_plan);
        
        // Generate questions for all units
        for (let i = 0; i < units.length; i++) {
            const unitQuestions = await generateUnitQuestionsWithGemini(units[i], i + 1);
            allQuestions.push(...unitQuestions.slice(0, 2)); // Take 2 questions from each unit
        }
        
        if (allQuestions.length > 0) {
            // Shuffle questions
            shuffleArray(allQuestions);
            startQuizSession(allQuestions, 'Comprehensive Quiz - All Units');
        } else {
            throw new Error('No questions generated');
        }
    } catch (error) {
        console.error('Error starting comprehensive quiz:', error);
        showError('Failed to generate quiz questions. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function generateUnitQuestionsWithGemini(unit, unitNumber) {
    console.log(`🤖 Calling Gemini AI for unit ${unitNumber}`);
    
    // Create a simple, clean prompt
    const prompt = `
    Create 5 multiple-choice quiz questions for this learning unit.
    
    Course: ${currentCourse.course}
    Unit: ${unit.unit_title}
    Objective: ${unit.unit_objective}
    Lessons: ${unit.lessons.map(lesson => lesson.lesson_title).join(', ')}
    
    Return ONLY JSON in this format:
    {
        "questions": [
            {
                "question": "Question text here?",
                "options": ["Correct answer", "Wrong answer 1", "Wrong answer 2", "Wrong answer 3"],
                "correctAnswer": 0,
                "explanation": "Why this is correct"
            }
        ]
    }
    Create exactly 5 questions.
    `;

    try {
        const response = await fetch('/api/ai/generate-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: prompt,
                course_context: {
                    course_name: currentCourse.course,
                    current_unit: unit.unit_title
                },
                chat_history: []
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📨 AI Response received:', data);
        
        if (!data.response) {
            throw new Error('No response from AI');
        }

        // Parse the response
        let questionsData;
        const responseText = data.response;
        
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                questionsData = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                throw new Error('Could not parse AI response as JSON');
            }
        } else {
            // If no JSON found, create simple questions
            console.log('📝 No JSON found in response, creating simple questions');
            return generateSimpleQuestions(unit, unitNumber);
        }

        if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
            throw new Error('Invalid question format from AI');
        }

        // Add unit information to questions
        return questionsData.questions.slice(0, 5).map((q, index) => ({
            id: `unit${unitNumber}_q${index + 1}`,
            unit: unitNumber,
            question: q.question || `Question about ${unit.unit_title}`,
            options: q.options || ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: q.correctAnswer || 0,
            explanation: q.explanation || "This tests your understanding of the unit content.",
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        }));

    } catch (error) {
        console.error('❌ Error in generateUnitQuestionsWithGemini:', error);
        throw error;
    }
}

function generateSimpleQuestions(unit, unitNumber) {
    console.log('🔄 Generating simple fallback questions');
    return [
        {
            id: `unit${unitNumber}_q1`,
            unit: unitNumber,
            question: `What is the main objective of ${unit.unit_title}?`,
            options: [
                `To understand and apply ${unit.unit_title} concepts`,
                "To memorize definitions",
                "To learn unrelated topics", 
                "To complete administrative tasks"
            ],
            correctAnswer: 0,
            explanation: `This unit focuses on practical understanding of ${unit.unit_title}.`,
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        },
        {
            id: `unit${unitNumber}_q2`,
            unit: unitNumber,
            question: `Which skill is most important in ${unit.unit_title}?`,
            options: [
                "Applying concepts to real situations",
                "Memorizing facts", 
                "Writing long essays",
                "Drawing diagrams"
            ],
            correctAnswer: 0,
            explanation: `Practical application is key to mastering ${unit.unit_title}.`,
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        },
        {
            id: `unit${unitNumber}_q3`,
            unit: unitNumber,
            question: `What is the primary focus of ${unit.unit_title}?`,
            options: [
                "Learning core concepts and applications",
                "Memorizing technical terms",
                "Historical background",
                "Advanced theoretical frameworks"
            ],
            correctAnswer: 0,
            explanation: `This unit emphasizes practical understanding of core concepts.`,
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        },
        {
            id: `unit${unitNumber}_q4`,
            unit: unitNumber,
            question: `What should you be able to do after completing ${unit.unit_title}?`,
            options: [
                "Apply the concepts in practical scenarios",
                "Recite all definitions from memory",
                "Explain advanced theoretical models",
                "Draw detailed diagrams"
            ],
            correctAnswer: 0,
            explanation: `The focus is on practical application of knowledge.`,
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        },
        {
            id: `unit${unitNumber}_q5`,
            unit: unitNumber,
            question: `How does ${unit.unit_title} contribute to the overall course?`,
            options: [
                "It builds foundational knowledge for advanced topics",
                "It provides entertainment value",
                "It covers administrative procedures",
                "It focuses on historical context"
            ],
            correctAnswer: 0,
            explanation: `This unit provides essential building blocks for the course.`,
            unitTopic: unit.unit_title,
            userAnswer: null,
            isCorrect: null
        }
    ];
}

function startQuizSession(questions, quizTitle) {
    currentQuiz.questions = questions;
    currentQuiz.currentQuestionIndex = 0;
    currentQuiz.userAnswers = [];
    currentQuiz.startTime = new Date();
    
    // Hide selection, show active quiz
    document.querySelector('.quiz-selection-section').classList.add('hidden');
    document.getElementById('activeQuizSection').classList.remove('hidden');
    
    // Update quiz title
    document.getElementById('activeQuizTitle').textContent = quizTitle;
    document.getElementById('totalQuestions').textContent = questions.length;
    
    updateQuizProgress();
    displayCurrentQuestion();
    startTimer();
}

function displayCurrentQuestion() {
    const questionContainer = document.getElementById('questionContainer');
    const currentQuestion = currentQuiz.questions[currentQuiz.currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    questionContainer.innerHTML = `
        <div class="question-header">
            <div class="question-number">Question ${currentQuiz.currentQuestionIndex + 1}</div>
            <div class="question-text">${currentQuestion.question}</div>
        </div>
        
        <div class="options-container">
            ${currentQuestion.options.map((option, index) => `
                <div class="option ${currentQuestion.userAnswer === index ? 'selected' : ''}" 
                     onclick="selectOption(${index})">
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    updateNavigationButtons();
}

function selectOption(optionIndex) {
    const currentQuestion = currentQuiz.questions[currentQuiz.currentQuestionIndex];
    currentQuestion.userAnswer = optionIndex;
    currentQuestion.isCorrect = optionIndex === currentQuestion.correctAnswer;
    
    // Update UI
    document.querySelectorAll('.option').forEach((option, index) => {
        option.classList.toggle('selected', index === optionIndex);
    });
    
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const currentQuestion = currentQuiz.questions[currentQuiz.currentQuestionIndex];
    const hasAnswer = currentQuestion.userAnswer !== null;
    
    document.getElementById('prevBtn').disabled = currentQuiz.currentQuestionIndex === 0;
    document.getElementById('nextBtn').classList.toggle('hidden', currentQuiz.currentQuestionIndex === currentQuiz.questions.length - 1);
    document.getElementById('submitBtn').classList.toggle('hidden', currentQuiz.currentQuestionIndex !== currentQuiz.questions.length - 1);
    document.getElementById('nextBtn').disabled = !hasAnswer;
    document.getElementById('submitBtn').disabled = !hasAnswer;
}

function previousQuestion() {
    if (currentQuiz.currentQuestionIndex > 0) {
        currentQuiz.currentQuestionIndex--;
        displayCurrentQuestion();
        updateQuizProgress();
    }
}

function nextQuestion() {
    if (currentQuiz.currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuiz.currentQuestionIndex++;
        displayCurrentQuestion();
        updateQuizProgress();
    }
}

function updateQuizProgress() {
    const progress = ((currentQuiz.currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;
    
    document.getElementById('currentQuestionNumber').textContent = currentQuiz.currentQuestionIndex + 1;
    document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;
    document.getElementById('progressFill').style.width = `${progress}%`;
    
    // Update stats
    const correctCount = currentQuiz.questions.filter(q => q.isCorrect).length;
    const incorrectCount = currentQuiz.questions.filter(q => q.userAnswer !== null && !q.isCorrect).length;
    
    document.getElementById('correctCount').textContent = correctCount;
    document.getElementById('incorrectCount').textContent = incorrectCount;
}

function submitQuiz() {
    const endTime = new Date();
    const timeTaken = Math.round((endTime - currentQuiz.startTime) / 1000); // in seconds
    
    calculateResults(timeTaken);
    showResults();
}

function calculateResults(timeTaken) {
    const correctAnswers = currentQuiz.questions.filter(q => q.isCorrect).length;
    const totalQuestions = currentQuiz.questions.length;
    const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Format time
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update results display
    document.getElementById('scorePercentage').textContent = `${scorePercentage}%`;
    document.getElementById('correctAnswers').textContent = `${correctAnswers}/${totalQuestions}`;
    document.getElementById('timeTaken').textContent = timeFormatted;
    document.getElementById('accuracyRate').textContent = `${accuracy}%`;
    
    // Animate progress ring
    const circle = document.querySelector('.progress-ring-circle');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (scorePercentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Update subtitle based on score
    let subtitle = '';
    if (scorePercentage >= 90) subtitle = 'Outstanding! You have mastered the content.';
    else if (scorePercentage >= 80) subtitle = 'Excellent work! You have a strong understanding.';
    else if (scorePercentage >= 70) subtitle = 'Good job! You have a solid foundation.';
    else if (scorePercentage >= 60) subtitle = 'Not bad! Review the material to improve.';
    else subtitle = 'Keep practicing! Review the course material.';
    
    document.getElementById('resultsSubtitle').textContent = subtitle;
    
    // Generate recommendations
    generateRecommendations(scorePercentage);
}

function generateRecommendations(score) {
    const recommendationsContent = document.getElementById('recommendationsContent');
    
    let recommendations = '';
    if (score >= 90) {
        recommendations = `
            <p><strong>🎯 Next Steps:</strong></p>
            <ul>
                <li>Challenge yourself with advanced topics</li>
                <li>Apply your knowledge to real-world projects</li>
                <li>Consider mentoring others in this subject</li>
            </ul>
        `;
    } else if (score >= 70) {
        recommendations = `
            <p><strong>📚 Areas to Strengthen:</strong></p>
            <ul>
                <li>Review the concepts you missed</li>
                <li>Practice with additional examples</li>
                <li>Focus on practical applications</li>
            </ul>
        `;
    } else {
        recommendations = `
            <p><strong>💡 Study Plan:</strong></p>
            <ul>
                <li>Revisit the course materials thoroughly</li>
                <li>Take detailed notes on key concepts</li>
                <li>Practice with hands-on exercises</li>
                <li>Consider retaking this quiz after review</li>
            </ul>
        `;
    }
    
    recommendationsContent.innerHTML = recommendations;
}

function showResults() {
    document.getElementById('activeQuizSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    
    // Trigger confetti for good scores
    const score = parseInt(document.getElementById('scorePercentage').textContent);
    if (score >= 80) {
        triggerConfetti();
    }
}

function retakeQuiz() {
    if (currentQuiz.isComprehensive) {
        startComprehensiveQuiz();
    } else {
        startUnitQuiz(currentQuiz.questions[0].unit);
    }
}

function reviewAnswers() {
    let reviewHTML = `<div class="performance-section"><h3><i class="fas fa-search"></i> Answers Review</h3>`;
    
    currentQuiz.questions.forEach((question, index) => {
        reviewHTML += `
            <div class="question-review" style="background: var(--bg-color); padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
                <p><strong>Question ${index + 1}:</strong> ${question.question}</p>
                <p><strong>Your answer:</strong> ${question.userAnswer !== null ? question.options[question.userAnswer] : 'Not answered'}</p>
                <p><strong>Correct answer:</strong> ${question.options[question.correctAnswer]}</p>
                <p><strong>Explanation:</strong> ${question.explanation}</p>
                <p style="color: ${question.isCorrect ? 'var(--success-color)' : 'var(--error-color)'}; font-weight: bold;">
                    ${question.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                </p>
            </div>
        `;
    });
    
    reviewHTML += `</div>`;
    document.getElementById('performanceSection').innerHTML = reviewHTML;
}

function backToSelection() {
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('activeQuizSection').classList.add('hidden');
    document.querySelector('.quiz-selection-section').classList.remove('hidden');
}

// Timer functionality
let quizTimer = null;
function startTimer() {
    let seconds = 0;
    quizTimer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        document.getElementById('timeSpent').textContent = 
            `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }
}

// Utility functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function showError(message) {
    alert(`Error: ${message}`);
}

function goBack() {
    window.history.back();
}

function toggleDarkMode() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
}

function triggerConfetti() {
    // Simple confetti effect
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti = [];
    const confettiCount = 150;
    
    for (let i = 0; i < confettiCount; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            speed: Math.random() * 3 + 2,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            rotation: Math.random() * 360
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        confetti.forEach(particle => {
            particle.y += particle.speed;
            particle.rotation += 2;
            
            if (particle.y < canvas.height) {
                active = true;
            }
            
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation * Math.PI / 180);
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            ctx.restore();
        });
        
        if (active) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function setupEventListeners() {
    // Add any additional event listeners here
}

function updateQuizUI() {
    // Initial UI updates
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initQuizPage);