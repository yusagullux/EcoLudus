"use client";

import { useState } from "react";
import Link from "next/link";

const questions = [
  {
    question: "How do you usually commute?",
    options: [
      { text: "Car (Gasoline)", impact: 50 },
      { text: "Public Transit", impact: 20 },
      { text: "Bicycle / Walk", impact: 0 },
      { text: "Electric Vehicle", impact: 10 }
    ]
  },
  {
    question: "How often do you eat meat?",
    options: [
      { text: "Every day", impact: 40 },
      { text: "A few times a week", impact: 25 },
      { text: "Rarely (Flexitarian)", impact: 15 },
      { text: "Never (Vegan/Vegetarian)", impact: 5 }
    ]
  },
  {
    question: "How do you handle household waste?",
    options: [
      { text: "Everything goes in the trash", impact: 30 },
      { text: "I recycle when convenient", impact: 15 },
      { text: "I strictly recycle and compost", impact: -10 }
    ]
  }
];

export function MiniQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (impact: number) => {
    setScore(score + impact);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResult(true);
    }
  };

  const getResultFeedback = () => {
    if (score < 30) return "Excellent! You're already living very sustainably.";
    if (score < 80) return "Not bad! But there's room to optimize your routine.";
    return "You have a high footprint. Time to start building greener habits!";
  };

  return (
    <div className="rounded-[2rem] border border-[#dfe7d7] bg-[#fffefa]/94 p-8 shadow-[0_24px_70px_rgba(16,33,20,0.1)] backdrop-blur">
      <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-forest-700/72">
        Mini-Quiz
      </div>
      <h2 className="mt-3 font-serif text-3xl font-extrabold text-forest-950">
        Estimate Your Carbon Footprint
      </h2>

      {!showResult ? (
        <div className="mt-6">
          <p className="mb-4 text-lg font-medium text-forest-900">
            {questions[currentQuestion].question}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {questions[currentQuestion].options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(option.impact)}
                className="rounded-xl border border-forest-900/10 bg-white px-4 py-3 text-sm font-semibold text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-forest-50"
              >
                {option.text}
              </button>
            ))}
          </div>
          <div className="mt-6 h-2 w-full rounded-full bg-forest-100">
            <div
              className="h-2 rounded-full bg-forest-600 transition-all duration-300"
              style={{ width: `${((currentQuestion) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <div className="text-5xl font-extrabold text-forest-900">{score} <span className="text-lg">pts</span></div>
          <p className="mt-4 text-base text-forest-800">{getResultFeedback()}</p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-full bg-forest-900 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-cream-100 shadow-[0_24px_54px_rgba(16,33,20,0.22)] hover:-translate-y-0.5 hover:bg-forest-800 sm:w-auto"
            >
              Sign up to lower this score!
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
