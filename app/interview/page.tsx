"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  speaker: "interviewer" | "candidate";
  text: string;
};

export default function InterviewPage() {
  const [role, setRole] = useState("Frontend Developer");
  const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [apiMessage, setApiMessage] = useState("");

  const recognitionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Prevent duplicate first question in development mode
  const initialQuestionGenerated = useRef(false);

  // ------------------------------------
  // AI VOICE
  // ------------------------------------

  function speak(text: string) {
    if (!text) return;

    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  // ------------------------------------
  // GENERATE INTERVIEW QUESTION
  // ------------------------------------

  async function generateQuestion(messages: Message[]) {
    setLoading(true);
    setApiMessage("");

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
        if (response.status === 503) {
          setApiMessage(
            "AI interviewer is temporarily busy. Please click Retry Question."
          );

          return;
        }

        setApiMessage(
          data?.error ||
            "Could not generate the interview question."
        );

        return;
      }

      if (!data?.question) {
        setApiMessage(
          "No question was returned. Please retry."
        );

        return;
      }

      setQuestion(data.question);

      // Speak question automatically
      setTimeout(() => {
        speak(data.question);
      }, 300);
    } catch {
      setApiMessage(
        "Unable to contact the AI interviewer. Please retry."
      );
   } finally {
  setLoading(false);
}
  }

  // ------------------------------------
  // FIRST QUESTION
  // ------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    // Prevent duplicate API request
    if (!initialQuestionGenerated.current) {
      initialQuestionGenerated.current = true;

      generateQuestion([]);
    }

    return () => {
      mountedRef.current = false;

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore cleanup errors
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------
  // START SPEECH RECOGNITION
  // ------------------------------------

  function startListening() {
    setSpeechMessage("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechMessage(
        "Speech recognition is unavailable. Please use Chrome or type your answer."
      );

      return;
    }

    // Stop interviewer voice first
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Ignore
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    const existingAnswer = answer.trim();

    let finalTranscript = existingAnswer
      ? existingAnswer + " "
      : "";

    recognition.onstart = () => {
      setListening(true);

      setSpeechMessage(
        "Listening... start speaking now."
      );
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setAnswer(
        (
          finalTranscript + interimTranscript
        ).trimStart()
      );
    };

    recognition.onerror = (event: any) => {
      setListening(false);

      if (event.error === "no-speech") {
        setSpeechMessage(
          "No speech detected. Try again or type your answer."
        );

        return;
      }

      if (event.error === "not-allowed") {
        setSpeechMessage(
          "Microphone permission is blocked. Allow microphone access in Chrome."
        );

        return;
      }

      if (event.error === "audio-capture") {
        setSpeechMessage(
          "Microphone not detected. Check your microphone settings."
        );

        return;
      }

      if (event.error === "network") {
        setSpeechMessage(
          "Speech recognition network issue. You can type your answer instead."
        );

        return;
      }

      if (event.error === "aborted") {
        return;
      }

      setSpeechMessage(
        "Speech recognition stopped. Try again or type your answer."
      );
    };

    recognition.onend = () => {
      setListening(false);

      setSpeechMessage((current) => {
        if (current.startsWith("Listening")) {
          return "Microphone stopped.";
        }

        return current;
      });
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);

      setSpeechMessage(
        "Could not start microphone. Please try again."
      );
    }
  }

  // ------------------------------------
  // STOP SPEECH RECOGNITION
  // ------------------------------------

  function stopListening() {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Ignore
    }

    setListening(false);

    setSpeechMessage(
      "Microphone stopped."
    );
  }

  // ------------------------------------
  // SUBMIT ANSWER
  // ------------------------------------

  async function submitAnswer() {
    const cleanAnswer = answer.trim();

    if (!cleanAnswer) {
      setSpeechMessage(
        "Please speak or type an answer first."
      );

      return;
    }

    if (!question) {
      setApiMessage(
        "Wait for the interviewer to ask a question."
      );

      return;
    }

    stopListening();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

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

    await generateQuestion(updatedHistory);
  }

  // ------------------------------------
  // UI
  // ------------------------------------

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080b12",
        color: "#ffffff",
        padding: "35px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1050px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <header
          style={{
            marginBottom: "30px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "38px",
            }}
          >
            IntervueAI
          </h1>

          <p
            style={{
              color: "#9da9ba",
              marginTop: "8px",
            }}
          >
            Realistic AI Mock Interview
          </p>
        </header>

        {/* ROLE */}

        <section
          style={{
            marginBottom: "25px",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "9px",
              fontWeight: "bold",
            }}
          >
            Interview Role
          </label>

          <input
            value={role}
            onChange={(event) =>
              setRole(event.target.value)
            }
            disabled={
              history.length > 0 || loading
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              borderRadius: "9px",
              border: "1px solid #343d4d",
              background: "#111722",
              color: "#ffffff",
              fontSize: "17px",
            }}
          />
        </section>

        {/* INTERVIEWER */}

        <section
          style={{
            padding: "30px",
            background: "#111722",
            border: "1px solid #293140",
            borderRadius: "16px",
            marginBottom: "25px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#263246",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "25px",
              }}
            >
              AI
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                }}
              >
                AI Interviewer
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#8ea1bf",
                }}
              >
                Professional Interviewer
              </p>
            </div>
          </div>

          {loading ? (
            <div>
              <p
                style={{
                  fontSize: "21px",
                }}
              >
                Interviewer is thinking...
              </p>

              <p
                style={{
                  color: "#8e9bad",
                }}
              >
                Preparing a question based on
                your previous answer.
              </p>
            </div>
          ) : (
            <p
              style={{
                fontSize: "22px",
                lineHeight: 1.6,
              }}
            >
              {question ||
                "Preparing your question..."}
            </p>
          )}

          {question && !loading && (
            <button
              onClick={() => speak(question)}
              style={secondaryButton}
            >
              🔊 Repeat Question
            </button>
          )}

          {apiMessage && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                borderRadius: "10px",
                background: "#2a1c0c",
                border: "1px solid #66451d",
              }}
            >
              <p
                style={{
                  marginTop: 0,
                }}
              >
                {apiMessage}
              </p>

              <button
                onClick={() =>
                  generateQuestion(history)
                }
                disabled={loading}
                style={secondaryButton}
              >
                Retry Question
              </button>
            </div>
          )}
        </section>

        {/* ANSWER */}

        <section
          style={{
            padding: "30px",
            background: "#111722",
            border: "1px solid #293140",
            borderRadius: "16px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Your Answer
          </h2>

          <textarea
            placeholder="Speak or type your answer..."
            value={answer}
            onChange={(event) =>
              setAnswer(event.target.value)
            }
            rows={7}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "16px",
              borderRadius: "10px",
              border: "1px solid #343d4d",
              background: "#080b12",
              color: "#ffffff",
              fontSize: "17px",
              lineHeight: 1.6,
              resize: "vertical",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            {!listening ? (
              <button
                onClick={startListening}
                disabled={loading}
                style={secondaryButton}
              >
                🎤 Start Speaking
              </button>
            ) : (
              <button
                onClick={stopListening}
                style={dangerButton}
              >
                ⏹ Stop Speaking
              </button>
            )}

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
              {loading
                ? "Interviewer thinking..."
                : "Submit Answer"}
            </button>
          </div>

          {speechMessage && (
            <p
              style={{
                marginTop: "15px",
                color: listening
                  ? "#7ee787"
                  : "#aab2c0",
              }}
            >
              {listening ? "🔴 " : ""}
              {speechMessage}
            </p>
          )}

          <p
            style={{
              marginTop: "20px",
              color: "#758196",
              fontSize: "14px",
            }}
          >
            If microphone recognition is
            unavailable, type your answer. The AI
            interview flow works with both.
          </p>
        </section>

        {/* HISTORY */}

        {history.length > 0 && (
          <section
            style={{
              marginTop: "35px",
            }}
          >
            <h2>
              Interview Conversation
            </h2>

            {history.map(
              (message, index) => (
                <div
                  key={index}
                  style={{
                    padding: "16px",
                    marginBottom: "12px",

                    background:
                      message.speaker ===
                      "interviewer"
                        ? "#111722"
                        : "#122017",

                    border:
                      "1px solid #293140",

                    borderRadius: "10px",

                    lineHeight: 1.5,
                  }}
                >
                  <strong>
                    {message.speaker ===
                    "interviewer"
                      ? "Interviewer"
                      : "You"}
                    :
                  </strong>{" "}
                  {message.text}
                </div>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}

// ------------------------------------
// BUTTON STYLES
// ------------------------------------

const primaryButton = {
  padding: "13px 22px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: "bold",
  background: "#ffffff",
  color: "#000000",
};

const secondaryButton = {
  padding: "13px 22px",
  border: "1px solid #3a4353",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "15px",
  background: "#1a2230",
  color: "#ffffff",
};

const dangerButton = {
  padding: "13px 22px",
  border: "1px solid #6d3333",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "15px",
  background: "#321818",
  color: "#ffffff",
};