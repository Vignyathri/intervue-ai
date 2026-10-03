import { NextResponse } from "next/server";

type Message = {
  speaker: "interviewer" | "candidate";
  text: string;
};

function clean(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function alreadyAsked(
  history: Message[],
  question: string
) {
  const target = clean(question);

  return history
    .filter(
      (m) => m.speaker === "interviewer"
    )
    .some((m) => {
      const previous = clean(m.text);

      // Exact match
      if (previous === target) return true;

      // Similarity based on important words
      const a = new Set(
        target
          .split(" ")
          .filter((word) => word.length > 4)
      );

      const b = new Set(
        previous
          .split(" ")
          .filter((word) => word.length > 4)
      );

      if (a.size === 0) return false;

      let matches = 0;

      for (const word of a) {
        if (b.has(word)) matches++;
      }

      return matches / a.size > 0.75;
    });
}

function fallbackQuestion(
  role: string,
  history: Message[]
) {
  const answers = history.filter(
    (m) => m.speaker === "candidate"
  );

  const lastAnswer =
    answers[answers.length - 1]?.text || "";

  const text = clean(lastAnswer);

  const candidates: string[] = [];

  // -------------------------------
  // REACT / FRONTEND
  // -------------------------------

  if (
    /\breact\b|\bnext\.?js\b|\bfrontend\b|\bfront end\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned frontend development. What happens when a React component re-renders, and how would you prevent unnecessary re-renders?"
    );

    candidates.push(
      "You mentioned React. Describe a difficult frontend bug you faced and how you diagnosed it."
    );

    candidates.push(
      "For the frontend project you mentioned, how did you decide how to structure your components and state?"
    );
  }

  // -------------------------------
  // JAVASCRIPT
  // -------------------------------

  if (
    /\bjavascript\b|\btypescript\b|\basync\b|\bpromise\b|\bclosure\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned JavaScript. Can you explain how asynchronous code works and give an example from a project?"
    );

    candidates.push(
      "You mentioned TypeScript or JavaScript. What is one language feature that has helped you write safer or more maintainable code?"
    );
  }

  // -------------------------------
  // API / BACKEND
  // -------------------------------

  if (
    /\bapi\b|\bbackend\b|\bserver\b|\bnode\b|\bexpress\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned backend development. How would you design an API that remains reliable when a downstream service fails?"
    );

    candidates.push(
      "You mentioned an API. How would you handle authentication, validation, errors, and rate limiting?"
    );
  }

  // -------------------------------
  // DATABASE
  // -------------------------------

  if (
    /\bdatabase\b|\bsql\b|\bsupabase\b|\bpostgres\b|\bmongodb\b|\bmysql\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned database work. How would you design the database tables for a scalable application?"
    );

    candidates.push(
      "You mentioned a database. How would you protect user data from unauthorized access?"
    );
  }

  // -------------------------------
  // PROJECT
  // -------------------------------

  if (
    /\bproject\b|\bbuilt\b|\bdeveloped\b|\bapplication\b|\bapp\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned a project you built. What was the hardest technical decision you made, and what alternatives did you consider?"
    );

    candidates.push(
      "For the project you described, how did you test whether your solution actually worked?"
    );

    candidates.push(
      "If you had one more week to improve that project, what would you change and why?"
    );
  }

  // -------------------------------
  // TEAMWORK
  // -------------------------------

  if (
    /\bteam\b|\bteammate\b|\bgroup\b|\bcollaborat\b|\bgithub\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned teamwork. Tell me about a disagreement with a teammate and how you resolved it."
    );

    candidates.push(
      "How did you divide responsibilities within the team, and how did you make sure the pieces worked together?"
    );
  }

  // -------------------------------
  // PROBLEM SOLVING
  // -------------------------------

  if (
    /\bproblem\b|\bbug\b|\berror\b|\bdebug\b|\bissue\b|\bfix\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned debugging or problem solving. Walk me through your exact process for finding the root cause of a difficult bug."
    );

    candidates.push(
      "How do you decide whether a problem is caused by the frontend, backend, database, or external service?"
    );
  }

  // -------------------------------
  // PERFORMANCE
  // -------------------------------

  if (
    /\bperformance\b|\bslow\b|\boptimization\b|\boptimiz/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned performance. How would you measure the bottleneck before deciding what to optimize?"
    );

    candidates.push(
      "What techniques would you use to improve the performance of a web application used by thousands of users?"
    );
  }

  // -------------------------------
  // AI / MACHINE LEARNING
  // -------------------------------

  if (
    /\bai\b|\bartificial intelligence\b|\bmachine learning\b|\bml\b|\bmodel\b|\bgemini\b|\bllm\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned AI or machine learning. How would you evaluate whether an AI feature is actually useful to users?"
    );

    candidates.push(
      "You mentioned an AI model. What would you consider when choosing a model for a production application?"
    );
  }

  // -------------------------------
  // DATA SCIENCE
  // -------------------------------

  if (
    /\bdata science\b|\bdatascience\b|\bpandas\b|\bnumpy\b|\bpython\b|\bdata analysis\b|\bstatistics\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned data science. How would you handle missing or inconsistent data before building a model?"
    );

    candidates.push(
      "How would you decide which metrics are useful for evaluating a machine-learning model?"
    );
  }

  // -------------------------------
  // ECE / ELECTRONICS
  // -------------------------------

  if (
    /\bece\b|\belectronics\b|\bmicrocontroller\b|\bembedded\b|\biot\b|\bsensor\b|\barduino\b/.test(
      text
    )
  ) {
    candidates.push(
      "You mentioned embedded or electronics work. Describe a hardware-software integration problem you would expect to encounter and how you would debug it."
    );

    candidates.push(
      "How would you design an embedded system that needs to process sensor data reliably?"
    );
  }

  // -------------------------------
  // CHOOSE UNUSED CONTEXTUAL QUESTION
  // -------------------------------

  for (const candidate of candidates) {
    if (!alreadyAsked(history, candidate)) {
      return candidate;
    }
  }

  // -------------------------------
  // GENERAL QUESTIONS
  // -------------------------------

  const generalQuestions = [
    `What technical skill are you currently improving for your ${role} career, and how are you practicing it?`,

    "Describe a difficult problem you solved and explain your reasoning step by step.",

    "How do you test your work before giving it to a user or client?",

    "Tell me about a time when your first solution did not work. What did you change?",

    "How do you balance speed of development with code quality?",

    "How would you explain a complex technical concept to someone without a technical background?",

    "Tell me about a time you received critical feedback and how you responded.",

    "If you joined an unfamiliar codebase tomorrow, what would you do during your first day?",

    "What technical area would you like to become significantly better at during the next year?",

    `Why are you interested in working as a ${role}?`,
  ];

  for (const candidate of generalQuestions) {
    if (!alreadyAsked(history, candidate)) {
      return candidate;
    }
  }

  return "Tell me about another technical challenge you have faced and explain how you solved it.";
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const role =
      typeof body.role === "string" &&
      body.role.trim()
        ? body.role.trim()
        : "Software Developer";

    const history: Message[] =
      Array.isArray(body.history)
        ? body.history
        : [];

    const apiKey =
      process.env.GEMINI_API_KEY;

    // --------------------------------
    // TRY GEMINI FIRST
    // --------------------------------

    if (apiKey) {
      const conversation =
        history
          .map((item) => {
            const person =
              item.speaker ===
              "candidate"
                ? "Candidate"
                : "Interviewer";

            return `${person}: ${item.text}`;
          })
          .join("\n");

      const previousQuestions =
        history
          .filter(
            (item) =>
              item.speaker ===
              "interviewer"
          )
          .map(
            (item) => item.text
          )
          .join("\n");

      const prompt = `
You are a professional human interviewer.

Role:
${role}

Conversation:
${conversation || "No previous conversation."}

Previous questions:
${previousQuestions || "None"}

Ask exactly ONE next question.

CRITICAL:
- Base the next question on the candidate's MOST RECENT answer.
- If they mention a technology, project, decision, problem, or experience, ask a meaningful follow-up about that specific thing.
- Do not ask a generic unrelated question when the answer contains useful information.
- Never repeat a previous question.
- Gradually increase difficulty.
- Mix technical, behavioral, situational, and problem-solving questions.
- Return ONLY the question.
`;

      try {
        const response =
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
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
          const data =
            await response.json();

          const generated =
            data?.candidates?.[0]
              ?.content?.parts?.[0]
              ?.text?.trim();

          if (
            generated &&
            !alreadyAsked(
              history,
              generated
            )
          ) {
            return NextResponse.json(
              {
                question: generated,
                source: "gemini",
              }
            );
          }
        }
      } catch {
        // Use local fallback
      }
    }

    // --------------------------------
    // LOCAL ADAPTIVE FALLBACK
    // --------------------------------

    return NextResponse.json({
      question:
        fallbackQuestion(
          role,
          history
        ),
      source: "fallback",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not generate interview question.",
      },
      { status: 500 }
    );
  }
}