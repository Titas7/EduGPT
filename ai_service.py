# [file name]: ai_service.py
import os
import google.generativeai as genai
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

class AILearningAssistant:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
    def generate_learning_response(self, user_message, course_context, chat_history=None):
        """Generate dynamic AI response based on course context and chat history"""
        
        # Build the context prompt
        context_prompt = self._build_context_prompt(course_context, chat_history, user_message)
        
        try:
            response = self.model.generate_content(context_prompt)
            return response.text
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return self._get_fallback_response(user_message)
    
    def _build_context_prompt(self, course_context, chat_history, user_message):
        """Build a comprehensive prompt for the AI"""
        
        prompt = f"""
        You are an AI Learning Assistant helping a student learn about: {course_context['course_name']}
        
        COURSE STRUCTURE:
        {json.dumps(course_context['structure'], indent=2)}
        
        CURRENT LEARNING CONTEXT:
        - Current Unit: {course_context.get('current_unit', 'Not specified')}
        - User's Progress: {course_context.get('progress', 'Beginning')}
        
        CHAT HISTORY (last 5 messages):
        {self._format_chat_history(chat_history)}
        
        USER'S CURRENT QUESTION: {user_message}
        
        INSTRUCTIONS:
        1. Provide accurate, educational responses based on the course structure
        2. Adapt to the user's learning level - use clear explanations
        3. Include practical examples when relevant
        4. Suggest next learning steps
        5. Be engaging and supportive
        6. If asking about specific topics, relate them to the course structure
        7. Provide code examples if relevant to programming topics
        8. Keep responses concise but comprehensive
        
        RESPONSE FORMAT:
        - Use clear, educational language
        - Break down complex concepts
        - Use bullet points or numbered lists when helpful
        - Include code examples in appropriate language
        - End with a suggestion for what to learn next
        
        Now, respond to the user's question helpfully:
        """
        
        return prompt
    
    def _format_chat_history(self, chat_history):
        """Format chat history for context"""
        if not chat_history:
            return "No previous conversation."
        
        # Take last 5 messages for context
        recent_history = chat_history[-5:]
        formatted = []
        for msg in recent_history:
            role = "Student" if msg.get('sender') == 'user' else "Assistant"
            formatted.append(f"{role}: {msg.get('text', '')}")
        
        return "\n".join(formatted)
    
    def _get_fallback_response(self, user_message):
        """Fallback response if API fails"""
        fallback_responses = [
            "I understand you're asking about your course. While I'm having some technical difficulties, I'd recommend focusing on the practical examples in your syllabus to reinforce your learning.",
            "That's a great question about your course material. Let me suggest reviewing the key concepts in your lesson plan and trying out the practice exercises.",
            "I'd love to help you with that! Based on your course structure, I suggest working through the examples step by step to build your understanding."
        ]
        
        import random
        return random.choice(fallback_responses)

# Global instance
ai_assistant = AILearningAssistant()