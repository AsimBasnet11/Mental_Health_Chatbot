import React, { useState } from 'react';
import { FaQuestionCircle, FaArrowLeft, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import Sidebar from './Sidebar';

const FAQsPage = ({ onBack, onHomeClick, onMentalStateClick, onHistoryClick, onFAQsClick, onSummaryClick, user, onLogout, onNewChat }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What is this Mental Health Assistant?",
      answer: "This is an AI-powered mental health companion that analyzes your emotions and mental state through conversation. It uses advanced speech recognition and natural language processing to provide real-time emotional support and insights."
    },
    {
      question: "How does the voice recognition work?",
      answer: "We use Whisper medium, a speech recognition model optimized \nfor South Asian accents, running in real-time for accurate \ntranscription. It includes a hallucination filter to remove \nfalse transcriptions and a filler word remover for cleaner text."
    },
    {
      question: "How is my mental state analyzed?",
      answer: "Your speech is analyzed using two AI models: GoEmotions for emotion detection (28 emotions) and a custom BERT model for mental health classification (anxiety, depression, stress, etc.). The system uses keyword-based correction to handle dataset biases."
    },
    {
      question: "Is my data private and secure?",
      answer: "Your data is securely stored on our server with JWT \nauthentication. Each user has their own private conversation \nhistory. Voice data is processed in real-time and not \npermanently stored on our servers."
    },
    {
      question: "Can this replace professional therapy?",
      answer: "No. This tool is designed for self-reflection and emotional awareness, not as a replacement for professional mental health care. If you're experiencing severe mental health issues, please consult a licensed therapist or counselor."
    },
    {
      question: "What emotions can the system detect?",
      answer: "The system can detect 28 different emotions including joy, sadness, anger, fear, surprise, disgust, love, gratitude, anxiety, confusion, and many more. Each emotion is assigned a confidence score."
    },
    {
      question: "How accurate is the mental health analysis?",
      answer: "The system uses AI models that are continuously improved; performance depends on speech clarity and emotional expression. Results are indicative and meant to support self-reflection, not to replace professional diagnosis. We apply keyword detection and bias correction to improve classification robustness."
    },
    {
      question: "Can I view my analysis history?",
      answer: "Yes! Click on the History button in the sidebar to see \nyour full conversation history including timestamps, \nemotions detected, and mental health states. You can also \ncontinue any past conversation from the history page."
    },
    {
      question: "What should I do if I'm feeling suicidal?",
      answer: "If you're experiencing suicidal thoughts, please seek \nimmediate help. Nepal Mental Health Helpline: 1166 \n(TPO Nepal) or Saathi Helpline: 1145. You are not alone \n— help is available 24/7. You can also visit your nearest \nhospital emergency department immediately."
    },
    {
      question: "How can I improve the accuracy of voice recognition?",
      answer: "For best results: speak clearly, minimize background noise, use a good microphone, speak in complete sentences, and ensure stable internet connection for the WebSocket stream."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex h-screen bg-[#0a0515] text-white overflow-hidden">

      <Sidebar
        onHomeClick={onHomeClick}
        onMentalStateClick={onMentalStateClick}
        onHistoryClick={onHistoryClick}
        onFAQsClick={onFAQsClick}
        onSummaryClick={onSummaryClick}
        currentPage="faqs"
        user={user} onLogout={onLogout} onNewChat={onNewChat}
      />

      <div className="flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-[#0a0515] via-[#140a2e] to-[#0a0515]">

        {/* Animated Stars Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full opacity-20 animate-pulse"
              style={{
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-purple-500/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaQuestionCircle className="text-3xl text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  FAQs
                </h1>
                <p className="text-sm text-purple-300/60">Frequently asked questions</p>
              </div>
            </div>
            <button onClick={onBack}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all flex items-center gap-2">
              <FaArrowLeft /> Back
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(109,40,217,0.4) transparent',
          }}
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-[#1a1035]/60 backdrop-blur-md border border-purple-500/30 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all"
              >
                {/* Question */}
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-purple-600/10 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600/30 rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-semibold text-purple-200">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {openIndex === index ? (
                      <FaChevronUp className="text-purple-400" />
                    ) : (
                      <FaChevronDown className="text-purple-400" />
                    )}
                  </div>
                </button>

                {/* Answer */}
                {openIndex === index && (
                  <div className="px-6 pb-4 pt-2 bg-[#0a0515]/50 border-t border-purple-500/20">
                    <p className="text-purple-300/90 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Help Section */}
            <div className="mt-8 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-purple-300 mb-3">
                Still have questions?
              </h3>
              <p className="text-purple-200 mb-4">
                If you need additional help or have questions not covered here, please don't hesitate to reach out.
              </p>
              <button
                onClick={onBack}
                className="px-6 py-2 bg-purple-600/20 hover:bg-purple-600/40 rounded-full transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FAQsPage;