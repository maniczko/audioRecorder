import React, { forwardRef } from "react";
import "./Forms.css";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", wrapperClassName = "", icon, error, children, ...props }, ref) => {
    return (
      <div className={`ui-input-wrapper ui-select-wrapper ${wrapperClassName} ${error ? "has-error" : ""}`}>
        {icon && <span className="ui-input-icon">{icon}</span>}
        <select
          ref={ref}
          className={`ui-input ui-select ${icon ? "with-icon" : ""} ${className}`}
          {...props}
        >
          {children}
        </select>
        <span className="ui-select-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
    );
  }
);

Select.displayName = "Select";
