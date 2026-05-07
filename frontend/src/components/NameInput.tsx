import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function NameInput({ value, onChange, disabled }: Props): React.ReactElement {
  return (
    <div className="name-input-wrap">
      <label htmlFor="name-field" className="input-label">Your Name</label>
      <input
        id="name-field"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        disabled={disabled}
        placeholder="Enter your name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="name-input"
      />
      <div className="char-count">{value.length} / 60</div>
    </div>
  );
}
