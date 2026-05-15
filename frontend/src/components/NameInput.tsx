import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function NameInput({ value, onChange, disabled }: Props): React.ReactElement {
  return (
    <div className="name-input-wrap">
      <label htmlFor="name-field" className="input-label">
        Your Name
      </label>
      <input
        id="name-field"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        disabled={disabled}
        placeholder="Name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        className="name-input"
      />
      <div className="char-count">{value.length} / 60</div>
    </div>
  );
}
