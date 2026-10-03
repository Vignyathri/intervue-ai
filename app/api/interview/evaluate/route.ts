import { NextResponse } from "next/server";

type Message = {
  speaker: "interviewer" | "candidate";
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const role =
      typeof body.role === "string"
        ? body.role
        : "Software Developer";

    const history: Message[] = Array.isArray(body.history)
      ? body.history
      : [];

    const answers = history.filter(
      (item) => item.speaker === "candidate"
    );

    if (answers.length === 0) {
      return NextResponse.json(
        { error: "No interview answers available." },
        { status: 400 }
      );
    }

    // Demo-safe local evaluation.
    // Later Gemini/another LLM can replace this.
    const totalWords = answers.reduce(
      (sum, item) =>
        sum + item.text.trim().split(/\s+/).length,
      0
    );

    const averageWords = Math.round(
      totalWords / answers.length
    );

    let communicationScore = 65;

    if (averageWords >= 20) communicationScore += 8;
    if (averageWords >= 40) communicationScore += 7;
    if (averageWords >= 70) communicationScore += 5;

    communicationScore = Math.min(
      communicationScore,
      90
    );

    const combinedAnswers = answers
      .map((item) => item.text.toLowerCase())
      .join(" ");

    const technicalWords = [
      "react",
      "javascript",
      "typescript",
      "api",
      "database",
      "sql",
      "frontend",
      "backend",
      "algorithm",
      "performance",
      "testing",
      "debug",
      "next.js",
      "supabase",
    ];

    const technicalMatches = technicalWords.filter(
      (word) => combinedAnswers.includes(word)
    ).length;

    const technicalScore = Math.min(
      90,
      65 + technicalMatches * 3
    );

    const overallScore = Math.round(
      (communicationScore + technicalScore) / 2
    );

    const strengths: string[] = [];
    const improvements: string[] = [];

    if (averageWords >= 30) {
      strengths.push(
        "Provides reasonably detailed answers."
      );
    } else {
      improvements.push(
        "Give more detailed answers with examples."
      );
    }

    if (technicalMatches >= 3) {
      strengths.push(
        "Uses relevant technical concepts and terminology."
      );
    } else {
      improvements.push(
        "Include more technical reasoning when explaining solutions."
      );
    }

    strengths.push(
      "Completed the interview and responded to multiple questions."
    );

    improvements.push(
      "Use the STAR method for behavioral questions."
    );

    improvements.push(
      "Explain the problem, approach, implementation, and result clearly."
    );

    const recommendedTopics = [
      `${role} fundamentals`,
      "Problem solving",
      "Technical communication",
      "Behavioral interview preparation",
      "Project explanation",
    ];

    return NextResponse.json({
      overallScore,
      technicalScore,
      communicationScore,
      questionsAnswered: answers.length,
      averageAnswerLength: averageWords,
      strengths,
      improvements,
      recommendedTopics,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not evaluate interview." },
      { status: 500 }
    );
  }
}