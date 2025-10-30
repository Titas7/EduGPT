// learning.js - Complete Working Version
let currentCourse = null;
let currentUnit = null;
let chatHistory = [];

// Initialize the learning page
function initLearningPage() {
    loadCourseData();
    setupEventListeners();
}

// Load course data
function loadCourseData() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseData = urlParams.get('course');
    
    if (courseData) {
        try {
            currentCourse = JSON.parse(decodeURIComponent(courseData));
            displayCourseStructure();
            updateCourseTitle();
        } catch (e) {
            console.error('Error parsing course data:', e);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    const savedCourse = localStorage.getItem('currentLessonPlan');
    if (savedCourse) {
        currentCourse = JSON.parse(savedCourse);
        displayCourseStructure();
        updateCourseTitle();
    }
}

function updateCourseTitle() {
    if (currentCourse) {
        document.getElementById('courseTitle').textContent = `Learning: ${currentCourse.course}`;
        document.getElementById('learningGoalText').textContent = currentCourse.course;
    }
}

function displayCourseStructure() {
    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';

    if (!currentCourse || !currentCourse.comprehensive_lesson_plan) return;

    Object.entries(currentCourse.comprehensive_lesson_plan).forEach(([unitKey, unitData], index) => {
        const unitElement = document.createElement('div');
        unitElement.className = 'unit-item';
        unitElement.onclick = () => selectUnit(unitData, index + 1);
        
        unitElement.innerHTML = `
            <div class="unit-header">
                <div class="unit-title">Unit ${index + 1}: ${unitData.unit_title}</div>
                <div class="unit-meta">${unitData.unit_duration}</div>
            </div>
            <div class="unit-lessons">${unitData.total_lessons} lessons</div>
        `;
        
        unitsList.appendChild(unitElement);
    });
}

function selectUnit(unitData, unitNumber) {
    currentUnit = unitData;
    document.querySelectorAll('.unit-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    addMessage(`I'd like to learn about ${unitData.unit_title}. Can you explain the main concepts?`, 'user');
    setTimeout(() => {
        generateAIResponse(`I want to learn about ${unitData.unit_title}. Please provide an overview.`);
    }, 500);
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        sendButton.disabled = this.value.trim() === '';
    });
    
    loadChatHistory();
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';
    document.getElementById('sendButton').disabled = true;
    
    generateAIResponse(message);
}

function sendSuggestion(suggestion) {
    addMessage(suggestion, 'user');
    generateAIResponse(suggestion);
}

function addMessage(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (sender === 'user' && welcomeMessage && welcomeMessage.style.display !== 'none') {
        welcomeMessage.style.display = 'none';
    }
    
    if (sender === 'user') {
        const quickSuggestions = document.getElementById('quickSuggestions');
        if (quickSuggestions) {
            quickSuggestions.style.display = 'none';
        }
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = sender === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-text">${formatMessage(text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    chatHistory.push({ sender, text, time: new Date().toISOString() });
    saveChatHistory();
}

function formatMessage(text) {
    if (!text) return '';
    
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

// AI Integration
async function generateAIResponse(userMessage) {
    showLoading(true);
    
    try {
        const courseContext = {
            course_name: currentCourse?.course || 'Unknown Course',
            structure: currentCourse?.comprehensive_lesson_plan || {},
            current_unit: currentUnit?.unit_title || 'General'
        };

        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage,
                course_context: courseContext,
                chat_history: chatHistory.slice(-10)
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        addMessage(data.response, 'assistant');
        
    } catch (error) {
        console.error('Error calling AI API:', error);
        const fallbackResponse = generateFallbackResponse(userMessage);
        addMessage(fallbackResponse, 'assistant');
    } finally {
        showLoading(false);
    }
}

// Quiz System - Redirect to Separate Page
async function quizMe() {
    console.log('🎯 Quiz Me button clicked');
    
    if (!currentCourse) {
        console.error('❌ No current course found');
        addMessage("Please generate a lesson plan first.", 'assistant');
        return;
    }
    
    console.log('📚 Current course:', currentCourse.course);
    
    // Save current course for quiz page
    try {
        localStorage.setItem('currentLessonPlan', JSON.stringify(currentCourse));
        console.log('✅ Course saved to localStorage');
    } catch (e) {
        console.error('❌ Error saving to localStorage:', e);
        addMessage("Error preparing quiz. Please try again.", 'assistant');
        return;
    }
    
    // Redirect to quiz page
    try {
        const courseData = encodeURIComponent(JSON.stringify(currentCourse));
        const quizUrl = `quiz.html?course=${courseData}`;
        console.log('🔗 Redirecting to:', quizUrl);
        window.location.href = quizUrl;
    } catch (error) {
        console.error('❌ Error redirecting to quiz page:', error);
        addMessage("Cannot access the quiz page. Please make sure quiz.html exists.", 'assistant');
    }
}

// Quick Actions
async function askAboutCurrentTopic() {
    if (currentUnit) {
        addMessage(`Can you explain ${currentUnit.unit_title} in detail?`, 'user');
        generateAIResponse(`Please explain ${currentUnit.unit_title} in detail.`);
    } else {
        addMessage("Can you give me an overview of the main concepts in this course?", 'user');
        generateAIResponse("Please provide a course overview.");
    }
}

async function requestExample() {
    addMessage("Can you provide a practical example?", 'user');
    generateAIResponse("Please provide a practical example.");
}

async function suggestPractice() {
    addMessage("Can you suggest a practice exercise?", 'user');
    generateAIResponse("Please suggest a practice exercise.");
}

// Fallback response
function generateFallbackResponse(userMessage) {
    return "I'd be happy to help you learn! Based on your course material, I recommend focusing on practical applications and reviewing the key concepts in your syllabus.";
}

// Utility Functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    const sendButton = document.getElementById('sendButton');
    
    if (show) {
        overlay.classList.remove('hidden');
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        overlay.classList.add('hidden');
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

function saveChatHistory() {
    try {
        localStorage.setItem('learningChatHistory', JSON.stringify(chatHistory));
    } catch (e) {
        console.warn('Could not save chat history:', e);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem('learningChatHistory');
        if (saved) {
            chatHistory = JSON.parse(saved).slice(-20);
        }
    } catch (e) {
        chatHistory = [];
    }
}

function clearChat() {
    if (confirm('Clear chat history?')) {
        chatHistory = [];
        document.getElementById('chatMessages').innerHTML = '';
        const welcome = document.getElementById('welcomeMessage');
        if (welcome) welcome.style.display = 'block';
        const suggestions = document.getElementById('quickSuggestions');
        if (suggestions) suggestions.style.display = 'block';
        saveChatHistory();
    }
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function goBack() {
    window.location.href = '/';
}

// Initialize
document.addEventListener('DOMContentLoaded', initLearningPage);