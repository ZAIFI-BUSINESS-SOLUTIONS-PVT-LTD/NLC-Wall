import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function NameInput({ value, onChange, disabled }: Props): React.ReactElement {
  return (
    <div className="name-input-wrap">
      <div className="sig-header">
        <span className="sig-label">Type Anything</span>
        <span className="sig-optional">Optional</span>
      </div>
      <input
        id="name-field"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        disabled={disabled}
        placeholder="Your name, a message, anything…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="name-input"
      />
    </div>
  );
}
