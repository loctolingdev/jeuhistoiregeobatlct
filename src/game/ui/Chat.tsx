import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useMp } from "../multiplayer";
import { input, shouldIgnoreKeyboard } from "../controls";

function NetworkPromo() {
  return (
    <a
      className="chat-promo"
      href="https://novaexe.lovable.app/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Rejoindre le réseau officiel du jeu dans un nouvel onglet"
    >
      <span aria-hidden="true">🌐</span>
      <span className="chat-promo-text">Rejoins le réseau officiel du jeu</span>
      <span className="chat-promo-cta">Rejoindre ↗</span>
    </a>
  );
}

export function Chat() {
  const { messages, players, connected, chatOpen, unread, name, myId, setChatOpen, sendChat } =
    useMp();
  const { openAccount } = useAuth();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = Object.keys(players).length + 1;

  useEffect(() => {
    useMp.getState().connect();
    return () => useMp.getState().disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboard(e.target)) return;
      if (e.code === "Enter" || e.code === "KeyT") {
        e.preventDefault();
        input.keys.clear();
        setChatOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setChatOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, chatOpen]);

  if (!chatOpen) {
    return (
      <div
        className="chat-widget pointer-events-auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <NetworkPromo />
        <button className="chat-toggle" onClick={() => setChatOpen(true)}>
          💬 Chat <span className="chat-count">{count} en ligne</span>
          {unread > 0 && <span className="chat-badge">{unread}</span>}
        </button>
      </div>
    );
  }

  return (
    <div
      className="chat-widget pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <NetworkPromo />
      <div className="chat-box">
        <div className="chat-head">
          <span className={connected ? "chat-dot chat-dot--on" : "chat-dot"} />
          <span className="font-display">Le port · {count} en ligne</span>
          <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="chat-who">
          <button className="chat-name-btn" onClick={openAccount} title="Modifier votre profil">
            Vous : <b>{name}</b> · Profil ✎
          </button>
          {Object.values(players).map((p, i) => (
            <span key={i} className="chat-player">
              {p.name}
            </span>
          ))}
        </div>
        <div ref={listRef} className="chat-list">
          {messages.length === 0 && <div className="chat-sys">Aucun message. Dites bonjour !</div>}
          {messages.map((m) =>
            m.system ? (
              <div key={m.id} className="chat-sys">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className={m.from === myId ? "chat-msg chat-msg--me" : "chat-msg"}>
                <span className="chat-author">{m.name}</span>
                <span>{m.text}</span>
              </div>
            ),
          )}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            sendChat(text);
            setText("");
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => input.keys.clear()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                inputRef.current?.blur();
              }
            }}
            placeholder={connected ? "Écrire un message… (Entrée)" : "Connexion…"}
            maxLength={200}
            className="chat-input"
          />
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!text.trim()}>
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}
