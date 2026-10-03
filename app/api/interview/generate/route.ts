import { NextResponse } from "next/server";

type Message = {
  speaker: "interviewer" | "candidate";
  text: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFallbackQuestion(
  role: string,
  history: Message[]
) {
  const previousQuestions = history
    .filter((item) => item.speaker === "interviewer")
    .map((item) => normalize(item.text));

  const answers = history
    .filter((item) => item.speaker === "candidate")
    .map((item) => item.text);

  const lastAnswer =
    answers[answers.length - 1]?.toLowerCase() || "";

  const questionNumber = answers.length + 1;

  // --------------------------------
  // QUESTION 1
  // --------------------------------

  if (answers.length === 0) {
    return `Welcome to your ${role} interview. Please introduce yourself and briefly describe your experience relevant to this role.`;
  }

  // --------------------------------
  // POSSIBLE ADAPTIVE QUESTIONS
  // --------------------------------

  const adaptiveQuestions: string[] = [];

  if (
    lastAnswer.includes("react") ||
    lastAnswer.includes("next.js") ||
    lastAnswer.includes("nextjs")
  ) {
    adaptiveQuestions.push(
      "You mentioned React or Next.js. Describe a difficult problem you encountered while using it and explain how you solved it."
    );

    adaptiveQuestions.push(
      "How would you improve the performance of a large React application that is re-rendering too frequently?"
    );
  }

  if (
    lastAnswer.includes("javascript") ||
    lastAnswer.includes("typescript")
  ) {
    adaptiveQuestions.push(
      "You mentioned JavaScript or TypeScript. Explain a concept from it that you have applied in a real project."
    );

    adaptiveQuestions.push(
      "How would you debug an asynchronous JavaScript problem where an API response is not appearing correctly in the interface?"
    );
  }

  if (
    lastAnswer.includes("api") ||
    lastAnswer.includes("backend")
  ) {
    adaptiveQuestions.push(
      "You mentioned APIs or backend development. How would you handle API failures, loading states, and retries in a production application?"
    );
  }

  if (
    lastAnswer.includes("database") ||
    lastAnswer.includes("sql") ||
    lastAnswer.includes("supabase")
  ) {
    adaptiveQuestions.push(
      "You mentioned database development. How would you design secure database access while preventing unauthorized users from reading another user's information?"
    );
  }

  if (
    lastAnswer.includes("team") ||
    lastAnswer.includes("group")
  ) {
    adaptiveQuestions.push(
      "You mentioned teamwork. Describe a disagreement within a team and explain how you helped resolve it."
    );
  }

  if (
    lastAnswer.includes("project") ||
    lastAnswer.includes("built") ||
    lastAnswer.includes("developed")
  ) {
    adaptiveQuestions.push(
      "Thinking about the project you mentioned, what was the most difficult technical decision you made and why?"
    );
  }

  if (
    lastAnswer.includes("performance") ||
    lastAnswer.includes("optimization")
  ) {
    adaptiveQuestions.push(
      "You mentioned performance optimization. How would you identify the actual bottleneck before deciding what to optimize?"
    );
  }

  if (
    lastAnswer.includes("css") ||
    lastAnswer.includes("responsive") ||
    lastAnswer.includes("frontend")
  ) {
    adaptiveQuestions.push(
      "How do you build a responsive and accessible interface that works well across different devices?"
    );
  }

  // Return an adaptive question ONLY if it has not
  // already been asked.
  for (const question of adaptiveQuestions) {
    if (!previousQuestions.includes(normalize(question))) {
      return question;
    }
  }

  // --------------------------------
  // PROGRESSIVE QUESTION BANK
  // --------------------------------

  const questionBank = [
    `What technical skills do you consider most important for a ${role}, and which of those skills is currently your strongest?`,

    "Describe a challenging bug you encountered. How did you systematically identify its root cause?",

    "Suppose users report that your web application has become slow. Walk me through how you would investigate the problem.",

    "How do you structure your code so that another developer can understand and maintain it easily?",

    "Tell me about a situation where something you built failed or did not work as expected. What did you learn from it?",

    "Imagine you have a feature deadline tomorrow but discover a significant technical problem today. How would you handle the situation?",

    "How do you test a feature before considering it ready for production?",

    "Describe a situation where you had to learn a new technology quickly. What was your approach?",

    "How would you explain a complex technical problem to a non-technical team member?",

    "Tell me about a time you received critical feedback about your work. How did you respond?",

    `What do you think separates an average ${role} from an excellent one?`,

    "If you joined a large existing codebase tomorrow, what would you do during your first few days to understand it?",

    "What is one technical area you currently want to improve, and what are you doing to improve it?",

    `Why are you interested in a ${role} position, and what kind of problems would you like to work on?`,
  ];

  // Find first question that hasn't been asked.
  const unusedQuestion = questionBank.find(
    (question) =>
      !previousQuestions.includes(normalize(question))
  );

  if (unusedQuestion) {
    return unusedQuestion;
  }

  // Extremely long interview fallback
  return `This is question ${questionNumber}. Describe another challenging situation from your experience that we have not discussed yet, and explain how you approached it.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const role =
      typeof body.role === "string" && body.role.trim()
        ? body.role.trim()
        : "Software Developer";

    const history: Message[] = Array.isArray(body.history)
      ? body.history
      : [];

    const apiKey = process.env.GEMINI_API_KEY;

    // --------------------------------
    // NO GEMINI KEY
    // --------------------------------

    if (!apiKey) {
      return NextResponse.json({
        question: getFallbackQuestion(role, history),
        source: "fallback",
      });
    }

    // --------------------------------
    // BUILD CONVERSATION
    // --------------------------------

    const conversation = history
      .map((item) => {
        const person =
          item.speaker === "candidate"
            ? "Candidate"
            : "Interviewer";

        return `${person}: ${item.text}`;
      })
      .join("\n");

    const previousQuestions = history
      .filter(
        (item) => item.speaker === "interviewer"
      )
      .map((item) => item.text)
      .join("\n");

    const prompt = `
You are a professional AI interviewer.

You are interviewing a candidate for:

${role}

CONVERSATION SO FAR:

${conversation || "This is the beginning of the interview."}

QUESTIONS ALREADY ASKED:

${previousQuestions || "None"}

Generate exactly ONE next interview question.

IMPORTANT RULES:

1. Never repeat a question already asked.
2. Use the candidate's latest answer when possible.
3. Ask a meaningful follow-up when their answer introduces an interesting technical topic.
4. Gradually increase difficulty.
5. Mix:
   - technical questions
   - behavioral questions
   - problem-solving questions
   - situational questions
   - project questions
6. Do not give feedback yet.
7. Do not provide the answer.
8. Do not number the question.
9. Return ONLY the interview question.
10. Keep the question concise and natural.

The interview should feel like a real interviewer reacting to the candidate rather than reading a fixed questionnaire.
`;

    // --------------------------------
    // TRY GEMINI
    // --------------------------------

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        const generatedQuestion =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (generatedQuestion) {
          const alreadyAsked = history
            .filter(
              (item) =>
                item.speaker === "interviewer"
            )
            .some(
              (item) =>
                normalize(item.text) ===
                normalize(generatedQuestion)
            );

          if (!alreadyAsked) {
            return NextResponse.json({
              question: generatedQuestion,
              source: "gemini",
            });
          }
        }
      } else {
        const errorData = await response
          .json()
          .catch(() => null);

        console.log(
          "Gemini unavailable. Using fallback.",
          response.status,
          errorData?.error?.status || ""
        );
      }
    } catch {
      console.log(
        "Gemini connection unavailable. Using fallback."
      );
    }

    // --------------------------------
    // FALLBACK
    // --------------------------------

    return NextResponse.json({
      question: getFallbackQuestion(
        role,
        history
      ),

      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not process interview request.",
      },
      {
        status: 400,
      }
    );
  }
}