
"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  speaker: "interviewer" | "candidate";
  text: string;
};

type Report = {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  questionsAnswered: number;
  averageAnswerLength: number;
  strengths: string[];
  improvements: string[];
  recommendedTopics: string[];
};

export default function InterviewPage() {
  const [role, setRole] = useState("Frontend Developer");
  const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [apiMessage, setApiMessage] = useState("");

  const [endingInterview, setEndingInterview] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  // =========================================================
  // STOP EVERYTHING
  // =========================================================

  function stopEverything() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      recognitionRef.current?.stop?.();
    } catch {}

    recognitionRef.current = null;

    setListening(false);

    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }
  }

  // =========================================================
  // MICROPHONE
  // =========================================================

  function startListening() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechMessage(
        "Voice recognition is unavailable in this browser. Please type your answer."
      );
      return;
    }

    try {
      recognitionRef.current?.stop?.();
    } catch {}

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);

      setSpeechMessage(
        "Listening... answer the interviewer's question."
      );
    };

    recognition.onresult = (event: any) => {
      let interim = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      const combined =
        finalTranscriptRef.current + interim;

      setAnswer(combined.trim());

      // Stop after candidate becomes silent.
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        try {
          recognition.stop();
        } catch {}

        setListening(false);
        setSpeechMessage("Answer captured.");
      }, 2200);
    };

    recognition.onerror = (event: any) => {
      setListening(false);

      if (event.error === "no-speech") {
        setSpeechMessage(
          "No speech was detected. You can type your answer below."
        );
        return;
      }

      if (event.error === "not-allowed") {
        setSpeechMessage(
          "Microphone access is blocked. Allow microphone permission in Chrome."
        );
        return;
      }

      if (event.error === "audio-capture") {
        setSpeechMessage(
          "No microphone was detected. You can type your answer."
        );
        return;
      }

      if (event.error === "network") {
        setSpeechMessage(
          "Browser speech recognition is unavailable right now. You can type your answer."
        );
        return;
      }

      if (event.error !== "aborted") {
        setSpeechMessage(
          "Voice recognition stopped. You can type your answer."
        );
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);

      setSpeechMessage(
        "Could not start voice recognition. You can type your answer."
      );
    }
  }

  // =========================================================
  // AI VOICE
  // =========================================================

  function speakQuestion(text: string) {
    if (!text || typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      setSpeechMessage(
        "Text-to-speech is unavailable. Please read the question and type your answer."
      );
      return;
    }

    stopEverything();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    setSpeechMessage("Interviewer is speaking...");

    utterance.onend = () => {
      setSpeechMessage(
        "Interviewer finished. Starting microphone..."
      );

      // Start listening after the AI has finished.
      setTimeout(() => {
        startListening();
      }, 500);
    };

    utterance.onerror = () => {
      setSpeechMessage(
        "Could not play the interviewer voice. You can read the question and type your answer."
      );
    };

    window.speechSynthesis.speak(utterance);
  }

  // =========================================================
  // GENERATE QUESTION
  // =========================================================

  async function generateQuestion(messages: Message[]) {
    setLoading(true);
    setApiMessage("");
    setSpeechMessage("");

    try {
      const response = await fetch(
        "/api/interview/generate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            role,
            history: messages,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setApiMessage(
          data?.error ||
            "Could not generate the next question."
        );
        return;
      }

      if (!data?.question) {
        setApiMessage(
          "No question was generated. Please retry."
        );
        return;
      }

      setQuestion(data.question);

      // Because Start Interview gives us the required
      // initial browser interaction, subsequent questions
      // can be spoken automatically.
      setTimeout(() => {
        speakQuestion(data.question);
      }, 350);
    } catch {
      setApiMessage(
        "Could not contact the interviewer. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // START INTERVIEW
  // =========================================================

  async function startInterview() {
    stopEverything();

    setStarted(true);
    setReport(null);
    setHistory([]);
    setQuestion("");
    setAnswer("");
    setApiMessage("");
    setSpeechMessage("");

    await generateQuestion([]);
  }

  // =========================================================
  // SUBMIT ANSWER
  // =========================================================

  async function submitAnswer() {
    const cleanAnswer = answer.trim();

    if (!cleanAnswer) {
      setSpeechMessage(
        "Please answer the question before submitting."
      );
      return;
    }

    if (!question) {
      return;
    }

    stopEverything();

    const updatedHistory: Message[] = [
      ...history,
      {
        speaker: "interviewer",
        text: question,
      },
      {
        speaker: "candidate",
        text: cleanAnswer,
      },
    ];

    setHistory(updatedHistory);
    setAnswer("");
    setQuestion("");
    setSpeechMessage("");

    finalTranscriptRef.current = "";

    await generateQuestion(updatedHistory);
  }

  // =========================================================
  // CLOSE INTERVIEW
  // =========================================================

  async function closeInterview() {
    stopEverything();

    let finalHistory = [...history];

    // If candidate has typed/spoken an answer but hasn't
    // pressed Submit yet, include that answer in the report.
    if (question && answer.trim()) {
      finalHistory = [
        ...finalHistory,
        {
          speaker: "interviewer",
          text: question,
        },
        {
          speaker: "candidate",
          text: answer.trim(),
        },
      ];
    }

    const candidateAnswers = finalHistory.filter(
      (item) => item.speaker === "candidate"
    );

    if (candidateAnswers.length === 0) {
      alert(
        "Please answer at least one question before closing the interview."
      );
      return;
    }

    setEndingInterview(true);
    setApiMessage("");

    try {
      const response = await fetch(
        "/api/interview/evaluate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            role,
            history: finalHistory,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data?.error ||
            "Could not generate the interview report."
        );
        return;
      }

      setHistory(finalHistory);
      setReport(data);
      setStarted(false);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch {
      alert(
        "Could not generate the interview report."
      );
    } finally {
      setEndingInterview(false);
    }
  }

  // =========================================================
  // CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      try {
        recognitionRef.current?.stop?.();
      } catch {}

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // =========================================================
  // REPORT SCREEN
  // =========================================================

  if (report) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <header style={reportHeaderStyle}>
            <div>
              <h1 style={logoStyle}>IntervueAI</h1>

              <p style={mutedText}>
                Interview Performance Report
              </p>
            </div>

            <div style={completedBadge}>
              Interview Completed
            </div>
          </header>

          {/* OVERALL */}

          <section style={heroReportCard}>
            <p style={scoreLabel}>OVERALL SCORE</p>

            <div style={overallScoreStyle}>
              {report.overallScore}
              <span style={overallSuffix}>/100</span>
            </div>

            <h2 style={{ marginBottom: "5px" }}>
              {role}
            </h2>

            <p style={mutedText}>
              {report.questionsAnswered} questions answered
            </p>
          </section>

          {/* SCORE CARDS */}

          <div style={scoreGridStyle}>
            <ScoreCard
              title="Technical"
              score={report.technicalScore}
            />

            <ScoreCard
              title="Communication"
              score={report.communicationScore}
            />

            <ScoreCard
              title="Questions"
              score={report.questionsAnswered}
              suffix=""
            />

            <ScoreCard
              title="Avg. Answer"
              score={report.averageAnswerLength}
              suffix=" words"
            />
          </div>

          {/* STRENGTHS */}

          <section style={cardStyle}>
            <div style={sectionTitleRow}>
              <div style={positiveIcon}>✓</div>

              <h2 style={{ margin: 0 }}>
                Strengths
              </h2>
            </div>

            {report.strengths.map((item, index) => (
              <div key={index} style={listItemStyle}>
                <span style={checkStyle}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </section>

          {/* IMPROVEMENTS */}

          <section style={cardStyle}>
            <div style={sectionTitleRow}>
              <div style={improveIcon}>↑</div>

              <h2 style={{ margin: 0 }}>
                Areas to Improve
              </h2>
            </div>

            {report.improvements.map(
              (item, index) => (
                <div
                  key={index}
                  style={listItemStyle}
                >
                  <span style={arrowStyle}>→</span>
                  <span>{item}</span>
                </div>
              )
            )}
          </section>

          {/* TOPICS */}

          <section style={cardStyle}>
            <h2>Recommended Practice</h2>

            <p style={mutedText}>
              Focus on these areas before your next
              interview.
            </p>

            <div style={tagContainer}>
              {report.recommendedTopics.map(
                (topic, index) => (
                  <span key={index} style={tagStyle}>
                    {topic}
                  </span>
                )
              )}
            </div>
          </section>

          {/* CONVERSATION */}

          <section style={cardStyle}>
            <h2>Interview Review</h2>

            {history.map((message, index) => (
              <div
                key={index}
                style={{
                  ...conversationItem,
                  background:
                    message.speaker === "candidate"
                      ? "#102018"
                      : "#151c29",
                }}
              >
                <strong>
                  {message.speaker === "candidate"
                    ? "You"
                    : "Interviewer"}
                  :
                </strong>{" "}
                {message.text}
              </div>
            ))}
          </section>

          <button
            onClick={startInterview}
            style={fullPrimaryButton}
          >
            Start New Interview
          </button>
        </div>
      </main>
    );
  }

  // =========================================================
  // START SCREEN
  // =========================================================

  if (!started) {
    return (
      <main style={pageStyle}>
        <div style={startContainer}>
          <div style={startLogo}>AI</div>

          <h1 style={bigTitle}>IntervueAI</h1>

          <p style={startDescription}>
            Practice realistic interviews with an
            adaptive AI interviewer and receive a
            performance report when you finish.
          </p>

          <div style={startCard}>
            <label style={labelStyle}>
              Interview Role
            </label>

            <input
              value={role}
              onChange={(event) =>
                setRole(event.target.value)
              }
              placeholder="Example: Frontend Developer"
              style={inputStyle}
            />

            <button
              onClick={startInterview}
              style={fullPrimaryButton}
            >
              Start Interview
            </button>

            <p style={smallMutedText}>
              Clicking Start Interview allows the
              browser to activate interviewer audio and
              microphone access.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // INTERVIEW SCREEN
  // =========================================================

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {/* HEADER */}

        <header style={headerStyle}>
          <div>
            <h1 style={logoStyle}>IntervueAI</h1>

            <p style={mutedText}>
              AI Mock Interview · {role}
            </p>
          </div>

          <button
            onClick={closeInterview}
            disabled={endingInterview}
            style={{
              ...closeButton,
              opacity: endingInterview ? 0.6 : 1,
            }}
          >
            {endingInterview
              ? "Generating Report..."
              : "✕ Close Interview"}
          </button>
        </header>

        {/* STATUS */}

        <div style={statusBar}>
          <span style={statusDot} />

          <span>
            {loading
              ? "Interviewer is thinking"
              : listening
              ? "Microphone is listening"
              : "Interview in progress"}
          </span>

          <span style={questionCount}>
            {history.filter(
              (item) =>
                item.speaker === "candidate"
            ).length + 1}{" "}
            current question
          </span>
        </div>

        {/* INTERVIEWER */}

        <section style={cardStyle}>
          <div style={interviewerHeader}>
            <div style={avatarStyle}>AI</div>

            <div>
              <h2 style={{ margin: 0 }}>
                AI Interviewer
              </h2>

              <p style={mutedText}>
                Professional Interviewer
              </p>
            </div>
          </div>

          {loading ? (
            <div style={thinkingBox}>
              <div style={thinkingDots}>
                • • •
              </div>

              <p style={mutedText}>
                Preparing a question based on your
                previous response...
              </p>
            </div>
          ) : (
            <>
              <p style={questionStyle}>
                {question ||
                  "Preparing your question..."}
              </p>

              {question && (
                <button
                  onClick={() =>
                    speakQuestion(question)
                  }
                  style={secondaryButton}
                >
                  🔊 Repeat Question
                </button>
              )}
            </>
          )}

          {apiMessage && (
            <div style={errorBox}>
              <p>{apiMessage}</p>

              <button
                onClick={() =>
                  generateQuestion(history)
                }
                style={secondaryButton}
              >
                Retry Question
              </button>
            </div>
          )}
        </section>

        {/* CANDIDATE ANSWER */}

        <section style={cardStyle}>
          <div style={answerHeader}>
            <div>
              <h2 style={{ margin: 0 }}>
                Your Answer
              </h2>

              <p style={mutedText}>
                The microphone starts after the
                interviewer finishes speaking.
              </p>
            </div>

            <div
              style={
                listening
                  ? listeningBadge
                  : waitingBadge
              }
            >
              {listening
                ? "● Listening"
                : "Microphone idle"}
            </div>
          </div>

          <textarea
            value={answer}
            onChange={(event) =>
              setAnswer(event.target.value)
            }
            placeholder={
              listening
                ? "Speak now — your answer will appear here..."
                : "Your spoken answer will appear here. You can also type."
            }
            rows={7}
            style={textareaStyle}
          />

          {speechMessage && (
            <div style={speechStatus}>
              {speechMessage}
            </div>
          )}

          <div style={answerActions}>
            <button
              onClick={() => {
                stopEverything();
                startListening();
              }}
              disabled={listening || loading}
              style={smallSecondaryButton}
            >
              ↻ Retry Microphone
            </button>

            <button
              onClick={submitAnswer}
              disabled={
                loading ||
                !answer.trim() ||
                !question
              }
              style={{
                ...primaryButton,
                opacity:
                  loading ||
                  !answer.trim() ||
                  !question
                    ? 0.5
                    : 1,
              }}
            >
              Submit Answer →
            </button>
          </div>
        </section>

        {/* HISTORY */}

        {history.length > 0 && (
          <section style={historySection}>
            <h2>Interview Progress</h2>

            {history.map((message, index) => (
              <div
                key={index}
                style={{
                  ...conversationItem,

                  background:
                    message.speaker === "candidate"
                      ? "#102018"
                      : "#151c29",
                }}
              >
                <strong>
                  {message.speaker === "candidate"
                    ? "You"
                    : "Interviewer"}
                  :
                </strong>{" "}
                {message.text}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// =========================================================
// SCORE CARD
// =========================================================

function ScoreCard({
  title,
  score,
  suffix = "/100",
}: {
  title: string;
  score: number;
  suffix?: string;
}) {
  return (
    <div style={scoreCardStyle}>
      <p style={scoreLabel}>{title}</p>

      <div style={scoreNumberStyle}>
        {score}

        <span style={scoreSuffixStyle}>
          {suffix}
        </span>
      </div>
    </div>
  );
}

// =========================================================
// STYLES
// =========================================================

const pageStyle = {
  minHeight: "100vh",
  background: "#070a10",
  color: "#ffffff",
  padding: "32px 20px 60px",
  fontFamily:
    "Inter, Arial, Helvetica, sans-serif",
};

const containerStyle = {
  maxWidth: "1050px",
  margin: "0 auto",
};

const startContainer = {
  maxWidth: "650px",
  margin: "80px auto",
  textAlign: "center" as const,
};

const startLogo = {
  width: "82px",
  height: "82px",
  margin: "0 auto 20px",
  borderRadius: "24px",
  background: "#ffffff",
  color: "#080b12",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "900",
  fontSize: "27px",
};

const bigTitle = {
  fontSize: "48px",
  marginBottom: "12px",
};

const startDescription = {
  color: "#9da9ba",
  fontSize: "18px",
  lineHeight: 1.7,
  maxWidth: "600px",
  margin: "0 auto 30px",
};

const startCard = {
  padding: "30px",
  background: "#111722",
  border: "1px solid #293140",
  borderRadius: "18px",
  textAlign: "left" as const,
};

const labelStyle = {
  display: "block",
  marginBottom: "10px",
  fontWeight: "700",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "15px",
  borderRadius: "10px",
  border: "1px solid #343d4d",
  background: "#080b12",
  color: "#ffffff",
  fontSize: "17px",
  marginBottom: "18px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "15px",
  marginBottom: "20px",
};

const reportHeaderStyle = {
  ...headerStyle,
  marginBottom: "30px",
};

const logoStyle = {
  margin: 0,
  fontSize: "36px",
};

const mutedText = {
  color: "#9da9ba",
};

const smallMutedText = {
  color: "#7f8a9c",
  fontSize: "13px",
  textAlign: "center" as const,
  lineHeight: 1.5,
  marginBottom: 0,
};

const statusBar = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 16px",
  background: "#0f1520",
  border: "1px solid #263042",
  borderRadius: "10px",
  color: "#b8c2d1",
  marginBottom: "20px",
};

const statusDot = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#55d98b",
};

const questionCount = {
  marginLeft: "auto",
  color: "#7f8a9c",
  fontSize: "13px",
};

const cardStyle = {
  padding: "28px",
  background: "#111722",
  border: "1px solid #293140",
  borderRadius: "16px",
  marginBottom: "20px",
};

const interviewerHeader = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  marginBottom: "24px",
};

const avatarStyle = {
  width: "58px",
  height: "58px",
  borderRadius: "50%",
  background: "#263246",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "800",
};

const questionStyle = {
  fontSize: "22px",
  lineHeight: 1.65,
};

const thinkingBox = {
  padding: "15px 0",
};

const thinkingDots = {
  fontSize: "30px",
  letterSpacing: "6px",
};

const answerHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  flexWrap: "wrap" as const,
  marginBottom: "18px",
};

const listeningBadge = {
  padding: "8px 12px",
  borderRadius: "20px",
  background: "#153020",
  border: "1px solid #285f3d",
  color: "#7ee787",
  fontSize: "13px",
  fontWeight: "700",
};

const waitingBadge = {
  padding: "8px 12px",
  borderRadius: "20px",
  background: "#1a2230",
  border: "1px solid #354158",
  color: "#9da9ba",
  fontSize: "13px",
};

const textareaStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "16px",
  borderRadius: "10px",
  border: "1px solid #343d4d",
  background: "#080b12",
  color: "#ffffff",
  fontSize: "17px",
  lineHeight: 1.6,
  resize: "vertical" as const,
};

const speechStatus = {
  marginTop: "12px",
  color: "#9da9ba",
  fontSize: "14px",
};

const answerActions = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap" as const,
  gap: "12px",
  marginTop: "18px",
};

const primaryButton = {
  padding: "13px 22px",
  border: "none",
  borderRadius: "9px",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "700",
  background: "#ffffff",
  color: "#000000",
};

const fullPrimaryButton = {
  ...primaryButton,
  width: "100%",
  padding: "15px",
};

const secondaryButton = {
  padding: "11px 18px",
  border: "1px solid #3a4353",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  background: "#1a2230",
  color: "#ffffff",
};

const smallSecondaryButton = {
  ...secondaryButton,
  fontSize: "13px",
};

const closeButton = {
  padding: "12px 18px",
  border: "1px solid #783c3c",
  borderRadius: "9px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
  background: "#351a1a",
  color: "#ffb7b7",
};

const errorBox = {
  marginTop: "20px",
  padding: "16px",
  background: "#2a1c0c",
  border: "1px solid #66451d",
  borderRadius: "10px",
};

const historySection = {
  marginTop: "30px",
};

const conversationItem = {
  padding: "15px",
  marginBottom: "10px",
  border: "1px solid #293140",
  borderRadius: "10px",
  lineHeight: 1.55,
};

const heroReportCard = {
  ...cardStyle,
  textAlign: "center" as const,
  padding: "40px",
};

const scoreLabel = {
  color: "#8996a9",
  fontSize: "13px",
  fontWeight: "700",
  letterSpacing: "1px",
  textTransform: "uppercase" as const,
};

const overallScoreStyle = {
  fontSize: "74px",
  fontWeight: "900",
  margin: "10px 0",
};

const overallSuffix = {
  fontSize: "22px",
  color: "#7f8a9c",
  marginLeft: "5px",
};

const scoreGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "15px",
  marginBottom: "20px",
};

const scoreCardStyle = {
  padding: "22px",
  background: "#111722",
  border: "1px solid #293140",
  borderRadius: "14px",
  textAlign: "center" as const,
};

const scoreNumberStyle = {
  fontSize: "34px",
  fontWeight: "800",
};

const scoreSuffixStyle = {
  fontSize: "14px",
  color: "#7f8a9c",
  marginLeft: "3px",
};

const sectionTitleRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "15px",
};

const positiveIcon = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "#153020",
  color: "#7ee787",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const improveIcon = {
  ...positiveIcon,
  background: "#302713",
  color: "#f1c86a",
};

const listItemStyle = {
  display: "flex",
  gap: "12px",
  padding: "12px 0",
  borderBottom: "1px solid #252d3a",
  lineHeight: 1.5,
};

const checkStyle = {
  color: "#7ee787",
};

const arrowStyle = {
  color: "#f1c86a",
};

const tagContainer = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "10px",
  marginTop: "18px",
};

const tagStyle = {
  padding: "9px 13px",
  background: "#192334",
  border: "1px solid #354158",
  borderRadius: "20px",
};

const completedBadge = {
  padding: "9px 14px",
  borderRadius: "20px",
  background: "#153020",
  border: "1px solid #285f3d",
  color: "#7ee787",
  fontSize: "13px",
  fontWeight: "700",
};