import PropTypes from "prop-types";
import "./ProgressBar.css";

/**
 * Reusable progress bar component
 * Replaces inline styles like:
 * <div style={{ width: `${progress}%`, background: '#75d6c4' }} />
 */
export function ProgressBar({
  value = 0,
  min = 0,
  max = 100,
  variant = "default",
  className = "",
  showLabel = false,
  animated = true,
}) {
  const percentage = Math.min(max, Math.max(min, ((value - min) / (max - min)) * 100));
  
  return (
    <div className={`progress-bar ${className}`} data-variant={variant}>
      <div 
        className="progress-bar-fill" 
        style={{ 
          "--progress-value": `${percentage}%`,
          "--progress-animation": animated ? "1" : "0"
        } as React.CSSProperties}
      >
        {showLabel && (
          <span className="progress-bar-label">
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

ProgressBar.propTypes = {
  value: PropTypes.number,
  min: PropTypes.number,
  max: PropTypes.number,
  variant: PropTypes.oneOf(["default", "success", "warning", "danger", "upload"]),
  className: PropTypes.string,
  showLabel: PropTypes.bool,
  animated: PropTypes.bool,
};

export default ProgressBar;
