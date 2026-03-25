import React, { forwardRef } from 'react';
import './Forms.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', wrapperClassName = '', icon, error, ...props }, ref) => {
    return (
      <div className={`ui-input-wrapper ${wrapperClassName} ${error ? 'has-error' : ''}`}>
        {icon && <span className="ui-input-icon">{icon}</span>}
        <input
          ref={ref}
          className={`ui-input ${icon ? 'with-icon' : ''} ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
