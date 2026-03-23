import { useState, useRef, useMemo } from "react";
import "./TagInput.css";

export default function TagInput({
  tags = [],
  suggestions = [],
  onChange,
  placeholder = "Dodaj tag...",
}) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const normalizedTags = useMemo(() => Array.isArray(tags) ? tags : [], [tags]);

  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return suggestions
      .filter(
        (s) =>
          !normalizedTags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
          (query ? s.toLowerCase().includes(query) : true)
      )
      .slice(0, 10);
  }, [inputValue, suggestions, normalizedTags]);

  const canCreate =
    inputValue.trim().length > 0 &&
    !normalizedTags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase());

  function addTag(tag) {
    const normalized = String(tag || "").trim().replace(/,$/, "");
    if (!normalized) return;
    if (!normalizedTags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
      onChange([...normalizedTags, normalized]);
    }
    setInputValue("");
    inputRef.current?.focus();
  }

  function removeTag(tagToRemove) {
    onChange(normalizedTags.filter((t) => t !== tagToRemove));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && normalizedTags.length > 0) {
      removeTag(normalizedTags[normalizedTags.length - 1]);
    } else if (e.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className={`tag-input-container ${isFocused ? "focused" : ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="tag-input-tokens">
        {normalizedTags.map((tag) => (
          <span key={tag} className="tag-input-chip">
            <span className="tag-input-chip-label">#{tag}</span>
            <button
              type="button"
              className="tag-input-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              title="Usuń tag"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={normalizedTags.length === 0 ? placeholder : ""}
        />
      </div>

      {isFocused && (filteredSuggestions.length > 0 || canCreate) && (
        <div className="tag-input-dropdown">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="tag-input-option"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
            >
              <span className="tag-input-option-icon">#</span> {s}
            </button>
          ))}
          {canCreate && !filteredSuggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <button
              type="button"
              className="tag-input-option create"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(inputValue);
              }}
            >
              Utwórz: <strong>#{inputValue.trim()}</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
